import { j } from "@notionhq/workers/schema-builder";
import { worker } from "../worker.js";
import { notionPacer } from "../lib/notion-pacer.js";
import { getProp, fetchAllRows } from "../lib/notion-utils.js";
import { triageOneRow, type TriageResult } from "../lib/anthropic.js";
import { reviewOneChange, type ReviewResult } from "../lib/reviewer.js";

// Multi-agent triage with built-in supervision.
//
// Phase 1: Claude #1 (Triager) — parallel inference over every shadow row.
// Phase 2: Claude #2 (Reviewer) — parallel inference, each gets a row's
//          inbound text + Triager's output, returns risk verdict + reason.
// Phase 3: Throttled Notion writes — both AIs' outputs land in the same row.
//
// The diff renderer reads the Reviewer's verdict to default-check or default-
// uncheck each row's to_do block. Safe = auto-promote (checked). Review =
// human glance (checked but flagged). Risky = forced opt-in (unchecked).
//
// This is the multi-agent supervision primitive made concrete in a Notion
// workspace. Claude #1 acts, Claude #2 audits, human is the final gate.

const VERDICT_LABEL: Record<ReviewResult["verdict"], string> = {
  safe: "Safe",
  review: "Review",
  risky: "Risky",
};

worker.tool("triageShadow", {
  title: "Triage Shadow (multi-agent)",
  description:
    "Run the multi-agent triage pipeline on every row in the shadow customer-requests DB. Claude #1 (Triager) classifies each row and sets Priority, Owner, Classification, Severity Score, and a Draft Response. Claude #2 (Reviewer) supervises Claude #1 and stamps each row with a Risk Verdict (Safe/Review/Risky) and Risk Reason. Does NOT touch the real DB. Use when the user says 'triage everything in the shadow' or similar.",
  schema: j.object({}),
  execute: async (_input, { notion }) => {
    const shadowDbId = process.env.REQUESTS_SHADOW_DB_ID;
    if (!shadowDbId) {
      throw new Error("REQUESTS_SHADOW_DB_ID is not set in the worker env.");
    }

    await notionPacer.wait();
    const rows = await fetchAllRows(notion, shadowDbId);

    type Inference = {
      row: any;
      inbound: string;
      triage: TriageResult;
      review: ReviewResult;
    };

    // Phase 1: parallel Triager calls (~3s for 18 rows).
    const triageResults = await Promise.all(
      rows.map(async (row: any) => {
        const inbound = getProp(row, "Inbound Text");
        try {
          const triage = await triageOneRow(inbound);
          return { row, inbound, triage, ok: true as const };
        } catch (e: any) {
          return { row, inbound, ok: false as const, error: String(e?.message ?? e) };
        }
      }),
    );

    // Phase 2: parallel Reviewer calls (~3s for 18 rows). Each Reviewer sees
    // the inbound + the Triager's call and returns a risk verdict.
    const inferences: Inference[] = [];
    const errors: string[] = [];
    await Promise.all(
      triageResults.map(async (t) => {
        if (!t.ok) {
          errors.push(t.error);
          return;
        }
        try {
          const review = await reviewOneChange(t.inbound, t.triage);
          inferences.push({ row: t.row, inbound: t.inbound, triage: t.triage, review });
        } catch (e: any) {
          errors.push(`reviewer: ${e?.message ?? e}`);
        }
      }),
    );

    // Phase 3: throttled Notion writes (~6s at 3 req/s).
    const summary = { touched: 0, safe: 0, review: 0, risky: 0, errors: errors.length };
    for (const inf of inferences) {
      try {
        await notionPacer.wait();
        await notion.pages.update({
          page_id: inf.row.id,
          properties: {
            Priority: { select: { name: inf.triage.priority } },
            Owner: { select: { name: inf.triage.owner } },
            Classification: {
              rich_text: [{ text: { content: inf.triage.classification } }],
            },
            "Severity Score": { number: inf.triage.severityScore },
            "Draft Response": {
              rich_text: [{ text: { content: inf.triage.draft } }],
            },
            Status: { select: { name: "Triaged" } },
            "Last Touched": { date: { start: new Date().toISOString().slice(0, 10) } },
            "Risk Verdict": { select: { name: VERDICT_LABEL[inf.review.verdict] } },
            "Risk Reason": {
              rich_text: [{ text: { content: inf.review.reason } }],
            },
          },
        });
        summary.touched++;
        summary[inf.review.verdict]++;
      } catch (e: any) {
        summary.errors++;
        errors.push(String(e?.message ?? e));
      }
    }

    return { ...summary, errorMessages: errors };
  },
});

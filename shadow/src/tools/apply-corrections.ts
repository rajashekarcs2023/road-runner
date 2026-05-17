import { j } from "@notionhq/workers/schema-builder";
import { worker } from "../worker.js";
import { notionPacer } from "../lib/notion-pacer.js";
import { getProp, fetchAllRows } from "../lib/notion-utils.js";
import { correctDraft } from "../lib/corrector.js";
import { reviewOneChange } from "../lib/reviewer.js";

// AI self-correction loop. For every Risky row in the shadow:
//   1. Claude rewrites the draft taking the Reviewer's concern into account
//   2. Claude #2 re-reviews the corrected version
//   3. The shadow row is updated with the new draft, the original is preserved,
//      Correction Applied is set to Yes, and the Risk Verdict is updated to
//      reflect the second review.
//
// This is the multi-turn AI collaboration step. By the time the human sees
// the diff, AI #1 has already learned from AI #2 and produced a safer
// version. The audit trail preserves the original for accountability.

const VERDICT_LABEL: Record<string, string> = {
  safe: "Safe",
  review: "Review",
  risky: "Risky",
};

worker.tool("applyCorrections", {
  title: "Apply AI Self-Corrections",
  description:
    "For every row in the shadow DB that the Reviewer flagged Risky, have Claude rewrite the draft response taking the Reviewer's concern into account, then re-review the new draft. The original is preserved in 'Original Draft' and the corrected version replaces 'Draft Response'. Use this AFTER triageShadow and BEFORE diffShadowVsReal. Use when the user says 'apply corrections' or 'fix the risky drafts'.",
  schema: j.object({}),
  execute: async (_input, { notion }) => {
    const shadowDbId = process.env.REQUESTS_SHADOW_DB_ID;
    if (!shadowDbId) {
      throw new Error("REQUESTS_SHADOW_DB_ID is not set.");
    }

    await notionPacer.wait();
    const rows = await fetchAllRows(notion, shadowDbId);

    // Filter to Risky rows that haven't been corrected yet.
    const candidates = rows.filter((p: any) => {
      const verdict = getProp(p, "Risk Verdict");
      const already = getProp(p, "Correction Applied");
      return verdict === "Risky" && already !== "Yes";
    });

    if (candidates.length === 0) {
      return { corrected: 0, message: "No Risky rows to correct." };
    }

    // Phase 1: parallel correction calls.
    const corrections = await Promise.all(
      candidates.map(async (row: any) => {
        const requestId = getProp(row, "Request ID");
        const inbound = getProp(row, "Inbound Text");
        const originalDraft = getProp(row, "Draft Response");
        const reviewerReason = getProp(row, "Risk Reason");
        const triage = {
          priority: getProp(row, "Priority") as any,
          owner: getProp(row, "Owner") as any,
          classification: getProp(row, "Classification"),
          severityScore: Number(getProp(row, "Severity Score")) || 50,
          draft: originalDraft,
        };
        try {
          const correctedDraft = await correctDraft(inbound, originalDraft, reviewerReason);
          // Re-run the Reviewer on the corrected draft.
          const review = await reviewOneChange(inbound, { ...triage, draft: correctedDraft });
          return {
            row,
            requestId,
            originalDraft,
            correctedDraft,
            review,
            ok: true as const,
          };
        } catch (e: any) {
          return { row, requestId, ok: false as const, error: String(e?.message ?? e) };
        }
      }),
    );

    // Phase 2: throttled Notion writes.
    const summary = {
      corrected: 0,
      stillRisky: 0,
      downgraded: 0,
      errors: 0,
      errorMessages: [] as string[],
    };
    for (const c of corrections) {
      if (!c.ok) {
        summary.errors++;
        summary.errorMessages.push(c.error);
        continue;
      }
      try {
        await notionPacer.wait();
        await notion.pages.update({
          page_id: c.row.id,
          properties: {
            "Original Draft": {
              rich_text: [{ text: { content: c.originalDraft } }],
            },
            "Draft Response": {
              rich_text: [{ text: { content: c.correctedDraft } }],
            },
            "Correction Applied": { select: { name: "Yes" } },
            "Risk Verdict": { select: { name: VERDICT_LABEL[c.review.verdict] } },
            "Risk Reason": {
              rich_text: [
                {
                  text: {
                    content: `[Corrected from original after Reviewer feedback] ${c.review.reason}`,
                  },
                },
              ],
            },
          },
        });
        summary.corrected++;
        if (c.review.verdict === "risky") summary.stillRisky++;
        else summary.downgraded++;
      } catch (e: any) {
        summary.errors++;
        summary.errorMessages.push(String(e?.message ?? e));
      }
    }

    return summary;
  },
});

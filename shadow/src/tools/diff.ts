import { j } from "@notionhq/workers/schema-builder";
import { worker } from "../worker.js";
import { notionPacer } from "../lib/notion-pacer.js";
import {
  getProp,
  fetchAllRows,
  fetchAllBlockChildren,
} from "../lib/notion-utils.js";
import { computeDiff, type Row, type RowDiff } from "../lib/diff.js";

const DIFFED_FIELDS = [
  "Priority",
  "Owner",
  "Status",
  "Classification",
  "Severity Score",
  "Draft Response",
] as const;

function rowFromPage(page: any): Row {
  const values: Row["values"] = {};
  for (const field of DIFFED_FIELDS) {
    values[field] = getProp(page, field);
  }
  return { requestId: getProp(page, "Request ID"), values };
}

function calloutBlock(emoji: string, color: string, content: string) {
  return {
    object: "block",
    type: "callout",
    callout: {
      color,
      icon: { type: "emoji", emoji },
      rich_text: [{ type: "text", text: { content } }],
    },
  };
}

// Verdict-driven defaults. Safe = auto-promote (checked). Review = checked
// but flagged. Risky = forced opt-in (unchecked).
function defaultCheckedFor(verdict: string): boolean {
  if (verdict === "Risky") return false;
  return true;
}

function verdictBadge(verdict: string, reason: string) {
  if (verdict === "Risky") {
    return calloutBlock("🔴", "red_background", `RISKY — ${reason || "Reviewer flagged this change."}`);
  }
  if (verdict === "Review") {
    return calloutBlock("🟡", "yellow_background", `REVIEW — ${reason || "Reviewer asks for a human glance."}`);
  }
  return calloutBlock("🟢", "green_background", `SAFE — ${reason || "Reviewer agrees with Triager."}`);
}

// PREVIEW MODE banner. Locks the category in the page itself, not just the
// voiceover. Anyone opening the Diff Report sees "this is not live" first.
function previewModeBanner(modified: number, riskyCount: number) {
  const subtitle =
    riskyCount > 0
      ? `${modified} rows pending your review. ${riskyCount} flagged by the Reviewer agent as RISKY — unchecked by default. Check the boxes you want promoted to production.`
      : `${modified} rows pending your review. Check the boxes you want promoted to production.`;

  return [
    {
      object: "block",
      type: "callout",
      callout: {
        color: "blue_background",
        icon: { type: "emoji", emoji: "🔒" },
        rich_text: [
          {
            type: "text",
            text: { content: "PREVIEW MODE — these changes are NOT live yet." },
            annotations: { bold: true },
          },
        ],
      },
    },
    {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: subtitle } }],
      },
    },
  ];
}

function buildBlocks(
  diffs: RowDiff[],
  shadowById: Map<string, any>,
): any[] {
  const modified = diffs.filter((d) => d.kind === "modified").length;
  const added = diffs.filter((d) => d.kind === "added").length;
  const deleted = diffs.filter((d) => d.kind === "deleted").length;

  const verdicts = diffs.map((d) => getProp(shadowById.get(d.requestId), "Risk Verdict"));
  const riskyCount = verdicts.filter((v) => v === "Risky").length;
  const reviewCount = verdicts.filter((v) => v === "Review").length;
  const safeCount = verdicts.filter((v) => v === "Safe").length;

  const blocks: any[] = [];

  // Banner.
  blocks.push(...previewModeBanner(diffs.length, riskyCount));

  // Title.
  blocks.push({
    object: "block",
    type: "heading_1",
    heading_1: {
      rich_text: [
        { type: "text", text: { content: `Diff Report — ${new Date().toISOString().slice(0, 19).replace("T", " ")}` } },
      ],
    },
  });

  // Risk summary line.
  blocks.push(
    calloutBlock(
      "🤖",
      "gray_background",
      `Reviewer Agent (Claude #2) audited ${diffs.length} changes from the Triager (Claude #1): 🟢 ${safeCount} Safe   🟡 ${reviewCount} Review   🔴 ${riskyCount} Risky`,
    ),
  );

  // Files-changed line.
  blocks.push(
    calloutBlock(
      "📝",
      "gray_background",
      `Files changed: ${diffs.length} rows (${modified} modified, ${added} added, ${deleted} deleted)`,
    ),
  );

  if (diffs.length === 0) {
    blocks.push(calloutBlock("✅", "green_background", "No changes detected. Shadow matches real."));
    return blocks;
  }

  blocks.push({
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: [{ type: "text", text: { content: "Modified rows" } }] },
  });

  for (let i = 0; i < diffs.length; i++) {
    const d = diffs[i];
    const shadow = shadowById.get(d.requestId);
    const verdict = getProp(shadow, "Risk Verdict") || "Review";
    const reason = getProp(shadow, "Risk Reason");

    // Divider before each row to separate from the previous row's deltas.
    if (i > 0) {
      blocks.push({ object: "block", type: "divider", divider: {} });
    }

    // Heading: makes each row scannable and shows position N of M.
    blocks.push({
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: [
          {
            type: "text",
            text: { content: `${d.requestId}   (${i + 1} of ${diffs.length})` },
          },
        ],
      },
    });

    // The to_do block — the promote tool reads this. Default-checked is
    // driven by the Reviewer's verdict (Risky = unchecked).
    blocks.push({
      object: "block",
      type: "to_do",
      to_do: {
        checked: defaultCheckedFor(verdict),
        rich_text: [{ type: "text", text: { content: `Request ID: ${d.requestId}` } }],
      },
    });

    // Reviewer's verdict — placed AFTER the to_do so the visual association is
    // unambiguous: "this checkbox represents REQ-N, and the Reviewer says..."
    blocks.push(verdictBadge(verdict, reason));

    // AI self-correction marker. When the Triager regenerated this draft
    // taking the Reviewer's feedback into account, surface that explicitly —
    // it's the multi-turn AI collaboration moment.
    const correctionApplied = getProp(shadow, "Correction Applied");
    const originalDraft = getProp(shadow, "Original Draft");
    if (correctionApplied === "Yes" && originalDraft) {
      blocks.push(
        calloutBlock(
          "✏️",
          "purple_background",
          `AI self-correction applied — Triager rewrote this draft after Reviewer feedback. Original: "${originalDraft.slice(0, 200)}${originalDraft.length > 200 ? "..." : ""}"`,
        ),
      );
    }

    if (d.kind === "added") {
      blocks.push(calloutBlock("➕", "green_background", "Row added (not present in real DB)"));
      continue;
    }
    if (d.kind === "deleted") {
      blocks.push(calloutBlock("➖", "red_background", "Row removed in shadow"));
      continue;
    }

    for (const delta of d.fieldDeltas) {
      const beforeEmpty = !delta.before;
      if (delta.field === "Severity Score" && beforeEmpty) {
        blocks.push(
          calloutBlock(
            "🆕",
            "blue_background",
            `NEW PROPERTY added by agent: Severity Score = ${delta.after}`,
          ),
        );
        continue;
      }
      blocks.push(
        calloutBlock("➖", "red_background", `${delta.field}: ${delta.before || "(empty)"}`),
      );
      blocks.push(calloutBlock("➕", "green_background", `${delta.field}: ${delta.after}`));
    }
  }

  return blocks;
}

async function clearChildren(notion: any, pageId: string) {
  const existing = await fetchAllBlockChildren(notion, pageId);
  // Parallel-batch deletes. Notion tolerates concurrent delete requests; the
  // pacer-throttled serial version overflows the worker timeout at >50 blocks.
  const BATCH = 8;
  for (let i = 0; i < existing.length; i += BATCH) {
    const slice = existing.slice(i, i + BATCH);
    await Promise.all(
      slice.map((b: any) =>
        notion.blocks.delete({ block_id: b.id }).catch(() => undefined),
      ),
    );
  }
}

async function appendChunked(notion: any, pageId: string, blocks: any[]) {
  for (let i = 0; i < blocks.length; i += 100) {
    await notionPacer.wait();
    await notion.blocks.children.append({
      block_id: pageId,
      children: blocks.slice(i, i + 100),
    });
  }
}

worker.tool("diffShadowVsReal", {
  title: "Diff Shadow vs Real",
  description:
    "Compare the shadow customer-requests DB against the real one. Writes a Diff Report page with a PREVIEW MODE banner, a Reviewer Agent summary (Safe/Review/Risky counts), and per-row blocks showing the Reviewer's verdict, red/green before/after callouts, and a default-checked to_do (default-UNCHECKED for Risky rows). Use this when the user says 'show me the diff' or 'compare shadow and real'.",
  schema: j.object({}),
  execute: async (_input, { notion }) => {
    const realDbId = process.env.REQUESTS_DB_ID;
    const shadowDbId = process.env.REQUESTS_SHADOW_DB_ID;
    const reportPageId = process.env.DIFF_REPORT_PAGE_ID;
    if (!realDbId || !shadowDbId || !reportPageId) {
      throw new Error(
        "Missing env: REQUESTS_DB_ID, REQUESTS_SHADOW_DB_ID, DIFF_REPORT_PAGE_ID must all be set.",
      );
    }

    await notionPacer.wait();
    const realPages = await fetchAllRows(notion, realDbId);
    await notionPacer.wait();
    const shadowPages = await fetchAllRows(notion, shadowDbId);

    const real = realPages.map(rowFromPage).filter((r) => r.requestId);
    const shadow = shadowPages.map(rowFromPage).filter((r) => r.requestId);

    // Build shadow lookup by Request ID so the renderer can pull Risk Verdict /
    // Risk Reason per row.
    const shadowById = new Map<string, any>();
    for (const p of shadowPages) {
      const id = getProp(p, "Request ID");
      if (id) shadowById.set(id, p);
    }

    const diffs = computeDiff(real, shadow);
    const blocks = buildBlocks(diffs, shadowById);

    // Skip clearing old content — the parallel delete phase consistently hits
    // the worker timeout when the page has >50 existing blocks. Instead,
    // prepend a clear "═══ NEW RUN ═══" separator so the latest report is
    // visually distinct. Page grows over time, latest always at the bottom.
    const separator = [
      {
        object: "block",
        type: "divider",
        divider: {},
      },
      {
        object: "block",
        type: "callout",
        callout: {
          color: "default",
          icon: { type: "emoji", emoji: "🔽" },
          rich_text: [
            {
              type: "text",
              text: { content: `NEW RUN — ${new Date().toISOString().slice(0, 19).replace("T", " ")}` },
              annotations: { bold: true },
            },
          ],
        },
      },
    ];
    await appendChunked(notion, reportPageId, [...separator, ...blocks]);

    const verdicts = diffs.map((d) => getProp(shadowById.get(d.requestId), "Risk Verdict"));
    return {
      reportPageId,
      summary: {
        total: diffs.length,
        modified: diffs.filter((d) => d.kind === "modified").length,
        added: diffs.filter((d) => d.kind === "added").length,
        deleted: diffs.filter((d) => d.kind === "deleted").length,
        safe: verdicts.filter((v) => v === "Safe").length,
        review: verdicts.filter((v) => v === "Review").length,
        risky: verdicts.filter((v) => v === "Risky").length,
      },
    };
  },
});

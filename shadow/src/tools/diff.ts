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

// GitHub-PR aesthetic: header + per-row to_do (default checked) + red/green
// callouts for before/after. The Severity Score field gets a "NEW PROPERTY"
// callout the first time it appears for a row (i.e., before was empty), to
// highlight the schema-level change in the demo.
function buildBlocks(diffs: RowDiff[]) {
  const blocks: any[] = [];

  blocks.push({
    object: "block",
    type: "heading_1",
    heading_1: {
      rich_text: [
        { type: "text", text: { content: `Diff Report — ${new Date().toISOString()}` } },
      ],
    },
  });

  const modified = diffs.filter((d) => d.kind === "modified").length;
  const added = diffs.filter((d) => d.kind === "added").length;
  const deleted = diffs.filter((d) => d.kind === "deleted").length;

  blocks.push(
    calloutBlock(
      "📝",
      "gray_background",
      `Files changed: ${diffs.length} rows (${modified} modified, ${added} added, ${deleted} deleted)`,
    ),
  );

  if (diffs.length === 0) {
    blocks.push(
      calloutBlock("✅", "green_background", "No changes detected. Shadow matches real."),
    );
    return blocks;
  }

  blocks.push({
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: [{ type: "text", text: { content: "Modified rows" } }] },
  });

  for (const d of diffs) {
    // to_do block is the promote tool's contract. Default checked so the
    // demoer unchecks the rows they want to reject (more cinematic than
    // checking 15 of 18).
    blocks.push({
      object: "block",
      type: "to_do",
      to_do: {
        checked: true,
        rich_text: [{ type: "text", text: { content: `Request ID: ${d.requestId}` } }],
      },
    });

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
      // Severity Score: emit a NEW PROPERTY badge the first time it appears.
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
        calloutBlock(
          "➖",
          "red_background",
          `${delta.field}: ${delta.before || "(empty)"}`,
        ),
      );
      blocks.push(
        calloutBlock("➕", "green_background", `${delta.field}: ${delta.after}`),
      );
    }
  }

  return blocks;
}

async function clearChildren(notion: any, pageId: string) {
  const existing = await fetchAllBlockChildren(notion, pageId);
  for (const block of existing) {
    await notionPacer.wait();
    try {
      await notion.blocks.delete({ block_id: block.id });
    } catch (_e) {
      // Already deleted or not deletable. Skip.
    }
  }
}

async function appendChunked(notion: any, pageId: string, blocks: any[]) {
  // Notion caps appends at 100 blocks per request.
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
    "Compare the shadow customer-requests DB against the real one. Writes a Diff Report page showing every modified row, with red/green callouts for before/after values and to_do checkboxes per row. Use this when the user says 'show me the diff' or 'compare shadow and real'.",
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

    const diffs = computeDiff(real, shadow);
    const blocks = buildBlocks(diffs);

    await clearChildren(notion, reportPageId);
    await appendChunked(notion, reportPageId, blocks);

    return {
      reportPageId,
      summary: {
        total: diffs.length,
        modified: diffs.filter((d) => d.kind === "modified").length,
        added: diffs.filter((d) => d.kind === "added").length,
        deleted: diffs.filter((d) => d.kind === "deleted").length,
      },
    };
  },
});

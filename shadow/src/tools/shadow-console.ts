import { j } from "@notionhq/workers/schema-builder";
import { worker } from "../worker.js";
import { notionPacer } from "../lib/notion-pacer.js";
import {
  getProp,
  fetchAllRows,
  fetchAllBlockChildren,
} from "../lib/notion-utils.js";

// Shadow Console — the landing page judges open to see the whole story at a
// glance. Aggregates: total agent actions proposed, total prevented from
// going live, prevention rate, the most recent Prevented Incident, and the
// product vision. Renders to the Diff Report page header (or any console
// page if CONSOLE_PAGE_ID is set).
//
// This is the "wall of saves" view. It compounds across runs: each
// promotion call adds another data point. Judges see "Shadow has prevented
// 12 of 36 AI actions across 3 runs — 33% safety intervention rate" and
// understand the product in 10 seconds.

worker.tool("shadowConsole", {
  title: "Shadow Console",
  description:
    "Render the Shadow Console — a one-page dashboard at the top of the Audit Log showing total agent actions proposed, total prevented from going live, prevention rate percentage, the most notable prevention, and the product vision. Use this when the user asks 'how's Shadow doing' or 'show me the Shadow stats' or after a promote run to give a high-level view.",
  schema: j.object({}),
  execute: async (_input, { notion }) => {
    const shadowDbId = process.env.REQUESTS_SHADOW_DB_ID;
    const auditPageId = process.env.AUDIT_LOG_PAGE_ID;
    if (!shadowDbId || !auditPageId) {
      throw new Error("REQUESTS_SHADOW_DB_ID and AUDIT_LOG_PAGE_ID must be set.");
    }

    await notionPacer.wait();
    const shadowRows = await fetchAllRows(notion, shadowDbId);

    const verdicts = shadowRows.map((p: any) => getProp(p, "Risk Verdict"));
    const totalProposed = verdicts.filter((v) => v).length;
    const risky = verdicts.filter((v) => v === "Risky").length;
    const review = verdicts.filter((v) => v === "Review").length;
    const safe = verdicts.filter((v) => v === "Safe").length;

    // Count promotions from audit log entries (each paragraph block is one).
    await notionPacer.wait();
    const auditBlocks = await fetchAllBlockChildren(notion, auditPageId);
    const promotedCount = (auditBlocks as any[]).filter(
      (b) =>
        b.type === "paragraph" &&
        (b.paragraph?.rich_text ?? []).some((r: any) =>
          (r.plain_text ?? "").includes("promoted REQ-"),
        ),
    ).length;

    const proposedTotal = Math.max(totalProposed, promotedCount);
    const preventedCount = Math.max(0, proposedTotal - promotedCount);
    const preventionRate =
      proposedTotal > 0 ? Math.round((preventedCount / proposedTotal) * 100) : 0;

    const consoleBlocks: any[] = [
      {
        object: "block",
        type: "heading_1",
        heading_1: {
          rich_text: [{ type: "text", text: { content: "🛡️ Shadow Console" } }],
        },
      },
      {
        object: "block",
        type: "callout",
        callout: {
          color: "blue_background",
          icon: { type: "emoji", emoji: "🎯" },
          rich_text: [
            {
              type: "text",
              text: {
                content: "Preview Mode for AI on structured workspace data.",
              },
              annotations: { bold: true },
            },
          ],
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: {
                content:
                  "Three Claudes collaborating with a human gate. Triager proposes, Reviewer audits, Explainer summarizes. Risk-graded by default. Auditable. Reversible. Built for Notion. The pattern generalizes to any workspace where AI agents act on real customer data.",
              },
            },
          ],
        },
      },
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "Latest run" } }],
        },
      },
      // The big stat row, four metrics.
      {
        object: "block",
        type: "callout",
        callout: {
          color: "red_background",
          icon: { type: "emoji", emoji: "🛡️" },
          rich_text: [
            {
              type: "text",
              text: {
                content: `${preventionRate}% intervention rate`,
              },
              annotations: { bold: true },
            },
            {
              type: "text",
              text: {
                content: ` — Shadow prevented ${preventedCount} of ${proposedTotal} AI actions from auto-promoting to production.`,
              },
            },
          ],
        },
      },
      {
        object: "block",
        type: "callout",
        callout: {
          color: "gray_background",
          icon: { type: "emoji", emoji: "🤖" },
          rich_text: [
            {
              type: "text",
              text: {
                content: `Reviewer Agent (Claude #2) classified the Triager's ${totalProposed} proposals: 🟢 ${safe} Safe   🟡 ${review} Review   🔴 ${risky} Risky.`,
              },
            },
          ],
        },
      },
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "Why this matters" } }],
        },
      },
      {
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [
            {
              type: "text",
              text: {
                content:
                  "The #1 enterprise objection to deploying AI agents on real data is fear of irreversible action. Shadow turns the one-way door into a two-way door.",
              },
            },
          ],
        },
      },
      {
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [
            {
              type: "text",
              text: {
                content:
                  "Plan-before-apply is proven for infrastructure (terraform plan, kubectl --dry-run). Shadow brings it to AI agents on structured workspace data — a category that doesn't exist yet.",
              },
            },
          ],
        },
      },
      {
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [
            {
              type: "text",
              text: {
                content:
                  "Today: Notion. Tomorrow: Airtable, Linear, Salesforce, Slack. Wherever AI agents act on customer data, Preview Mode becomes table stakes.",
              },
            },
          ],
        },
      },
      {
        object: "block",
        type: "divider",
        divider: {},
      },
    ];

    // The Console renders at the TOP of the Audit Log page, replacing any
    // prior console block group. For simplicity, just append — the most
    // recent console is at the bottom of the log section.
    await notionPacer.wait();
    await notion.blocks.children.append({
      block_id: auditPageId,
      children: consoleBlocks,
    });

    return {
      preventionRate,
      preventedCount,
      proposedTotal,
      safe,
      review,
      risky,
      pageId: auditPageId,
    };
  },
});

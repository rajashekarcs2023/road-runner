import { j } from "@notionhq/workers/schema-builder";
import { worker } from "../worker.js";
import { notionPacer } from "../lib/notion-pacer.js";
import {
  getProp,
  fetchAllRows,
  fetchAllBlockChildren,
} from "../lib/notion-utils.js";
import Anthropic from "@anthropic-ai/sdk";

// Closing-beat tool. After a promote run, the user invokes this to generate
// a structured run summary at the top of the Audit Log: how many rows the
// Reviewer flagged, what the human accepted vs rejected, and the single most
// notable safety prevention that happened in this run.
//
// This is the explainability layer for the multi-agent supervision pipeline.

const SYSTEM_PROMPT = `You are summarizing a Shadow run. You will see a list of rows the human accepted to promote and rows they rejected, along with each row's Risk Verdict from the Reviewer agent and the inbound text. Write a short summary (3-4 short paragraphs max) for an audit log header.

Output a JSON object. No markdown fence. No preamble.

{
  "headline": "one short sentence summarizing the run",
  "highlights": ["1-2 sentence bullet", "another bullet", "another bullet"],
  "notable_prevention": "one short sentence calling out the single most important thing the Reviewer or human prevented from going live, OR null if nothing notable was prevented"
}

Style:
- Be specific. Reference request IDs and content. No corporate filler.
- Highlight cases where the Reviewer's verdict matched the human's decision (validation) AND cases where the human overrode the Reviewer (calibration signal).
- The notable_prevention is the single sentence a CTO would care about — what would have gone wrong if this hadn't been previewed.`;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

function extractJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    // continue
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // continue
    }
  }
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) return JSON.parse(obj[0]);
  throw new Error("No JSON in response");
}

worker.tool("explainPromotion", {
  title: "Explain Last Promotion",
  description:
    "Read the recent state of the shadow + audit log and generate a structured run summary at the top of the Audit Log page. Calls Claude to write the summary. Use this AFTER promoteSelected has run — the user might say 'explain what happened' or 'summarize the run'.",
  schema: j.object({}),
  execute: async (_input, { notion }) => {
    const shadowDbId = process.env.REQUESTS_SHADOW_DB_ID;
    const auditPageId = process.env.AUDIT_LOG_PAGE_ID;
    if (!shadowDbId || !auditPageId) {
      throw new Error("REQUESTS_SHADOW_DB_ID and AUDIT_LOG_PAGE_ID must be set.");
    }

    await notionPacer.wait();
    const shadowRows = await fetchAllRows(notion, shadowDbId);

    await notionPacer.wait();
    const auditBlocks = await fetchAllBlockChildren(notion, auditPageId);
    const promotedIdSet = new Set<string>();
    for (const b of auditBlocks as any[]) {
      const flat = (b.paragraph?.rich_text ?? [])
        .map((r: any) => r.plain_text ?? "")
        .join("");
      const m = flat.match(/REQ-\d+/);
      if (m) promotedIdSet.add(m[0]);
    }

    const rowSummaries = shadowRows
      .map((p: any) => ({
        id: getProp(p, "Request ID"),
        inbound: getProp(p, "Inbound Text").slice(0, 200),
        priority: getProp(p, "Priority"),
        owner: getProp(p, "Owner"),
        verdict: getProp(p, "Risk Verdict"),
        reason: getProp(p, "Risk Reason"),
        promoted: promotedIdSet.has(getProp(p, "Request ID")),
      }))
      .filter((r) => r.id);

    const accepted = rowSummaries.filter((r) => r.promoted);
    const rejected = rowSummaries.filter((r) => !r.promoted);

    const c = getClient();
    const userMessage = [
      `Accepted (${accepted.length}):`,
      ...accepted.map(
        (r) =>
          `  ${r.id} [${r.verdict}] Priority=${r.priority} Owner=${r.owner} — reviewer: ${r.reason} — inbound: "${r.inbound}"`,
      ),
      "",
      `Rejected (${rejected.length}):`,
      ...rejected.map(
        (r) =>
          `  ${r.id} [${r.verdict}] Priority=${r.priority} Owner=${r.owner} — reviewer: ${r.reason} — inbound: "${r.inbound}"`,
      ),
    ].join("\n");

    const response = await c.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    const text = (response.content[0] as any)?.text ?? "";
    const parsed = extractJson(text);
    const headline =
      typeof parsed?.headline === "string" ? parsed.headline : `Shadow run: ${accepted.length} accepted, ${rejected.length} rejected.`;
    const highlights: string[] = Array.isArray(parsed?.highlights) ? parsed.highlights : [];
    const notable: string | null =
      typeof parsed?.notable_prevention === "string" ? parsed.notable_prevention : null;

    const ts = new Date().toISOString().slice(0, 19).replace("T", " ");
    const blocks: any[] = [
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: `🤖 Run summary — ${ts}` } }],
        },
      },
      {
        object: "block",
        type: "callout",
        callout: {
          color: "blue_background",
          icon: { type: "emoji", emoji: "📣" },
          rich_text: [{ type: "text", text: { content: headline } }],
        },
      },
      ...highlights.slice(0, 3).map((h) => ({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ type: "text", text: { content: String(h).slice(0, 500) } }],
        },
      })),
    ];

    if (notable) {
      blocks.push({
        object: "block",
        type: "callout",
        callout: {
          color: "red_background",
          icon: { type: "emoji", emoji: "🛡️" },
          rich_text: [
            {
              type: "text",
              text: { content: `Prevented by Preview Mode: ${notable}` },
            },
          ],
        },
      });
    }

    blocks.push({
      object: "block",
      type: "divider",
      divider: {},
    });

    await notionPacer.wait();
    await notion.blocks.children.append({ block_id: auditPageId, children: blocks });

    return {
      headline,
      highlights,
      notable_prevention: notable,
      accepted: accepted.length,
      rejected: rejected.length,
    };
  },
});

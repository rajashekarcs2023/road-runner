import { j } from "@notionhq/workers/schema-builder";
import { worker } from "../worker.js";
import { notionPacer } from "../lib/notion-pacer.js";
import { getProp, fetchAllRows } from "../lib/notion-utils.js";
import { triageOneRow, type TriageResult } from "../lib/anthropic.js";

worker.tool("triageShadow", {
  title: "Triage Shadow",
  description:
    "Classify and prioritize every row in the shadow customer-requests DB. Sets Priority, Owner, Classification, Severity Score (0-100), and a Draft Response per row. Adds the Severity Score property if it was not already populated. Does NOT touch the real DB. Use this when the user says 'triage everything in the shadow' or similar.",
  schema: j.object({}),
  execute: async (_input, { notion }) => {
    const shadowDbId = process.env.REQUESTS_SHADOW_DB_ID;
    if (!shadowDbId) {
      throw new Error("REQUESTS_SHADOW_DB_ID is not set in the worker env.");
    }

    await notionPacer.wait();
    const rows = await fetchAllRows(notion, shadowDbId);

    // Phase 1: parallel Claude inference. Anthropic tolerates concurrent
    // requests fine. ~3s for 18 rows.
    const inferences = await Promise.all(
      rows.map(async (row: any) => {
        try {
          const inbound = getProp(row, "Inbound Text");
          const data = await triageOneRow(inbound);
          return { row, data, ok: true as const };
        } catch (e: any) {
          return { row, ok: false as const, error: String(e?.message ?? e) };
        }
      }),
    );

    // Phase 2: throttled Notion writes via the shared notionPacer. ~6s at 3
    // req/s. The visible "watching the agent work" beat comes from this phase.
    const summary = { touched: 0, errors: 0, errorMessages: [] as string[] };
    for (const item of inferences) {
      if (!item.ok) {
        summary.errors++;
        summary.errorMessages.push(item.error);
        continue;
      }
      const { row, data } = item as { row: any; data: TriageResult };
      try {
        await notionPacer.wait();
        await notion.pages.update({
          page_id: row.id,
          properties: {
            Priority: { select: { name: data.priority } },
            Owner: { select: { name: data.owner } },
            Classification: {
              rich_text: [{ text: { content: data.classification } }],
            },
            "Severity Score": { number: data.severityScore },
            "Draft Response": { rich_text: [{ text: { content: data.draft } }] },
            Status: { select: { name: "Triaged" } },
            "Last Touched": { date: { start: new Date().toISOString() } },
          },
        });
        summary.touched++;
      } catch (e: any) {
        summary.errors++;
        summary.errorMessages.push(String(e?.message ?? e));
      }
    }
    return summary;
  },
});

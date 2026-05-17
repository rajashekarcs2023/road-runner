import { j } from "@notionhq/workers/schema-builder";
import { worker } from "../worker.js";
import { notionPacer } from "../lib/notion-pacer.js";
import { getProp, fetchAllRows } from "../lib/notion-utils.js";

// Imperative replacement for the worker.sync. Reads every row from the real
// DB, archives all rows in the shadow DB, then creates fresh rows in the
// shadow matching real. The shadow DB is a regular user-owned DB (created
// via scripts/setup-shadow-db.ts), so all its properties are writable by
// downstream tools (triage, promote).

worker.tool("shadowThisDB", {
  title: "Shadow this DB",
  description:
    "Mirror the real Customer Requests DB into the shadow DB. Archives existing shadow rows and creates fresh copies matching the real DB. Use this when the user says 'shadow this DB' or 'sync shadow' or before any triage/diff session.",
  schema: j.object({}),
  execute: async (_input, { notion }) => {
    const realDbId = process.env.REQUESTS_DB_ID;
    const shadowDbId = process.env.REQUESTS_SHADOW_DB_ID;
    if (!realDbId || !shadowDbId) {
      throw new Error("REQUESTS_DB_ID and REQUESTS_SHADOW_DB_ID must be set.");
    }

    await notionPacer.wait();
    const realRows = await fetchAllRows(notion, realDbId);

    await notionPacer.wait();
    const shadowRows = await fetchAllRows(notion, shadowDbId);

    // Archive any existing shadow rows. Replace-mode semantics.
    let archived = 0;
    for (const row of shadowRows) {
      try {
        await notionPacer.wait();
        await notion.pages.update({ page_id: row.id, archived: true } as any);
        archived++;
      } catch (_e) {
        // continue
      }
    }

    // Create fresh shadow rows mirroring real.
    let created = 0;
    const errors: string[] = [];
    for (const realRow of realRows) {
      const requestId = getProp(realRow, "Request ID");
      if (!requestId) continue;
      try {
        await notionPacer.wait();
        await notion.pages.create({
          parent: { database_id: shadowDbId },
          properties: {
            Name: {
              title: [{ text: { content: getProp(realRow, "Name") || requestId } }],
            },
            "Request ID": { rich_text: [{ text: { content: requestId } }] },
            Priority: { select: { name: getProp(realRow, "Priority") || "Low" } },
            Owner: { select: { name: getProp(realRow, "Owner") || "Unassigned" } },
            Status: { select: { name: getProp(realRow, "Status") || "Inbox" } },
            "Inbound Text": {
              rich_text: [{ text: { content: getProp(realRow, "Inbound Text") } }],
            },
            "Draft Response": { rich_text: [{ text: { content: "" } }] },
            Classification: { rich_text: [{ text: { content: "" } }] },
          },
        } as any);
        created++;
      } catch (e: any) {
        errors.push(`${requestId}: ${e?.message ?? String(e)}`);
      }
    }

    return {
      mirrored: created,
      archivedFromShadow: archived,
      realRowCount: realRows.length,
      errors,
    };
  },
});

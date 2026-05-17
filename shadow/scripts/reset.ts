// Demo rehearsal reset. Wipes real DB rows, shadow DB rows, Diff Report
// children, and Audit Log children — then re-seeds. Lets you run the 60-second
// demo flow back-to-back during hour 9 rehearsals without manual cleanup.
//
// Usage: bun run scripts/reset.ts

import { Client } from "@notionhq/client";
import "dotenv/config";

const PACE_MS = 350; // ~3 req/s

async function archiveAllRows(notion: Client, dbId: string, label: string) {
  let count = 0;
  let cursor: string | undefined = undefined;
  do {
    const resp: any = await notion.databases.query({
      database_id: dbId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const page of resp.results) {
      await notion.pages.update({ page_id: page.id, archived: true } as any);
      count++;
      await new Promise((r) => setTimeout(r, PACE_MS));
    }
    cursor = resp.has_more ? resp.next_cursor : undefined;
  } while (cursor);
  console.log(`  Archived ${count} rows from ${label}`);
}

async function clearPageChildren(notion: Client, pageId: string, label: string) {
  let count = 0;
  let cursor: string | undefined = undefined;
  do {
    const resp: any = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const block of resp.results) {
      try {
        await notion.blocks.delete({ block_id: block.id });
        count++;
      } catch (_e) {
        // skip
      }
      await new Promise((r) => setTimeout(r, PACE_MS));
    }
    cursor = resp.has_more ? resp.next_cursor : undefined;
  } while (cursor);
  console.log(`  Cleared ${count} blocks from ${label}`);
}

async function main() {
  const token = process.env.NOTION_API_TOKEN;
  const realDbId = process.env.REQUESTS_DB_ID;
  const shadowDbId = process.env.REQUESTS_SHADOW_DB_ID;
  const diffPageId = process.env.DIFF_REPORT_PAGE_ID;
  const auditPageId = process.env.AUDIT_LOG_PAGE_ID;

  if (!token || !realDbId || !shadowDbId || !diffPageId || !auditPageId) {
    console.error("Missing env. Need NOTION_API_TOKEN, REQUESTS_DB_ID, REQUESTS_SHADOW_DB_ID, DIFF_REPORT_PAGE_ID, AUDIT_LOG_PAGE_ID.");
    process.exit(1);
  }

  const notion = new Client({ auth: token });

  console.log("Resetting demo state...");
  await archiveAllRows(notion, realDbId, "real DB");
  await archiveAllRows(notion, shadowDbId, "shadow DB");
  await clearPageChildren(notion, diffPageId, "Diff Report");
  await clearPageChildren(notion, auditPageId, "Audit Log");
  console.log("Reset complete. Now run: bun run scripts/seed.ts");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Creates the two support pages (Diff Report and Audit Log) under the same
// parent page used by setup-db.ts. The integration inherits access from the
// parent so no manual Connection step is needed.
//
// Usage: bun run setup-pages
// Output: prints the two page IDs for pasting into .env.

import { Client } from "@notionhq/client";
import "dotenv/config";

async function createBlankPage(notion: Client, parentId: string, title: string): Promise<string> {
  const page = await notion.pages.create({
    parent: { type: "page_id", page_id: parentId },
    properties: {
      title: { title: [{ type: "text", text: { content: title } }] },
    },
  });
  return page.id;
}

async function main() {
  const token = process.env.NOTION_API_TOKEN;
  const parentPageId = process.env.NOTION_PARENT_PAGE_ID;

  if (!token || !parentPageId) {
    console.error("Missing NOTION_API_TOKEN or NOTION_PARENT_PAGE_ID in .env.");
    process.exit(1);
  }

  const notion = new Client({ auth: token });

  console.log("Creating support pages under parent...");
  const diffReportId = await createBlankPage(notion, parentPageId, "Diff Report");
  console.log(`  ✓ Diff Report     : ${diffReportId}`);
  const auditLogId = await createBlankPage(notion, parentPageId, "Audit Log");
  console.log(`  ✓ Audit Log       : ${auditLogId}`);

  console.log("\nPaste these into .env:");
  console.log(`  DIFF_REPORT_PAGE_ID=${diffReportId}`);
  console.log(`  AUDIT_LOG_PAGE_ID=${auditLogId}`);
  console.log(
    "\nThese pages inherit the parent's integration connection. No manual Connections step needed.",
  );
}

main().catch((e) => {
  console.error("setup-pages failed:", e?.body ?? e?.message ?? e);
  process.exit(1);
});

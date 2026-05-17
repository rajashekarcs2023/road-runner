// One-time setup. Creates the "Customer Requests" real Notion database
// programmatically with the full schema (including the Severity Score column
// that the agent will fill in via triage).
//
// Usage:
//   1. Create an empty Notion page in your demo workspace (call it whatever).
//      Click the three-dot menu -> Connections -> add your integration.
//      Copy its page ID from the URL and set NOTION_PARENT_PAGE_ID in .env.
//   2. bun run setup-db
//   3. Copy the printed REQUESTS_DB_ID into .env.
//
// Then run `bun run seed` to populate 18 rows.

import { Client } from "@notionhq/client";
import "dotenv/config";

async function main() {
  const token = process.env.NOTION_API_TOKEN;
  const parentPageId = process.env.NOTION_PARENT_PAGE_ID;

  if (!token) {
    console.error("Missing NOTION_API_TOKEN in .env.");
    process.exit(1);
  }
  if (!parentPageId) {
    console.error(
      "Missing NOTION_PARENT_PAGE_ID in .env.\n" +
        "Create an empty Notion page in your workspace, connect your integration to it, " +
        "and paste its page ID into .env as NOTION_PARENT_PAGE_ID.",
    );
    process.exit(1);
  }

  const notion = new Client({ auth: token });

  console.log("Creating Customer Requests DB under parent page...");
  const db = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: "Customer Requests" } }],
    properties: {
      Name: { title: {} },
      "Request ID": { rich_text: {} },
      Priority: {
        select: {
          options: [
            { name: "Low", color: "gray" },
            { name: "Medium", color: "yellow" },
            { name: "High", color: "orange" },
            { name: "Urgent", color: "red" },
          ],
        },
      },
      Owner: {
        select: {
          options: [
            { name: "Unassigned", color: "default" },
            { name: "Support", color: "blue" },
            { name: "Security", color: "red" },
            { name: "Sales", color: "green" },
            { name: "Engineering", color: "purple" },
          ],
        },
      },
      Status: {
        select: {
          options: [
            { name: "Inbox", color: "gray" },
            { name: "Triaged", color: "blue" },
            { name: "In Progress", color: "yellow" },
            { name: "Resolved", color: "green" },
          ],
        },
      },
      "Inbound Text": { rich_text: {} },
      "Draft Response": { rich_text: {} },
      Classification: { rich_text: {} },
      "Severity Score": { number: { format: "number" } },
      "Last Touched": { date: {} },
    },
  });

  console.log("\n✓ Customer Requests DB created.");
  console.log(`  ID: ${db.id}`);
  console.log(`  URL: ${(db as any).url ?? "(check Notion for the URL)"}`);
  console.log("\nNext steps:");
  console.log("  1. Paste this ID into .env as REQUESTS_DB_ID=<id>");
  console.log("  2. Run: bun run seed");
  console.log(
    "\nThe parent page must remain connected to your integration. The new DB " +
      "inherits that connection automatically.",
  );
}

main().catch((e) => {
  console.error("setup-db failed:", e?.body ?? e?.message ?? e);
  process.exit(1);
});

// Creates the user-owned shadow DB programmatically with the same schema as
// the real DB. Required because worker.sync-managed DBs are read-only to
// tools — and our triage tool needs to write to the shadow.
//
// Usage:
//   bun run setup-shadow-db
//
// Then paste the printed ID into .env as REQUESTS_SHADOW_DB_ID, and
// `ntn workers env set REQUESTS_SHADOW_DB_ID=<id>`.

import { Client } from "@notionhq/client";
import "dotenv/config";

async function main() {
  const token = process.env.NOTION_API_TOKEN;
  const parentPageId = process.env.NOTION_PARENT_PAGE_ID;

  if (!token || !parentPageId) {
    console.error("Missing NOTION_API_TOKEN or NOTION_PARENT_PAGE_ID in .env.");
    process.exit(1);
  }

  const notion = new Client({ auth: token });

  console.log("Creating Customer Requests (Shadow) DB under parent page...");
  const db = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: "Customer Requests (Shadow)" } }],
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

  console.log("\n✓ Customer Requests (Shadow) DB created.");
  console.log(`  ID: ${db.id}`);
  console.log("\nNext steps:");
  console.log(`  1. Paste this ID into .env as REQUESTS_SHADOW_DB_ID=${db.id}`);
  console.log(`  2. ntn workers env set REQUESTS_SHADOW_DB_ID=${db.id}`);
  console.log(`  3. ntn workers exec shadowThisDB -d '{}'`);
}

main().catch((e) => {
  console.error("setup-shadow-db failed:", e?.body ?? e?.message ?? e);
  process.exit(1);
});

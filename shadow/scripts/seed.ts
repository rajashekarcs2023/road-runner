// Demo data seeder. Populates the real DB with 18 representative customer
// requests, varied across Security / Engineering / Sales / Support, with two
// Urgent-triggering rows so the demo's priority distribution shows range.
//
// Run AFTER first deploy + env config (the DB ID is only known after deploy):
//   1. ntn workers deploy
//   2. Capture REQUESTS_DB_ID from the worker logs
//   3. Update .env
//   4. bun run scripts/seed.ts

import { Client } from "@notionhq/client";
import "dotenv/config";

const SEED_ROWS = [
  { id: "REQ-001", text: "Do you support SSO, SAML, SOC2, HIPAA, and enterprise pricing? Need procurement docs by EOW." },
  { id: "REQ-002", text: "Login is broken for everyone on Chrome since this morning. We are dead in the water. URGENT." },
  { id: "REQ-003", text: "Can I get a student discount? Building a side project for my CS class." },
  { id: "REQ-004", text: "Production API has been returning 503 for 20 minutes. All our customers are affected. Please respond ASAP." },
  { id: "REQ-005", text: "Need a copy of your SOC2 Type II report for our procurement team. Compliance audit next week." },
  { id: "REQ-006", text: "What's your enterprise pricing for 500 seats? Considering switching from a competitor." },
  { id: "REQ-007", text: "The export-to-CSV feature is generating empty files for one of our larger workspaces (>10k rows)." },
  { id: "REQ-008", text: "Can you send me a copy of last month's invoice? Accounting is asking for it." },
  { id: "REQ-009", text: "I'm getting a 500 error when trying to share a page externally. Browser console shows a JSON parse error." },
  { id: "REQ-010", text: "Does your platform support HIPAA-compliant data handling? We're a healthcare company evaluating vendors." },
  { id: "REQ-011", text: "How do I change the workspace owner? Our previous admin left the company." },
  { id: "REQ-012", text: "Refund request for last month — we were billed for two seats we don't use anymore." },
  { id: "REQ-013", text: "Trying to integrate via your API but getting 401 Unauthorized even with a fresh token. Docs link?" },
  { id: "REQ-014", text: "Are you on the FedRAMP marketplace? We're a federal contractor and need that for procurement." },
  { id: "REQ-015", text: "Just wanted to say the new dashboard redesign looks great. Question: where did the filter sidebar go?" },
  { id: "REQ-016", text: "We need a custom security review and willing to sign an NDA. Can you connect me with your security team?" },
  { id: "REQ-017", text: "How do I reset my password? The reset email is not arriving in my inbox." },
  { id: "REQ-018", text: "Pentest schedule — we're required to run an annual third-party pentest. Do you have a results summary we can review?" },
];

async function main() {
  const token = process.env.NOTION_API_TOKEN;
  const dbId = process.env.REQUESTS_DB_ID;
  if (!token || !dbId) {
    console.error("Missing env. Set NOTION_API_TOKEN and REQUESTS_DB_ID in .env.");
    process.exit(1);
  }

  const notion = new Client({ auth: token });

  console.log(`Seeding ${SEED_ROWS.length} rows into REQUESTS_DB_ID=${dbId.slice(0, 8)}...`);

  for (const row of SEED_ROWS) {
    await notion.pages.create({
      parent: { database_id: dbId },
      properties: {
        Name: { title: [{ text: { content: row.text.slice(0, 80) } }] },
        "Request ID": { rich_text: [{ text: { content: row.id } }] },
        "Inbound Text": { rich_text: [{ text: { content: row.text } }] },
        Priority: { select: { name: "Low" } },
        Owner: { select: { name: "Unassigned" } },
        Status: { select: { name: "Inbox" } },
        "Last Touched": { date: { start: new Date().toISOString() } },
      },
    });
    console.log(`  ✓ ${row.id}`);
    // Soft pace — Notion API limits to ~3 req/s.
    await new Promise((r) => setTimeout(r, 350));
  }

  console.log("Done. Next: ntn workers sync trigger shadowReplaceSync");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

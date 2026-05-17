import { Client } from "@notionhq/client";
import "dotenv/config";

async function main() {
  const token = process.env.NOTION_API_TOKEN;
  const shadowDbId = process.env.REQUESTS_SHADOW_DB_ID;
  if (!token || !shadowDbId) {
    console.error("Missing NOTION_API_TOKEN or REQUESTS_SHADOW_DB_ID.");
    process.exit(1);
  }
  const notion = new Client({ auth: token });
  console.log("Patching shadow DB for PII redaction layer...");
  await notion.databases.update({
    database_id: shadowDbId,
    properties: {
      "PII Redacted": { rich_text: {} },
    },
  } as any);
  console.log("✓ Schema patched. Added: PII Redacted.");
}
main().catch((e) => { console.error("Patch failed:", e?.body ?? e?.message ?? e); process.exit(1); });

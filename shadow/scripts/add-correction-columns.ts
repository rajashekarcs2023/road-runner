// One-shot schema patch. Adds Correction Applied + Original Draft fields so
// the AI self-correction loop has somewhere to write.

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

  console.log("Patching shadow DB schema for AI self-correction...");
  await notion.databases.update({
    database_id: shadowDbId,
    properties: {
      "Correction Applied": {
        select: {
          options: [
            { name: "Yes", color: "blue" },
            { name: "No", color: "default" },
          ],
        },
      },
      "Original Draft": { rich_text: {} },
    },
  } as any);
  console.log("✓ Schema patched. Added: Correction Applied, Original Draft.");
}

main().catch((e) => {
  console.error("Patch failed:", e?.body ?? e?.message ?? e);
  process.exit(1);
});

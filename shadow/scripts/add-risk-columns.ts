// One-shot schema patch. Adds Risk Verdict + Risk Reason to the shadow DB so
// the Reviewer Agent has somewhere to write its assessment. Shadow-only —
// these are commentary on changes, not promoted to real.

import { Client } from "@notionhq/client";
import "dotenv/config";

async function main() {
  const token = process.env.NOTION_API_TOKEN;
  const shadowDbId = process.env.REQUESTS_SHADOW_DB_ID;
  if (!token || !shadowDbId) {
    console.error("Missing NOTION_API_TOKEN or REQUESTS_SHADOW_DB_ID in .env.");
    process.exit(1);
  }
  const notion = new Client({ auth: token });

  console.log("Patching shadow DB schema to add Risk Verdict + Risk Reason...");
  await notion.databases.update({
    database_id: shadowDbId,
    properties: {
      "Risk Verdict": {
        select: {
          options: [
            { name: "Safe", color: "green" },
            { name: "Review", color: "yellow" },
            { name: "Risky", color: "red" },
          ],
        },
      },
      "Risk Reason": { rich_text: {} },
    },
  } as any);
  console.log("✓ Schema patched.");
}

main().catch((e) => {
  console.error("Patch failed:", e?.body ?? e?.message ?? e);
  process.exit(1);
});

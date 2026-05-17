// Setup verifier. Run BEFORE deploying or rehearsing to confirm:
//   - All env vars are present
//   - The Notion API token works
//   - All required pages/DBs exist and the integration is connected to them
//   - The Anthropic API key works
//
// Usage: bun run doctor
//
// Outputs a checklist with pass/fail per item. Exits nonzero if any fail.

import { Client } from "@notionhq/client";
import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

type Severity = "pass" | "fail" | "pending";
type Check = { name: string; severity: Severity; detail: string };

const checks: Check[] = [];

function check(name: string, severity: Severity, detail: string) {
  checks.push({ name, severity, detail });
}

async function tryNotion(label: string, fn: () => Promise<string>) {
  try {
    const detail = await fn();
    check(label, "pass", detail);
  } catch (e: any) {
    const msg = e?.body?.message ?? e?.message ?? String(e);
    check(label, "fail", msg.slice(0, 200));
  }
}

async function main() {
  console.log("Running Shadow doctor...\n");

  // 1. Env vars
  const required = ["NOTION_API_TOKEN", "ANTHROPIC_API_KEY"];
  for (const k of required) {
    const present = !!process.env[k];
    check(`env: ${k}`, present ? "pass" : "fail", present ? "set" : "missing — required");
  }

  const optional = [
    "NOTION_PARENT_PAGE_ID",
    "REQUESTS_DB_ID",
    "REQUESTS_SHADOW_DB_ID",
    "DIFF_REPORT_PAGE_ID",
    "AUDIT_LOG_PAGE_ID",
  ];
  for (const k of optional) {
    const present = !!process.env[k];
    check(`env: ${k}`, present ? "pass" : "pending", present ? "set" : "not set (populate as you complete setup)");
  }

  // 2. Notion API
  if (process.env.NOTION_API_TOKEN) {
    const notion = new Client({ auth: process.env.NOTION_API_TOKEN });

    await tryNotion("Notion API: user lookup", async () => {
      const me = await notion.users.me({});
      return `bot: ${(me as any).name ?? "(unnamed)"}, type: ${(me as any).type}`;
    });

    const idChecks: Array<[string, string | undefined, "db" | "page"]> = [
      ["Customer Requests DB", process.env.REQUESTS_DB_ID, "db"],
      ["Shadow DB", process.env.REQUESTS_SHADOW_DB_ID, "db"],
      ["Diff Report page", process.env.DIFF_REPORT_PAGE_ID, "page"],
      ["Audit Log page", process.env.AUDIT_LOG_PAGE_ID, "page"],
    ];
    for (const [label, id, kind] of idChecks) {
      if (!id) continue;
      await tryNotion(`Notion ${kind}: ${label}`, async () => {
        if (kind === "db") {
          await notion.databases.retrieve({ database_id: id });
          return "retrievable + integration connected";
        }
        await notion.pages.retrieve({ page_id: id });
        return "retrievable + integration connected";
      });
    }
  }

  // 3. Anthropic API
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const c = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const r = await c.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 16,
        messages: [{ role: "user", content: "Reply with exactly: ok" }],
      });
      const text = (r.content[0] as any)?.text ?? "";
      check("Anthropic API: messages.create", "pass", `model responded (${text.slice(0, 32)})`);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (/model/i.test(msg)) {
        try {
          const c = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          await c.messages.create({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 16,
            messages: [{ role: "user", content: "Reply with exactly: ok" }],
          });
          check(
            "Anthropic API: messages.create",
            "pass",
            "key valid; claude-sonnet-4-6 unavailable, fell back to claude-sonnet-4-5-20250929",
          );
        } catch (e2: any) {
          check("Anthropic API: messages.create", "fail", e2?.message ?? String(e2));
        }
      } else {
        check("Anthropic API: messages.create", "fail", msg.slice(0, 200));
      }
    }
  }

  // Print results.
  let pass = 0;
  let fail = 0;
  let pending = 0;
  for (const c of checks) {
    const mark = c.severity === "pass" ? "✓" : c.severity === "fail" ? "✗" : "○";
    console.log(`  ${mark}  ${c.name.padEnd(40)} ${c.detail}`);
    if (c.severity === "pass") pass++;
    else if (c.severity === "fail") fail++;
    else pending++;
  }
  console.log(
    `\n${pass} passed, ${fail} failed, ${pending} pending (not yet set up — see Next steps).`,
  );

  // Next-step suggestions based on what's pending.
  const nextSteps: string[] = [];
  if (!process.env.NOTION_PARENT_PAGE_ID) {
    nextSteps.push(
      "Create a blank page in Notion, connect the integration, paste its ID into .env as NOTION_PARENT_PAGE_ID.",
    );
  } else if (!process.env.REQUESTS_DB_ID) {
    nextSteps.push("Run: bun run setup-db   (creates Customer Requests DB programmatically)");
  } else if (!process.env.DIFF_REPORT_PAGE_ID || !process.env.AUDIT_LOG_PAGE_ID) {
    nextSteps.push(
      "Create blank Notion pages titled 'Diff Report' and 'Audit Log'. Connect integration. Paste IDs into .env.",
    );
  } else if (!process.env.REQUESTS_SHADOW_DB_ID) {
    nextSteps.push("Run: ntn workers deploy   (shadow DB will be created; copy its ID into .env)");
  } else {
    nextSteps.push("All env vars set. Run: bun run seed   (populates 18 demo rows)");
  }
  if (nextSteps.length > 0) {
    console.log("\nNext step:");
    for (const s of nextSteps) console.log(`  → ${s}`);
  }

  if (fail > 0) {
    console.log(
      "\nMost common cause of a failed page/DB check: integration not connected.\n" +
        "  Notion -> open the page or DB -> three-dot menu -> Connections -> add your integration.\n",
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("doctor crashed:", e);
  process.exit(1);
});

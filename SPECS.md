# Shadow — Build Spec

> **Pitch:** Preview Mode for Notion AI. Shadow any DB, let agents act on the copy, diff-and-promote what works.
>
> **Hackathon:** Notion Developer Platform Hackathon, submission 12pm 2026-05-17.
>
> **Theme hit:** Workflow Relay (multi-step orchestration with an explicit approval moment).
>
> **Design doc:** `~/.gstack/projects/rajashekarcs2023-road-runner/radhikadanda-main-design-20260517-085517.md`

---

## TL;DR for the 60-second demo

1. Split-screen Notion: real DB (left) + shadow DB (right), both showing 18 identical rows.
2. Tell the Custom Agent: "triage everything in the shadow."
3. Watch the shadow fill with AI changes in real time.
4. Switch to Diff Report page → see 18 rows with checkboxes + before/after.
5. Uncheck 3 rows; keep 15.
6. Promote selected → 15 rows flow into the real DB. Audit log appended.

---

## Components

| # | Component | LOC est. | Difficulty | Risk |
|---|-----------|---------:|:----------:|:----:|
| 1 | Scaffold + secrets + schema | 60 | Low | Low |
| 2 | Demo data seeder | 40 | Low | Low |
| 3 | Shadow sync (worker.sync replace mode) | 60 | Medium | Low |
| 4 | Triage agent tool (Claude per row) | 100 | Medium | Medium |
| 5 | Diff engine + Diff Report page | 150 | High | Medium |
| 6 | Promote tool + audit log | 80 | Medium | Low |
| 7 | README + setup + demo video | n/a | Low | Low |

Total ~490 LOC. Comfortable for a 4-person team in 12 hours if components 4 and 5 are owned by the strongest engineer.

---

## Hour-0 spike (BLOCKING — do this before anything else)

The entire shadow mechanism rests on whether `worker.sync` accepts a Notion DB as its source. The Workers SDK examples all show external APIs. We need 20 minutes to confirm before committing 6 hours of build to this path.

1. Scaffold a throwaway worker: `ntn workers new shadow-spike`.
2. Declare two managed DBs (`spikeReal`, `spikeShadow`), seed `spikeReal` with 2 rows via the Notion API.
3. Write `worker.sync("spikeSync", { mode: "replace", schedule: "manual", execute: async (_, { notion }) => { ... } })` where execute queries `spikeReal` and returns `changes` for `spikeShadow`.
4. Deploy, run `ntn workers sync trigger spikeSync`, check `spikeShadow` has 2 mirrored rows.

**If spike succeeds:** proceed with the architecture below.

**If spike fails:** swap component 3 for an imperative `worker.tool("shadowThisDB")` that does `databases.query` on real and `pages.create` on shadow in a single function. Same end result, no `worker.sync` dependency. The rest of the architecture stays unchanged.

---

## Helpers and imports

All code blocks below assume these imports at the top of the file. They are not repeated per-snippet to keep examples readable.

```typescript
import { Worker } from "@notionhq/workers";
import * as Schema from "@notionhq/workers/schema";          // Schema.title(), Schema.richText(), Schema.select(...), Schema.date()
import * as Builder from "@notionhq/workers/builder";        // Builder.title(...), Builder.richText(...), Builder.select(...), Builder.date(...)
import { j } from "@notionhq/workers/schema-builder";        // j.object({}), j.string(), etc. — for tool input/output schemas
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
```

Helper functions live in `src/lib/notion-utils.ts`:

```typescript
// src/lib/notion-utils.ts
export function getProp(page: any, propName: string): string {
  const p = page.properties?.[propName];
  if (!p) return "";
  if (p.title) return p.title.map((t: any) => t.plain_text).join("");
  if (p.rich_text) return p.rich_text.map((t: any) => t.plain_text).join("");
  if (p.select) return p.select?.name ?? "";
  if (p.date) return p.date?.start ?? "";
  return "";
}

export function extractRequestId(richTextArray: any[]): string | null {
  const flat = richTextArray.map((r: any) => r.plain_text).join("");
  return flat.match(/REQ-\d+/)?.[0] ?? null;
}

// Paginated database query — Notion's databases.query returns max 100 rows per page.
export async function fetchAllRows(notion: any, databaseId: string): Promise<any[]> {
  const all: any[] = [];
  let cursor: string | undefined = undefined;
  do {
    const resp: any = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });
    all.push(...resp.results);
    cursor = resp.has_more ? resp.next_cursor : undefined;
  } while (cursor);
  return all;
}

// Paginated block children list — same 100-block cap applies.
export async function fetchAllBlockChildren(notion: any, blockId: string): Promise<any[]> {
  const all: any[] = [];
  let cursor: string | undefined = undefined;
  do {
    const resp: any = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });
    all.push(...resp.results);
    cursor = resp.has_more ? resp.next_cursor : undefined;
  } while (cursor);
  return all;
}
```

---

## Pre-demo setup (one-time, manual)

The Worker needs three Notion-page IDs in its env that cannot be auto-created on first run without bootstrap complexity. Create these manually in the demo workspace before deploying:

1. **Real DB** — Worker creates this on first deploy (`worker.database("requests", ...)`). Capture its database ID from `ntn workers logs` after deploy, paste into `REQUESTS_DB_ID`.
2. **Shadow DB** — Worker creates this on first deploy. Capture ID into `REQUESTS_SHADOW_DB_ID`.
3. **Diff Report page** — Create manually in Notion: a blank page titled "Diff Report" inside the demo workspace. Copy its page ID into `DIFF_REPORT_PAGE_ID`. The diff renderer overwrites its children on each run.
4. **Audit Log page** — Create manually in Notion: a blank page titled "Audit Log" inside the demo workspace. Copy its page ID into `AUDIT_LOG_PAGE_ID`. The promote tool appends one block per promotion.

**Integration permissions:** the Notion internal integration powering `NOTION_API_TOKEN` must have these capabilities enabled in its settings: Read content, Update content, Insert content. The integration must also be Connected (three-dot menu → Connections → add) on:
- The parent page that holds both managed DBs
- The Diff Report page
- The Audit Log page

Without these connections every API call returns 404. Pre-flight check: `ntn workers exec listSetup --local` (a tool that prints all four IDs and verifies it can read each).

---

## Custom Agent setup

The Notion Custom Agent that powers the demo must be configured manually in the workspace:

1. Notion → Settings → Custom Agents → New Agent.
2. Name: "Shadow Workflow Agent".
3. System instruction:

```
You are an assistant for the Shadow workflow. Three tools are available:
- triageShadow — triages all rows in the shadow customer-requests DB
- diffShadowVsReal — produces a Diff Report page comparing shadow vs real
- promoteSelected — applies checked rows from the Diff Report to the real DB

When the user says "triage everything in the shadow" → call triageShadow.
When the user says "show me the diff" → call diffShadowVsReal.
When the user says "promote selected" → call promoteSelected.
Do not call any tool that the user did not request. Do not propose alternatives unless the user asks.
```

4. Tools: enable `triageShadow`, `diffShadowVsReal`, `promoteSelected` (these appear once the Worker is deployed).
5. Test the three exact demo phrases before the recording window — these are the phrases hardcoded in the runbook.

---

## File layout

```
road-runner/
├── src/
│   ├── index.ts              # Worker registration entrypoint
│   ├── databases.ts          # worker.database() declarations (real + shadow)
│   ├── sync/
│   │   └── shadow-sync.ts    # worker.sync("shadowReplaceSync", ...)
│   ├── tools/
│   │   ├── triage.ts         # worker.tool("triageShadow", ...)
│   │   ├── diff.ts           # worker.tool("diffShadowVsReal", ...)
│   │   └── promote.ts        # worker.tool("promoteSelected", ...)
│   ├── lib/
│   │   ├── anthropic.ts      # Claude client wrapper, prompt templates
│   │   ├── diff.ts           # pure diff function (no I/O)
│   │   └── audit.ts          # audit log append helper
│   └── prompts/
│       └── triage.md         # the system prompt for the triage agent
├── scripts/
│   └── seed.ts               # demo data seeder (run once before demo)
├── .env.example              # NOTION_API_TOKEN, ANTHROPIC_API_KEY, DB IDs
├── package.json
├── tsconfig.json
├── README.md
├── SPECS.md                  # this file
└── LICENSE                   # MIT
```

---

## Database schemas

Both DBs share the same schema. Identical-by-design so diff works cleanly on primary key.

### `requests` (real) and `requestsShadow` (shadow)

| Property | Type | Notes |
|----------|------|-------|
| Name | title | The customer's request, one-liner (called "Name" in code, displayed as the page title) |
| Request ID | rich_text | Stable external ID — primary key |
| Priority | select | Options: Low, Medium, High, Urgent |
| Owner | select | Options: Unassigned, Support, Security, Sales, Engineering |
| Status | select | Options: Inbox, Triaged, In Progress, Resolved |
| Inbound Text | rich_text | The full inbound message |
| Draft Response | rich_text | AI-drafted reply (shadow only; promoted to real on accept) |
| Classification | rich_text | Topic tags (Security, Billing, Bug, Feature Req, etc.) |
| **Severity Score** | **number** | **CEO cherry-pick #1: new property the agent computes 0-100 from urgency keywords. Empty on real DB until promote.** |
| Last Touched | date | Updated on every mutation |

```typescript
// src/databases.ts
import * as Schema from "@notionhq/workers/schema";

const requestSchema = {
  Name: Schema.title(),
  "Request ID": Schema.richText(),
  Priority: Schema.select(["Low", "Medium", "High", "Urgent"]),
  Owner: Schema.select(["Unassigned", "Support", "Security", "Sales", "Engineering"]),
  Status: Schema.select(["Inbox", "Triaged", "In Progress", "Resolved"]),
  "Inbound Text": Schema.richText(),
  "Draft Response": Schema.richText(),
  Classification: Schema.richText(),
  "Severity Score": Schema.number(),   // CEO cherry-pick #1 — agent computes 0-100, empty on real until promote
  "Last Touched": Schema.date(),
};

export const requests = worker.database("requests", {
  type: "managed",
  initialTitle: "Customer Requests",
  primaryKeyProperty: "Request ID",   // ENG note: verified in hour-0 spike that richText works as primaryKey. If SDK rejects, fall back to Schema.uniqueId() — the seeder must then generate ID strings from a counter instead of "REQ-XXX".
  schema: { properties: requestSchema },
});

export const requestsShadow = worker.database("requestsShadow", {
  type: "managed",
  initialTitle: "Customer Requests (Shadow)",
  primaryKeyProperty: "Request ID",
  schema: { properties: requestSchema },
});
```

## Notion API Pacer (REQUIRED — eng-review)

Notion's API rate-limits at roughly 3 requests per second per integration. A full demo cycle does ~80+ API calls in ~30 seconds (18 row queries + 18 triage updates + 50+ diff-render block writes + 15 promote updates + audit log appends). Without a pacer this hits 429 rate-limit errors mid-demo. **REQUIRED:** declare one shared pacer and route every `notion.*` call through it.

```typescript
// src/index.ts (top level, near worker = new Worker())
export const notionPacer = worker.pacer("notion", { allowedRequests: 3, intervalMs: 1000 });
```

Then in every tool/sync, replace bare `notion.pages.update(...)` with:

```typescript
await notionPacer.wait();
await notion.pages.update(/* ... */);
```

Wrap reads too — `databases.query` and `blocks.children.list` count against the same budget. The diff renderer's chunked block appends in particular MUST pacer-wrap each chunk.

---

## Shadow Sync (component 3)

Replace-mode sync that reads from `requests` (the real DB) and writes to `requestsShadow`. Schedule is `"manual"` — only fires when the user explicitly clicks "Shadow this DB" or runs `ntn workers sync trigger shadowReplaceSync`.

```typescript
// src/sync/shadow-sync.ts
worker.sync("shadowReplaceSync", {
  database: requestsShadow,
  mode: "replace",
  schedule: "manual",
  execute: async (_state, { notion }) => {
    const realDbId = process.env.REQUESTS_DB_ID!;
    const { results } = await notion.databases.query({ database_id: realDbId });

    const changes = results.map((page: any) => ({
      type: "upsert" as const,
      key: getProp(page, "Request ID"),
      properties: {
        Name: Builder.title(getProp(page, "Name")),
        "Request ID": Builder.richText(getProp(page, "Request ID")),
        Priority: Builder.select(getProp(page, "Priority") ?? "Low"),
        Owner: Builder.select(getProp(page, "Owner") ?? "Unassigned"),
        Status: Builder.select(getProp(page, "Status") ?? "Inbox"),
        "Inbound Text": Builder.richText(getProp(page, "Inbound Text")),
        "Draft Response": Builder.richText(""),
        Classification: Builder.richText(""),
        "Last Touched": Builder.date(new Date().toISOString()),
      },
    }));

    return { changes, hasMore: false };
  },
});
```

Open: `getProp` is a small helper that pulls a property's plain value from a Notion page object. Write it once in `src/lib/notion-utils.ts`.

---

## Triage Agent Tool (component 4)

Custom Agent tool. Iterates shadow rows, calls Claude per row, writes priority + owner + classification + draft response back.

```typescript
// src/tools/triage.ts
worker.tool("triageShadow", {
  title: "Triage Shadow",
  description:
    "Classify and prioritize every row in the shadow customer-requests DB. Sets Priority, Owner, Classification, and a Draft Response per row. Does NOT touch the real DB.",
  schema: j.object({}),
  hints: { readOnlyHint: false },
  execute: async (_input, { notion }) => {
    const shadowDbId = process.env.REQUESTS_SHADOW_DB_ID!;
    const { results } = await notion.databases.query({ database_id: shadowDbId });

    // ENG decision: parallelize Claude calls (Anthropic API tolerates concurrent
    // requests fine), throttle Notion writes via the notionPacer. Sequential +
    // 500ms-delay (prior spec) yielded ~45s mutation window — too long for the
    // 0:08–0:30 demo beat. Parallel Claude + paced Notion writes lands ~9s.
    const summary = { touched: 0, errors: 0 };
    const triaged: Array<{ row: any; data: any }> = [];

    // Phase 1: parallel Claude inference. ~3s for all 18 rows.
    const inferences = await Promise.all(
      results.map(async (row: any) => {
        try {
          const inbound = getProp(row, "Inbound Text");
          const data = await triageOneRow(inbound);
          return { row, data };
        } catch (_e) {
          return null;
        }
      })
    );
    for (const item of inferences) {
      if (item) triaged.push(item); else summary.errors++;
    }

    // Phase 2: throttled Notion writes via notionPacer. ~6s at 3 req/s.
    // The visible "watching agent work" cinematic comes from the write phase.
    for (const { row, data } of triaged) {
      try {
        await notionPacer.wait();
        await notion.pages.update({
          page_id: row.id,
          properties: {
            Priority: { select: { name: data.priority } },
            Owner: { select: { name: data.owner } },
            Classification: { rich_text: [{ text: { content: data.classification } }] },
            "Severity Score": { number: data.severityScore },   // CEO cherry-pick #1
            "Draft Response": { rich_text: [{ text: { content: data.draft } }] },
            Status: { select: { name: "Triaged" } },
            "Last Touched": { date: { start: new Date().toISOString() } },
          },
        });
        summary.touched++;
      } catch (_e) {
        summary.errors++;
      }
    }
    return summary;
  },
});
```

### Cinematic timing — REVISED (eng-review)

The original spec used sequential Claude calls + 500ms delay per row → ~45s mutation window. That overflows the 0:08–0:30 demo beat (22s budget). **Eng decision:** parallelize Claude inference (~3s for 18 rows), then drive throttled Notion writes through `notionPacer` (~6s at 3 req/s). Total mutation window: ~9s. The "watching agent work" cinematic now comes from the Notion-write phase, which is naturally paced by the rate limiter.

```typescript
// src/index.ts (top-level), see "Notion API Pacer" section below.
export const notionPacer = worker.pacer("notion", { allowedRequests: 3, intervalMs: 1000 });
```

500ms × 18 rows = 9s of "agent visibly working" — perfect for the 0:12–0:30 window in the runbook. Tune up or down after the first rehearsal.

### Claude prompt (`src/prompts/triage.md`)

```
You are triaging an inbound customer request.

Output STRICT JSON matching this shape (no prose, no markdown fence):

{
  "priority": "Low" | "Medium" | "High" | "Urgent",
  "owner": "Support" | "Security" | "Sales" | "Engineering",
  "classification": "short comma-separated topic tags",
  "severityScore": <integer 0-100>,
  "draft": "a 2-3 sentence draft response in a professional but warm tone"
}

Rules:
- If the request mentions SOC2, SSO, HIPAA, compliance, procurement, or security review → Owner=Security, Priority=High
- If it mentions a bug, error, broken, not working → Owner=Engineering, Priority=High (Urgent if "down" or "everyone")
- If it mentions pricing, billing, refund, enterprise pricing → Owner=Sales, Priority=Medium
- Everything else → Owner=Support, Priority=Medium
- The draft response must NOT make promises about timelines, prices, or commitments. Acknowledge, set expectation, name the owner team.
- severityScore: 0-30 for routine requests (student discount, light feature ask), 31-60 for medium business impact (single-customer bug, pricing question), 61-85 for High priority items (SOC2 compliance request, breaking bug for one customer), 86-100 for Urgent items (production down, mass outage, security incident). This is the new computed property that demonstrates schema-level work in the demo.

Inbound:
{{INBOUND}}
```

Use `@anthropic-ai/sdk` with `claude-sonnet-4-6` for the triage calls. Verify the model ID is current in hour 0 via `anthropic.models.list()` — if `claude-sonnet-4-6` is not available, fall back to `claude-sonnet-4-5-20250929`.

**On prompt caching:** the cache requires a minimum of 1024 input tokens to actually cache. The triage system prompt is ~150 tokens — well below that threshold. The `cache_control` hint would be decorative (no actual savings). Two options:

- **Option A (recommended for hackathon):** drop `cache_control` entirely. 18 rows × 200 tokens system = 3,600 tokens uncached. Cost: negligible.
- **Option B:** if you need real caching, pad the system prompt to >1024 tokens by adding 5-8 worked examples (input → expected JSON output). This crosses the threshold and gives 90% cache hit rate after row 1.

```typescript
// src/lib/anthropic.ts
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SYSTEM_PROMPT = readFileSync("src/prompts/triage.md", "utf-8");

export async function triageOneRow(inbound: string) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,  // No cache_control — prompt is under 1024 tokens
    messages: [{ role: "user", content: `Inbound:\n${inbound}` }],
  });
  const text = (response.content[0] as any).text;
  // Retry once with stricter instruction if JSON.parse fails.
  try {
    return JSON.parse(text);
  } catch {
    const retry = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT + "\n\nYour last output was not valid JSON. Output ONLY the JSON object, no prose, no markdown.",
      messages: [{ role: "user", content: `Inbound:\n${inbound}` }],
    });
    return JSON.parse((retry.content[0] as any).text);
  }
}
```

---

## Diff Engine (component 5) — the hardest piece

Pure diff function over two arrays of rows joined by primary key. Renders the diff to a Notion page called "Diff Report" with one block per changed row, each row having a `to_do` block (checkbox) + a structured comparison table.

```typescript
// src/lib/diff.ts — PURE, no I/O, easy to test
export type RowDiff = {
  requestId: string;
  kind: "added" | "modified" | "deleted";
  fieldDeltas: Array<{ field: string; before: string; after: string }>;
};

export function computeDiff(real: Row[], shadow: Row[]): RowDiff[] {
  const realByKey = new Map(real.map((r) => [r.requestId, r]));
  const shadowByKey = new Map(shadow.map((r) => [r.requestId, r]));
  const allKeys = new Set([...realByKey.keys(), ...shadowByKey.keys()]);

  const diffs: RowDiff[] = [];
  for (const key of allKeys) {
    const r = realByKey.get(key);
    const s = shadowByKey.get(key);
    if (!r && s) diffs.push({ requestId: key, kind: "added", fieldDeltas: [] });
    else if (r && !s) diffs.push({ requestId: key, kind: "deleted", fieldDeltas: [] });
    else if (r && s) {
      const deltas = compareFields(r, s);
      if (deltas.length > 0)
        diffs.push({ requestId: key, kind: "modified", fieldDeltas: deltas });
    }
  }
  return diffs;
}
```

```typescript
// src/tools/diff.ts
worker.tool("diffShadowVsReal", {
  title: "Diff Shadow vs Real",
  description:
    "Compare the shadow customer-requests DB against the real one. Writes a Diff Report page with one checkbox per changed row, showing before/after for every modified field.",
  schema: j.object({}),
  hints: { readOnlyHint: true },
  execute: async (_input, { notion }) => {
    const real = await fetchRows(notion, process.env.REQUESTS_DB_ID!);
    const shadow = await fetchRows(notion, process.env.REQUESTS_SHADOW_DB_ID!);
    const diffs = computeDiff(real, shadow);
    const reportPageId = await renderDiffReport(notion, diffs);
    return { reportPageId, summary: { modified: diffs.length } };
  },
});
```

`renderDiffReport` REPLACES the children of an existing Notion page whose ID lives in `DIFF_REPORT_PAGE_ID`. It does NOT create a new page per run — that would create a stable-ID problem for the promote tool.

```typescript
// src/lib/diff-render.ts
async function renderDiffReport(notion: any, diffs: RowDiff[]): Promise<string> {
  const pageId = process.env.DIFF_REPORT_PAGE_ID!;

  // 1. Delete existing children. Paginated to handle prior runs at >100 blocks.
  const existing = await fetchAllBlockChildren(notion, pageId);
  for (const block of existing) {
    await notion.blocks.delete({ block_id: block.id });
  }

  // 2. Build new blocks: header + summary + one to_do per modified row.
  // CEO cherry-pick #4: GitHub-PR aesthetic. "Files changed" header callout + red/green per-property callouts.
  // Fallback path (if behind at hour 7): emit only the header callout + the original to_do/paragraph blocks below.
  const blocks: any[] = [
    {
      object: "block",
      type: "heading_1",
      heading_1: { rich_text: [{ type: "text", text: { content: `Diff Report — ${new Date().toISOString()}` } }] },
    },
    {
      object: "block",
      type: "callout",
      callout: {
        color: "gray_background",
        icon: { type: "emoji", emoji: "📝" },
        rich_text: [{ type: "text", text: { content: `Files changed: ${diffs.length} rows modified` } }],
      },
    },
    {
      object: "block",
      type: "heading_2",
      heading_2: { rich_text: [{ type: "text", text: { content: "Modified rows" } }] },
    },
  ];

  for (const d of diffs) {
    // The to_do block is what the promote tool will read. Request ID MUST appear in the rich_text. Default checked.
    blocks.push({
      object: "block",
      type: "to_do",
      to_do: {
        checked: true,
        rich_text: [{ type: "text", text: { content: `Request ID: ${d.requestId}` } }],
      },
    });
    // For each field delta: emit a red callout (before) + green callout (after). GitHub-PR aesthetic.
    for (const delta of d.fieldDeltas) {
      blocks.push({
        object: "block",
        type: "callout",
        callout: {
          color: "red_background",
          icon: { type: "emoji", emoji: "➖" },
          rich_text: [{ type: "text", text: { content: `${delta.field}: ${delta.before || "(empty)"}` } }],
        },
      });
      blocks.push({
        object: "block",
        type: "callout",
        callout: {
          color: "green_background",
          icon: { type: "emoji", emoji: "➕" },
          rich_text: [{ type: "text", text: { content: `${delta.field}: ${delta.after}` } }],
        },
      });
    }
  }

  // 3. Append all new blocks. Notion caps appends at 100 per request, so chunk.
  for (let i = 0; i < blocks.length; i += 100) {
    await notion.blocks.children.append({
      block_id: pageId,
      children: blocks.slice(i, i + 100),
    });
  }

  return pageId;
}
```

**Contract for the promote tool:** every modified row appears as exactly one `to_do` block whose `rich_text` contains `Request ID: REQ-XXX`. The promote tool calls `fetchAllBlockChildren(notion, DIFF_REPORT_PAGE_ID)`, filters to `type === "to_do"`, and uses `extractRequestId(b.to_do.rich_text)` to recover the ID.

**Why default-checked:** demoing "uncheck the 3 wrong rows" is easier than "check the 15 good rows."

---

## Promote Tool (component 6)

```typescript
// src/tools/promote.ts
worker.tool("promoteSelected", {
  title: "Promote Selected",
  description:
    "Read the Diff Report page, apply every checked row's shadow values to the real DB, and append each promotion to the audit log.",
  schema: j.object({}),
  hints: { readOnlyHint: false },
  execute: async (_input, { notion }) => {
    const reportPageId = process.env.DIFF_REPORT_PAGE_ID!;
    const blocks = await notion.blocks.children.list({ block_id: reportPageId });

    const checkedRequestIds = blocks.results
      .filter((b: any) => b.type === "to_do" && b.to_do.checked)
      .map((b: any) => extractRequestId(b.to_do.rich_text));

    const shadowDbId = process.env.REQUESTS_SHADOW_DB_ID!;
    const realDbId = process.env.REQUESTS_DB_ID!;
    let promoted = 0;
    for (const id of checkedRequestIds) {
      const shadowRow = await findByRequestId(notion, shadowDbId, id);
      const realRow = await findByRequestId(notion, realDbId, id);
      if (!shadowRow || !realRow) continue;

      await notion.pages.update({
        page_id: realRow.id,
        properties: copyableProps(shadowRow),
      });
      await appendAudit(notion, { id, promotedAt: new Date().toISOString() });
      promoted++;
    }
    return { promoted, skipped: checkedRequestIds.length - promoted };
  },
});
```

`copyableProps` lifts Priority, Owner, Classification, Draft Response, Status from the shadow row's properties into the shape Notion's update API expects. Do not promote `Last Touched` — let the real DB's update timestamp reflect the promotion moment, not the shadow edit moment.

`appendAudit` adds a block to an "Audit Log" page, format: `2026-05-17 09:42:18 — promoted REQ-001 (Priority: High, Owner: Security)`.

---

## Demo Data Seeder (component 2)

```typescript
// scripts/seed.ts
const SEED_ROWS = [
  { id: "REQ-001", text: "Do you support SSO, SOC2, HIPAA, and enterprise pricing? Need procurement docs by EOW." },
  { id: "REQ-002", text: "Login is broken for everyone on Chrome since this morning. We are dead in the water." }, // → Urgent
  { id: "REQ-003", text: "Can I get a student discount? Building a side project." },
  { id: "REQ-004", text: "Production API has been returning 503 for 20 minutes. All customers affected." },          // → Urgent (second one — proves Urgent isn't a one-off)
  // ... 14 more, varied across Security / Engineering / Sales / Support
];

for (const row of SEED_ROWS) {
  await notion.pages.create({
    parent: { database_id: process.env.REQUESTS_DB_ID! },
    properties: {
      Name: { title: [{ text: { content: row.text.slice(0, 60) } }] },
      "Request ID": { rich_text: [{ text: { content: row.id } }] },
      "Inbound Text": { rich_text: [{ text: { content: row.text } }] },
      Priority: { select: { name: "Low" } },
      Owner: { select: { name: "Unassigned" } },
      Status: { select: { name: "Inbox" } },
    },
  });
}
```

Run once before the demo: `bun run scripts/seed.ts`.

---

## Demo runbook (must be rehearsed)

The 60-second flow is too tight to ad-lib. Rehearse it 3 times before recording.

**REQUIRED for category clarity (was CEO cherry-pick #2): 5-second disaster-scene opener (pre-recorded, edited into the front of the video).** Without this opener, judges can pattern-match Shadow to agent observability (LangSmith / Helicone / Arize). With it, the contrast is undeniable: AI in normal mode = scary, AI in Shadow = preview-before-commit. **Do not ship the video without this opener.** Splice a 5-second sting showing the pain that Shadow solves:
- 0:00–0:03 (disaster sting) — Notion DB visible. A "generic AI agent" tool fires. Cells flicker. Priority column gets set to all "Urgent" simultaneously. Some rows disappear. Big red X overlay.
- 0:03–0:05 — Cut. White screen. Title card: "Or you could try Shadow."
- Then the 60-second main demo begins.
This is video-editor work, recorded separately during the 10–11 hour video window. Use any screen recorder + a 30-second fake "AI breaks a DB" sequence (you can hardcode it by running a Notion API script that pages.update everything to "Urgent" then deletes 3 rows).

The main demo (60 seconds) begins at the title card:

1. **Pre-demo state**: real DB has 18 seeded rows, all `Priority=Low / Owner=Unassigned / Status=Inbox`. Shadow DB does NOT exist yet (or has been deleted).
2. **0:00–0:05** — Open Notion. Show the real DB. Say: "Here's a customer requests DB. 18 rows. I want AI to triage them but I don't want it to touch the real data."
3. **0:05–0:08** — Trigger shadow sync. Either via `ntn workers sync trigger shadowReplaceSync` from terminal, or via a Custom Agent saying "shadow this DB." Shadow DB appears next to real, mirror state.
4. **0:08–0:12** — In the Custom Agent, say: "Triage everything in the shadow."
5. **0:12–0:30** — Watch the shadow rows mutate. The 18 rows tick through priority/owner/draft updates. Real DB on the left stays untouched.
6. **0:30–0:35** — Custom Agent: "Show me the diff." Diff Report page renders. **Voiceover line (REQUIRED for category clarity, ~2 seconds):** *"These changes are not in your real database yet. You decide."* This sentence locks Shadow as Preview Mode and prevents observability mislabeling. No observability tool can credibly say it.
7. **0:35–0:50** — Scroll the diff. Uncheck 3 rows that look wrong (pick rows where the agent miscalled priority or assigned the wrong owner — pre-rehearse which 3 to uncheck).
8. **0:50–0:55** — Custom Agent: "Promote selected." Real DB updates.
9. **0:55–0:60** — **Pan across the Audit Log page** (CEO cherry-pick #3). Each promoted row visible: "09:42:18 — promoted REQ-001, Priority: Low → High, Owner: Unassigned → Security..." Voiceover closes: "Every action Claude takes is auditable. Reversible. Yours."

---

## Environment variables

```
# .env.example
NOTION_API_TOKEN=ntn_xxx                      # Internal integration token, scoped to demo workspace
ANTHROPIC_API_KEY=sk-ant-xxx
REQUESTS_DB_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx     # Set after first deploy (Worker logs the ID)
REQUESTS_SHADOW_DB_ID=xxxxxxxxxxxxxxxxxxxxxx  # Set after first deploy
DIFF_REPORT_PAGE_ID=xxxxxxxxxxxxxxxxxxxxxxx   # Created on first diff run, then pinned
AUDIT_LOG_PAGE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx  # Created manually as a child page
```

Push secrets to the deployed Worker: `ntn workers env push`.

---

## What we are explicitly NOT building in v1

- **Multi-DB shadowing**: only one DB shape is supported. The product vision is shadow-anything, but v1 is one DB.
- **Per-property promote granularity**: v1 promotes whole rows. The diff UI does not let the user accept some properties of a row and reject others.
- **Real-time shadow refresh during agent work**: the shadow is frozen the moment it is created. Real DB changes after that point do not flow in until the next manual sync.
- **Rollback**: there is no "undo a promotion" tool in v1. The audit log records what happened but cannot be replayed in reverse. Manual recovery only.
- **Multi-user permission boundaries**: the workspace owner is the only one who can promote. No reviewer/approver split.
- **Schema drift handling**: if the real DB schema changes after a shadow is created, the diff may show false positives. v1 assumes schema is stable for the duration of a shadow cycle.

Each of these is a real product gap and a real reason a customer would not buy v1. They are also each a 1-2 day build that does not fit in this hackathon. Explicitly named here so the demo Q&A has clean answers about scope.

---

## Risks and mitigations

| Risk | Likelihood | Mitigation |
|------|-----------:|-----------|
| Triage prompt returns malformed JSON | Medium | Strict prompt + `JSON.parse` in try/catch + retry once with a "your last output was not valid JSON, output ONLY the JSON" follow-up |
| Notion API rate-limiting during the shadow fill | Medium | Pacer: `worker.pacer("notion", { allowedRequests: 3, intervalMs: 1000 })` wrapped around every API call |
| Diff Report page becomes huge if shadow has 100s of rows | Low for demo | Cap at first 50 modified rows in the report; v1 only ever has 18 |
| Audit log page hits Notion's block-per-page soft limit | Very low for demo | One block per promotion. 18 max in demo. Fine. |
| Custom Agent tool input/output JSON drift | Low | Strict `j.object` schemas with `additionalProperties: false` |
| Shadow sync overwrites in-progress AI edits if user re-triggers | Low | Replace mode is explicit. Document that re-running shadow sync resets the shadow. |

---

## Time-boxed build plan (12 hours)

Parallelization rule: Eng-2 owns the entire diff/render/promote path from hour 2. Eng-1 owns sync + triage. Eng-3 (if available) owns paperwork from hour 0. This removes Eng-1 from the critical path of the renderer.

| Hour | Owner | Task |
|-----:|-------|------|
| 0–0.5 | Eng-1 | **HOUR-0 SPIKE**: verify `worker.sync` accepts Notion DB as source. Branch to fallback if it fails. |
| 0–1 | Eng-1 | Scaffold `ntn workers new`, install `@anthropic-ai/sdk`, write `databases.ts` and helpers in `lib/notion-utils.ts` |
| 0–1 | Eng-2 | Write `seed.ts`, populate the real DB with 18 representative rows |
| 0–1 | Eng-3 / background | LICENSE, public GitHub repo, README skeleton, Cerebral Valley form fields except video URL |
| 1–2 | Eng-1 | Implement shadow sync (or imperative fallback per spike result); confirm mirror works end-to-end |
| 1–2 | Eng-1 | Set up Custom Agent in Notion workspace with the three tool names and demo phrasing |
| 2–5 | Eng-1 | Triage tool: Claude integration, write back to shadow, hit 18 rows with optional 500ms paced delay for visible cinematic effect |
| 2–5 | Eng-2 | Pure diff function in `src/lib/diff.ts` + unit tests for added/modified/deleted cases |
| 5–7 | Eng-2 | `renderDiffReport` — full implementation per the contract above (header + summary + to_do blocks + paragraph deltas, chunked appends) |
| 5–7 | Eng-1 | Tune triage prompt against the 18 seed rows. Verify Urgent triggers on REQ-002 and at least one other row. |
| 7–9 | Eng-2 | Promote tool: paginated block-child read, filter to `to_do.checked=true`, parse Request ID, apply to real, append to audit log |
| 7–9 | Eng-1 | End-to-end run, fix integration bugs |
| 9–10 | Both | Demo rehearsal x3 (full 60s flow, with the three exact phrases) |
| 10–11 | Eng-1 | Demo video recording + Loom upload (Loom not YouTube — no processing latency) |
| 11–12 | Eng-2 | Cerebral Valley submission, paste video URL, verify repo is public, verify team added |

If we are at hour 7 and component 5 (diff renderer) is not done, cut scope: render the diff as plain text in the tool's return value instead of a Notion page. The agent shows the diff in chat. Still works, just less cinematic.

---

## License

MIT. Add to `LICENSE` in repo root before submission.

---

## Submission checklist (Cerebral Valley)

- [ ] Public GitHub repo at `github.com/rajashekarcs2023/road-runner`
- [ ] MIT LICENSE committed
- [ ] README with install instructions
- [ ] 60-second demo video uploaded (YouTube or Loom)
- [ ] Submission form filled at cerebralvalley.ai/e/notion-developer-platform-hackathon/hackathon/submit
- [ ] All team members added to submission
- [ ] Demo link accessible (deployed Worker)
- [ ] Submitted by 12:00 PM 2026-05-17

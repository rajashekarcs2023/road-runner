# Shadow

**Preview Mode for Notion AI.** Shadow any Notion database, let AI agents act on the copy, then diff-and-promote what works.

Built for the Notion Developer Platform Hackathon, 2026-05-17.

## What it does

- Your real Notion DB stays untouched.
- A shadow DB mirrors it.
- A Notion Custom Agent runs structural edits on the shadow (triage, classification, new properties).
- A Diff Report page shows every change side-by-side with red/green callouts and per-row checkboxes.
- You promote selected rows. Only those land in production. Everything is auditable.

This is the AI-native version of `terraform plan` / `kubectl --dry-run` / Google Docs suggestion-mode — plan-before-apply, with a human gate per change.

## Why it matters

The #1 reason teams don't deploy AI agents on real workspace data: fear. An agent that misclassifies, mass-edits, or hallucinates can destroy hours of structured work in seconds. Shadow turns this one-way door into a two-way door.

It is NOT agent observability (LangSmith / Arize / Helicone). Those tools answer "what did the agent do?" after the fact. Shadow answers "what would the agent do if I let it run on production?" before the fact, with selective promote.

## Architecture

```
┌──────────────────┐   shadowReplaceSync    ┌──────────────────┐
│ Customer        │ ─────────────────────▶ │ Customer        │
│ Requests (real) │                        │ Requests (shadow)│
└──────────────────┘                        └──────────────────┘
        ▲                                            │
        │                                            │ triageShadow
        │ promoteSelected                            │ (Claude per row,
        │ (only checked rows)                        │  paced writes)
        │                                            ▼
        │                                  ┌──────────────────┐
        │                                  │ Shadow with     │
        │                                  │ triaged values  │
        │                                  └────────┬─────────┘
        │                                           │
        │                                           │ diffShadowVsReal
        │                                           ▼
        │                                  ┌──────────────────┐
        └────────────────────────────────  │ Diff Report     │
           (read checkboxes, apply)        │ page (to_do +    │
                                           │ red/green callouts)
                                           └──────────────────┘

                                           ┌──────────────────┐
                                           │ Audit Log page  │
                                           │ (one entry per   │
                                           │  promotion)      │
                                           └──────────────────┘
```

## Setup

### Prerequisites

- Node 22+
- [Bun](https://bun.sh) (or use `npx tsx` for the scripts)
- Notion workspace with Business plan or hackathon trial credits
- Anthropic API key
- `ntn` CLI: `curl -fsSL https://ntn.dev | bash && ntn login`

### Install

```bash
cd shadow
bun install
cp .env.example .env
# Fill in NOTION_API_TOKEN and ANTHROPIC_API_KEY
```

### Create the real Customer Requests DB (one command)

The real DB is YOUR source of truth — a normal Notion database, not managed by this Worker. We create it programmatically with the full schema so you don't have to hand-build 10 properties and 16 select options.

1. In Notion, create an **empty page** in your demo workspace. Call it whatever — it's just the parent for the DB.
2. Click the three-dot menu on that page → **Connections** → add your integration.
3. Copy the page ID from the URL and paste into `.env` as `NOTION_PARENT_PAGE_ID`.
4. Run:
   ```bash
   bun run setup-db
   ```
5. The script prints the new DB's ID. Paste into `.env` as `REQUESTS_DB_ID`.

The created DB has 10 properties, including `Severity Score` (number, empty until the agent fills it via triage). The diff renderer surfaces this as a `🆕 NEW PROPERTY added by agent` callout when the before-value is empty — preserving the schema-level surprise without requiring schema mutation on promote.

### Deploy

```bash
ntn workers deploy
```

The first deploy creates the shadow database (`requestsShadow`) automatically. Capture its ID from the deploy logs and paste into `.env` as `REQUESTS_SHADOW_DB_ID`.

### Create the support pages

In Notion, manually create two blank pages in the same workspace:

1. **Diff Report** — capture its page ID, set `DIFF_REPORT_PAGE_ID` in `.env`
2. **Audit Log** — capture its page ID, set `AUDIT_LOG_PAGE_ID` in `.env`

Connect your Notion integration to both pages via the three-dot menu → Connections.

Push the env to the deployed worker:

```bash
ntn workers env push
```

### Verify your setup (run any time)

```bash
bun run doctor
```

The doctor checks every env var, pings the Notion API to confirm your token works, verifies the integration is connected to each page and DB you've created, and pings the Anthropic API. Run it after every env change. Most setup mistakes show up here — usually a forgotten Connections click.

### Seed demo data

```bash
bun run seed
```

This populates the real DB with 18 customer requests spanning Security / Engineering / Sales / Support, including two Urgent-triggering rows.

### Set up the Custom Agent

In Notion → Settings → Custom Agents → New Agent:

- Name: "Shadow Workflow Agent"
- System prompt:
  ```
  You are an assistant for the Shadow workflow. Three tools are available:
  - triageShadow — triages all rows in the shadow customer-requests DB
  - diffShadowVsReal — produces a Diff Report page comparing shadow vs real
  - promoteSelected — applies checked rows from the Diff Report to the real DB

  When the user says "triage everything in the shadow" → call triageShadow.
  When the user says "show me the diff" → call diffShadowVsReal.
  When the user says "promote selected" → call promoteSelected.
  Do not call any tool that the user did not request.
  ```
- Enable: `triageShadow`, `diffShadowVsReal`, `promoteSelected`

## Demo flow (60 seconds)

1. Trigger shadow sync: `ntn workers sync trigger shadowReplaceSync` — shadow DB mirrors real
2. In the Custom Agent: "triage everything in the shadow" — watch the shadow fill in ~9s
3. "show me the diff" — Diff Report page renders with `Files changed: 18 rows` header, red/green callouts per change, and a `🆕 NEW PROPERTY` badge where the agent added Severity Score
4. Uncheck a few rows in the Diff Report (the ones the agent got wrong)
5. "promote selected" — checked rows flow into the real DB, Audit Log gets one entry per promotion
6. Pan across the Audit Log: every action auditable, reversible, yours

## Reset between rehearsals

```bash
bun run reset && bun run seed
```

## Tests

```bash
bun run test         # one-shot
bun run test:watch   # while iterating
bun run typecheck    # tsc --noEmit
```

Coverage includes the pure diff function (added / modified / deleted / identical / ignore-Last-Touched / sort cases), the Anthropic SDK wrapper (happy path, retry on malformed JSON, markdown fence handling, severity clamping, invalid field defaults), and the Notion property helpers.

## What's NOT in v1

- Multi-DB shadowing
- Per-property promote granularity (currently whole-row)
- Real-time shadow refresh while AI is editing
- Rollback of a promotion
- Schema drift detection between shadow and real
- Multi-user approval flows
- Browser extension "Shadow this DB" button
- Reviewer agent (AI watching AI)

Each is a real product gap and a real reason a v1 customer would not pay — explicitly named so the Q&A has clean answers.

## License

MIT — see [LICENSE](./LICENSE).

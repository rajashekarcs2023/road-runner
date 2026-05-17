> ## Documentation Index
> Fetch the complete documentation index at: https://developers.notion.com/llms.txt
> Use this file to discover all available pages before exploring further.

# What are Notion Workers?

> Learn what Notion Workers are, what you can build with them, and how they fit into Notion.

Notion Workers are small Node/TypeScript programs that extend Notion. You write code, deploy it with the [Notion CLI](/cli/get-started/overview), and Notion hosts and runs it for you. No servers to manage.

With Workers, you can:

* **Sync external data** into [Notion databases](/guides/data-apis/working-with-databases) on a schedule.
* **Give Notion AI new tools** that your [Custom Agents](https://www.notion.com/help/custom-agents) can call.
* **Receive webhooks** from external services like GitHub, Stripe, or Zendesk.

Workers are designed to be built with AI coding agents. Scaffold a project, describe what you want, and deploy.

## What you can build

<CardGroup cols={3}>
  <Card title="Sync data" icon="https://mintcdn.com/notion-demo/7WdlNb9IZkRhGCcR/icons/nds/arrowCircleLoopForward.svg?fit=max&auto=format&n=7WdlNb9IZkRhGCcR&q=85&s=25d8d1ea2405c9af06347df80ab90fcf" href="/workers/guides/syncs" horizontal color="#0076d7" width="20" height="20" data-path="icons/nds/arrowCircleLoopForward.svg">
    Pull data from Salesforce, Stripe, GitHub, or any API into Notion databases — kept in sync automatically.
  </Card>

  <Card title="Agent tools" icon="https://mintcdn.com/notion-demo/7WdlNb9IZkRhGCcR/icons/nds/aiFace.svg?fit=max&auto=format&n=7WdlNb9IZkRhGCcR&q=85&s=d473a8d294324c9f2e19f44d487744dd" href="/workers/guides/tools" horizontal color="#0076d7" width="20" height="20" data-path="icons/nds/aiFace.svg">
    Give Notion Custom Agents functions like "create a Jira ticket" or "look up a customer in our CRM."
  </Card>

  <Card title="Webhooks" icon="https://mintcdn.com/notion-demo/yKfkO8UsVZTLLPNp/icons/nds/bell.svg?fit=max&auto=format&n=yKfkO8UsVZTLLPNp&q=85&s=0ee1c6e084361d853c48609a1f989a2c" href="/workers/guides/webhooks" horizontal color="#0076d7" width="20" height="20" data-path="icons/nds/bell.svg">
    Receive HTTP events from GitHub pushes, Stripe payments, or any service that sends webhooks.
  </Card>
</CardGroup>

## How it works

A worker is a single TypeScript file that exports a `Worker` instance. You register **capabilities** on it (syncs, tools, webhooks) and deploy with `ntn workers deploy`:

```typescript src/index.ts theme={null}
import { Worker } from "@notionhq/workers";

const worker = new Worker();
export default worker;

// Register capabilities on the worker
worker.tool("sayHello", { /* ... */ });
worker.sync("customersSync", { /* ... */ });
worker.webhook("onGithubPush", { /* ... */ });
```

Once deployed, Notion takes over:

* **Syncs** run on a schedule (default every 30 minutes) and write results to Notion databases.
* **Tools** appear in Notion Custom Agents and are called by agents on demand.
* **Webhooks** receive HTTP events from external services and run your handler asynchronously.

Your code runs in a sandboxed Node.js environment. You can make HTTP requests to external APIs, [use secrets](/workers/guides/secrets) stored via the CLI, and authenticate with third-party services through [OAuth](/workers/guides/oauth).

| Concept        | What it does                                                                                            |
| :------------- | :------------------------------------------------------------------------------------------------------ |
| **Worker**     | The container for your code. One worker per project.                                                    |
| **Capability** | Something the worker can do, i.e. a sync, tool, or webhook. A worker can have one or more capabilities. |
| **Database**   | A Notion database managed by a sync. You define its schema in code.                                     |
| **Pacer**      | Rate-limits outbound API calls so you don't hit third-party quotas.                                     |
| **OAuth**      | Handles authorization flows for services like GitHub and Google.                                        |
| **Secrets**    | Environment variables stored securely and injected at runtime.                                          |

## Typical workflow

<Steps>
  <Step title="Scaffold a project">
    ```bash theme={null}
    ntn workers new
    ```

    This creates a new directory with a `src/index.ts` starter file, TypeScript config, and dependencies.
  </Step>

  <Step title="Write your capabilities">
    Add syncs, tools, or webhooks to `src/index.ts`. Use an AI coding agent to help. The template includes prompts and skills, like the `/sync` skill.
  </Step>

  <Step title="Deploy">
    ```bash theme={null}
    ntn workers deploy
    ```

    The CLI bundles your code, uploads it to Notion, and starts running your capabilities.
  </Step>

  <Step title="Iterate">
    Edit your code and redeploy.
  </Step>
</Steps>

## Next steps

<CardGroup cols={2}>
  <Card title="Quickstart" icon="https://mintcdn.com/notion-demo/yKfkO8UsVZTLLPNp/icons/nds/arrowChevronDoubleForward.svg?fit=max&auto=format&n=yKfkO8UsVZTLLPNp&q=85&s=e9dad4152e1d3bf11e6a8404d9504665" href="/workers/get-started/quickstart" horizontal color="#0076d7" width="20" height="20" data-path="icons/nds/arrowChevronDoubleForward.svg">
    Create and deploy your first worker in less than five minutes.
  </Card>

  <Card title="CLI reference" icon="https://mintcdn.com/notion-demo/7WdlNb9IZkRhGCcR/icons/nds/terminal.svg?fit=max&auto=format&n=7WdlNb9IZkRhGCcR&q=85&s=ed75fe4bd49b0ec0117eeead6adb4e5d" href="/cli/get-started/overview" horizontal color="#0076d7" width="20" height="20" data-path="icons/nds/terminal.svg">
    Install and configure the Notion CLI.
  </Card>
</CardGroup>

> ## Documentation Index
> Fetch the complete documentation index at: https://developers.notion.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Quickstart

> Create and deploy your first worker in minutes.

Get up and running with Workers in a few steps.

## Prerequisites

<CardGroup cols={2}>
  <Card title="Node.js" icon="node-js" horizontal color="#0076d7">
    Version 22 or higher
  </Card>

  <Card title="npm" icon="npm" horizontal color="#0076d7">
    Version 10 or higher
  </Card>
</CardGroup>

## Create your first worker

<Steps>
  <Step title="Install the CLI">
    ```bash theme={null}
    curl -fsSL https://ntn.dev | bash
    ```
  </Step>

  <Step title="Initialize a new project">
    Scaffold a new worker project:

    ```bash theme={null}
    ntn workers new
    ```

    Choose a folder name when prompted.
  </Step>

  <Step title="Deploy to Notion">
    Connect to your Notion workspace and deploy:

    ```bash theme={null}
    ntn workers deploy
    ```

    Follow the prompts to authenticate with your Notion workspace.
  </Step>

  <Step title="Run the sample tool">
    Execute the included sample tool:

    ```bash theme={null}
    ntn workers exec sayHello -d '{"name": "World"}'
    ```
  </Step>
</Steps>

## What's in a worker?

The scaffolded project lives in `src/index.ts` and exports a single `Worker` instance:

```typescript src/index.ts theme={null}
import { Worker } from "@notionhq/workers";

const worker = new Worker();
export default worker;

worker.tool("sayHello", {
  title: "Say Hello",
  description: "Returns a friendly greeting",
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
    },
    required: ["name"],
    additionalProperties: false,
  },
  execute: ({ name }) => `Hello, ${name}!`,
});
```

## Next steps

<CardGroup cols={2}>
  <Card title="Syncs" icon="https://mintcdn.com/notion-demo/7WdlNb9IZkRhGCcR/icons/nds/arrowCircleLoopForward.svg?fit=max&auto=format&n=7WdlNb9IZkRhGCcR&q=85&s=25d8d1ea2405c9af06347df80ab90fcf" href="/workers/guides/syncs" horizontal color="#0076d7" width="20" height="20" data-path="icons/nds/arrowCircleLoopForward.svg">
    Sync external data into Notion databases.
  </Card>

  <Card title="Agent tools" icon="https://mintcdn.com/notion-demo/7WdlNb9IZkRhGCcR/icons/nds/aiFace.svg?fit=max&auto=format&n=7WdlNb9IZkRhGCcR&q=85&s=d473a8d294324c9f2e19f44d487744dd" href="/workers/guides/tools" horizontal color="#0076d7" width="20" height="20" data-path="icons/nds/aiFace.svg">
    Build custom tools for Notion AI.
  </Card>

  <Card title="Webhooks" icon="https://mintcdn.com/notion-demo/yKfkO8UsVZTLLPNp/icons/nds/bell.svg?fit=max&auto=format&n=yKfkO8UsVZTLLPNp&q=85&s=0ee1c6e084361d853c48609a1f989a2c" href="/workers/guides/webhooks" horizontal color="#0076d7" width="20" height="20" data-path="icons/nds/bell.svg">
    Receive HTTP events from external services.
  </Card>

  <Card title="OAuth" icon="https://mintcdn.com/notion-demo/yKfkO8UsVZTLLPNp/icons/nds/pathRoundEnds.svg?fit=max&auto=format&n=yKfkO8UsVZTLLPNp&q=85&s=f1b9491091d34c2249a03218696218a3" href="/workers/guides/oauth" horizontal color="#0076d7" width="20" height="20" data-path="icons/nds/pathRoundEnds.svg">
    Connect to third-party APIs.
  </Card>
</CardGroup>

> ## Documentation Index
> Fetch the complete documentation index at: https://developers.notion.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Syncs

> Pull external data into Notion databases and keep it up to date.

A sync pulls data from external sources like Salesforce, Stripe, and GitHub and writes it to a [Notion database](/guides/data-apis/working-with-databases). You define a schema for the database and an `execute` function that returns the data. Notion runs it on a schedule and manages the database for you.

## Define a database and sync

Every sync needs a database to write to. Declare one with `worker.database()`, then register a sync that targets it:

```typescript src/index.ts theme={null}
import { Worker } from "@notionhq/workers";
import * as Builder from "@notionhq/workers/builder";
import * as Schema from "@notionhq/workers/schema";

const worker = new Worker();
export default worker;

const issues = worker.database("issues", {
  // only "managed" type is supported for now
  type: "managed",
  // the initial title of the database
  initialTitle: "Issues",
  // the property that uniquely identifies each row
  primaryKeyProperty: "Issue ID",
  // the schema defines the structure of the database
  schema: {
    // define each database property and its type
    properties: {
      Name: Schema.title(),
      "Issue ID": Schema.richText(),
      Status: Schema.richText(),
    },
  },
});

worker.sync("issuesSync", {
  // ...
});
```

`primaryKeyProperty` tells Notion which property uniquely identifies each row. This is typically the entity's ID in the external API (e.g., a Salesforce Contact ID or GitHub issue ID). When your sync emits a record with the same `key`, Notion updates the existing row instead of creating a duplicate.

<Tip>
  Syncs currently create and manage their own databases. Support for syncing to existing databases is coming soon.
</Tip>

### Schema and properties

The `schema.properties` object defines the columns of your Notion database. Each property uses a `Schema` helper to declare its type, and each upsert uses the corresponding `Builder` helper to set its value.

For the full list of supported property types, see [Schema and builders](/workers/reference/schema).

## Choose a sync mode

Workers support two sync modes. Pick the one that fits your needs:

<Tabs>
  <Tab title="Replace (default)">
    Each sync cycle returns the **full dataset**. After the final `hasMore: false`, any rows not seen during that cycle are automatically deleted.

    Best for smaller datasets (under 10k records) or APIs that don't support change tracking. Also used as the [backfill half](#combine-backfill-and-delta-syncs) of a backfill + delta pair.

    ```typescript theme={null}
    worker.sync("teamsSync", {
      database: teams,
      mode: "replace",
      execute: async (state) => {
        const page = state?.page ?? 1;
        const { items, hasMore } = await fetchPage(page, 100);
        return {
          changes: items.map((item) => ({
            type: "upsert" as const,
            key: item.id,
            properties: {
              Name: Builder.title(item.name),
              ID: Builder.richText(item.id),
            },
          })),
          hasMore,
          nextState: hasMore ? { page: page + 1 } : undefined,
        };
      },
    });
    ```
  </Tab>

  <Tab title="Incremental">
    Each sync cycle returns only **changes since the last run**. Rows not mentioned are left as-is. Deletions must be explicit.

    Best for large datasets (10k+ records) or APIs that provide a changes endpoint or cursor. Typically used as the [delta half](#combine-backfill-and-delta-syncs) of a backfill + delta pair.

    ```typescript theme={null}
    worker.sync("eventsSync", {
      database: events,
      mode: "incremental",
      execute: async (state) => {
        const { upserts, deletes, nextCursor } = await fetchChanges(state?.cursor);
        return {
          changes: [
            ...upserts.map((item) => ({
              type: "upsert" as const,
              key: item.id,
              properties: {
                Name: Builder.title(item.name),
                ID: Builder.richText(item.id),
              },
            })),
            ...deletes.map((id) => ({
              type: "delete" as const,
              key: id,
            })),
          ],
          hasMore: Boolean(nextCursor),
          nextState: nextCursor ? { cursor: nextCursor } : undefined,
        };
      },
    });
    ```
  </Tab>
</Tabs>

## Paginate large datasets

When syncing more than a few hundred records, break the work into batches. The runtime calls `execute` repeatedly until you return `hasMore: false`:

1. Return a batch of changes with `hasMore: true` and a `nextState` value.
2. The runtime calls `execute` again, passing that state back as the first argument.
3. Repeat until you return `hasMore: false`.

`nextState` can be any serializable value, such as a cursor string, page number, timestamp, or object. Start with batch sizes of \~100 records.

```typescript theme={null}
worker.sync("paginatedSync", {
  database: records,
  execute: async (state) => {
    const { items, nextCursor } = await fetchPage(state?.cursor);
    return {
      changes: items.map((item) => ({
        type: "upsert" as const,
        key: item.id,
        properties: {
          Name: Builder.title(item.name),
          ID: Builder.richText(item.id),
        },
      })),
      hasMore: Boolean(nextCursor),
      nextState: nextCursor ? { cursor: nextCursor } : undefined,
    };
  },
});
```

## Set a schedule

A schedule controls how often Notion triggers your sync. Each time it triggers, the runtime calls `execute` repeatedly until it returns `hasMore: false`, then waits for the next scheduled trigger. The default schedule is every 30 minutes.

```typescript theme={null}
worker.sync("frequentSync", {
  database: myDb,
  schedule: "5m",
  // ...
});
```

| Value                           | Behavior                            |
| :------------------------------ | :---------------------------------- |
| `"5m"`, `"15m"`, `"1h"`, `"1d"` | Run at the given interval           |
| `"manual"`                      | Only run when triggered via the CLI |

<Info>
  Minimum schedule is `"5m"`, maximum is `"7d"`.
</Info>

## Combine backfill and delta syncs

A single replace sync works for small datasets, but most real integrations need two things: fast updates (minutes, not hours) and the ability to re-sync everything when needed. You get both by registering two syncs against the same database:

* A **delta sync** runs on a schedule and fetches only what changed since the last run. This keeps the database near-real-time.
* A **backfill sync** paginates the entire upstream dataset. You trigger it manually, for example after a schema change, to populate a new property, or to catch anything the delta missed.

Since both syncs share a database and key space, upserts from both operate on the same rows. The delta keeps the database current and the backfill re-syncs the full dataset when you need to:

|                  | Delta sync                                                | Backfill sync                          |
| :--------------- | :-------------------------------------------------------- | :------------------------------------- |
| **Mode**         | `incremental`                                             | `replace`                              |
| **Schedule**     | `"5m"` or `"30m"`                                         | `"manual"`                             |
| **What it does** | Grabs recent changes via `updated_since` or a change feed | Paginates the entire upstream dataset  |
| **Deletes**      | Emits `type: "delete"` if the API supports it             | Mark-and-sweep catches everything else |
| **When it runs** | Continuously on schedule                                  | On demand                              |

```typescript theme={null}
// Delta: near-real-time updates
worker.sync("ticketsDelta", {
  database: tickets,
  mode: "incremental",
  schedule: "5m",
  execute: async (state) => {
    await apiPacer.wait();
    const { items, nextCursor } = await fetchTicketChanges(state?.cursor);
    return {
      changes: items.map((t) => ({
        type: "upsert" as const,
        key: t.id,
        properties: {
          Summary: Builder.title(t.summary),
          "Ticket ID": Builder.richText(t.id),
        },
      })),
      hasMore: Boolean(nextCursor),
      nextState: nextCursor ? { cursor: nextCursor } : undefined,
    };
  },
});

// Backfill: full dataset sweep, run manually
worker.sync("ticketsBackfill", {
  database: tickets,
  mode: "replace",
  schedule: "manual",
  execute: async (state) => {
    const page = state?.page ?? 1;
    await apiPacer.wait();
    const { items, hasMore } = await fetchAllTickets(page);
    return {
      changes: items.map((t) => ({
        type: "upsert" as const,
        key: t.id,
        properties: {
          Summary: Builder.title(t.summary),
          "Ticket ID": Builder.richText(t.id),
        },
      })),
      hasMore,
      nextState: hasMore ? { page: page + 1 } : undefined,
    };
  },
});
```

In this example, to run a backfill at any point in the future, you'd reset the state then trigger the sync to start running:

```bash theme={null}
ntn workers sync state reset ticketsBackfill
ntn workers sync trigger ticketsBackfill
```

This pattern gives you operational flexibility: run a backfill after a schema change to populate a new property, or after a bug fix to correct drifted data. This pattern also handles deletes cleanly even when the API doesn't surface them, as the backfill's replace-mode mark-and-sweep catches anything the delta missed.

<Tip>
  If both syncs hit the same API, give them the same [pacer](#rate-limit-outbound-requests). The runtime automatically splits the rate limit budget between them.
</Tip>

## Relate two databases

Link databases together with `Schema.relation()` and `Builder.relation()`:

```typescript theme={null}
const projects = worker.database("projects", {
  type: "managed",
  initialTitle: "Projects",
  primaryKeyProperty: "Project ID",
  schema: {
    properties: {
      Name: Schema.title(),
      "Project ID": Schema.richText(),
    },
  },
});

const tasks = worker.database("tasks", {
  type: "managed",
  initialTitle: "Tasks",
  primaryKeyProperty: "Task ID",
  schema: {
    properties: {
      Name: Schema.title(),
      "Task ID": Schema.richText(),
      Project: Schema.relation("projects", {
        twoWay: true,
        relatedPropertyName: "Tasks",
      }),
    },
  },
});

worker.sync("projectsSync", {
  database: projects,
  execute: async () => { /* ... */ },
});

worker.sync("tasksSync", {
  database: tasks,
  execute: async () => {
    const items = await fetchTasks();
    return {
      changes: items.map((task) => ({
        type: "upsert" as const,
        key: task.id,
        properties: {
          Name: Builder.title(task.name),
          "Task ID": Builder.richText(task.id),
          Project: [Builder.relation(task.projectId)],
        },
      })),
      hasMore: false,
    };
  },
});
```

In the example above, `Schema.relation("projects")` references the database name `projects` from `worker.database("projects", ...)`, and the `twoWay: true` option adds a "Tasks" rollup column to the Projects database automatically.

## Authenticate with external APIs

Most syncs need credentials for the external API they pull from. You have two options:

* **API keys and tokens:** store them as [secrets](/workers/guides/secrets) and read from `process.env`.
* **OAuth:** for APIs that require user authorization (GitHub, Google, Salesforce), register an [OAuth capability](/workers/guides/oauth) and call `accessToken()` in your `execute` function.

To call the Notion API from a sync (e.g., to read pages or update properties beyond sync changes), see [Using the Notion API from a worker](/workers/guides/api-client).

## Rate-limit outbound requests

Use a pacer to avoid hitting third-party API rate limits:

```typescript theme={null}
const api = worker.pacer("api", { allowedRequests: 10, intervalMs: 1000 });

worker.sync("customersSync", {
  database: customers,
  execute: async (state) => {
    await api.wait();
    const data = await fetchCustomers(state?.cursor);
    // ...
  },
});
```

`await api.wait()` blocks until a request slot is available. In this example, at most 10 requests per second.

## Manage syncs from the CLI

```bash theme={null}
# Live-updating status dashboard
ntn workers sync status

# Preview output without writing to the database
ntn workers sync trigger <syncKey> --preview

# Trigger a real sync immediately
ntn workers sync trigger <syncKey>

# Reset sync state (restart from scratch)
ntn workers sync state reset <syncKey>

# Pause a sync
ntn workers capabilities disable <syncKey>

# Resume a sync
ntn workers capabilities enable <syncKey>
```

<Note>
  Deploying does **not** reset sync state. Syncs resume from their last cursor position. See [Resetting and migrating state](#reset-and-migrate-state) below.
</Note>

## Reset and migrate state

Deploys never clear sync state. Your sync picks up where it left off. If you need to start fresh (e.g., after changing your schema or fixing a bug in your `execute` function), reset the state:

```bash theme={null}
ntn workers sync state reset <syncKey>
```

This clears the stored `nextState` so the next run starts from scratch, as if the sync had never run before.

To inspect the current state before deciding whether to reset:

```bash theme={null}
ntn workers sync state get <syncKey>
```

## Troubleshooting syncs

### Sync runs but no rows appear

* Check `ntn workers sync trigger <syncKey> --preview` to see what your `execute` function returns without writing to the database. If the preview is empty, the issue is in your data-fetching code.
* Make sure the `key` in each change matches the property named by `primaryKeyProperty`.

### Rows are duplicated

* Each row needs a unique `key`. If two changes share the same key, the second overwrites the first. If keys differ, Notion creates separate rows. Double-check that your key is the stable external ID, not a value that changes between runs.

### Stale rows aren't deleted (replace mode)

* Replace mode only deletes stale rows after the final page returns `hasMore: false`. If your sync errors partway through, no deletions happen (this is intentional to avoid data loss).

### Sync is stuck or out of date

* Run `ntn workers sync status` to see the current state and last run time.
* If state is corrupted or outdated, reset it with `ntn workers sync state reset <syncKey>`.

### Checking logs

List recent runs:

```bash theme={null}
ntn workers runs list
```

View execution logs for a specific run:

```bash theme={null}
ntn workers runs logs <runId>
```

See the [CLI command reference](/cli/reference/commands) for the full list of `ntn workers sync` flags and options.

## Next steps

<CardGroup cols={2}>
  <Card title="Schema and builders" icon="code" href="/workers/reference/schema">
    Full reference for database property types and value builders.
  </Card>

  <Card title="SDK reference" icon="book-open" href="/workers/reference/sdk">
    Detailed API docs for worker.sync(), worker.database(), and worker.pacer().
  </Card>

  <Card title="Secrets" icon="lock" href="/workers/guides/secrets">
    Store API keys and credentials for your sync.
  </Card>

  <Card title="OAuth" icon="key" href="/workers/guides/oauth">
    Connect to APIs that require user authorization.
  </Card>
</CardGroup>


> ## Documentation Index
> Fetch the complete documentation index at: https://developers.notion.com/llms.txt
> Use this file to discover all available pages before exploring further.

# How to write an agent tool

> Build custom tools that Notion Custom Agents can call.

Agent tools are functions that [Notion Custom Agents](https://www.notion.com/help/custom-agents) can call. Use a tool when an agent needs to look up external data, call your own service, perform an action that is not built into Notion or available through MCP, or apply custom validation that an MCP server does not provide.

This guide shows you how to add a tool to a worker, define its inputs, test it locally, and deploy it.

## Add a tool

In `src/index.ts`, import `Worker` and the schema builder:

```typescript theme={null}
import { Worker } from "@notionhq/workers";
import { j } from "@notionhq/workers/schema-builder";

const worker = new Worker();
export default worker;
```

Register a tool with `worker.tool`:

```typescript theme={null}
worker.tool("lookupCustomer", {
	title: "Lookup Customer",
	description: "Find a customer by email address.",
	schema: j.object({
		email: j.email().describe("The customer's email address."),
	}),
	hints: { readOnlyHint: true },
	execute: async ({ email }) => {
		const customer = await findCustomerByEmail(email);

		if (!customer) {
			return {
				found: false,
				message: `No customer found for ${email}.`,
			};
		}

		return {
			found: true,
			name: customer.name,
			plan: customer.plan,
			accountUrl: customer.accountUrl,
		};
	},
});
```

The first argument, `"lookupCustomer"`, is the tool key. Use it when you run the tool from the CLI.

Choose a key that is stable and specific. If you rename a tool key, existing agent configuration that refers to the old key needs to be updated.

## Describe when the agent should use it

The `title` and `description` help Notion Custom Agents and users understand the tool. Keep the title short and write the description as an instruction boundary: what the tool does, and when it should be used.

```typescript theme={null}
worker.tool("createSupportTicket", {
	title: "Create Support Ticket",
	description:
		"Create a support ticket when the user asks to escalate an issue to the support team.",
	// ...
});
```

Avoid descriptions that are too broad, such as "Run support operations". A narrow description makes the tool easier for the agent to choose correctly.

## Define the input schema

Use the `j` schema builder to define the values your tool accepts. The builder creates a JSON Schema and gives TypeScript types to the `execute` input. See the [Schema and builders reference](/workers/reference/schema) for all available types.

```typescript theme={null}
worker.tool("searchTickets", {
	// ...
	schema: j.object({
		query: j.string().describe("The search query."),
		limit: j
			.number()
			.describe("The maximum number of results to return.")
			.nullable(),
		status: j.enum("open", "closed").describe("The ticket status to search."),
	}),
	// ...
});
```

Use `.describe()` on every field. Field descriptions tell the agent what each value means.

Use `.nullable()` for optional fields:

```typescript theme={null}
worker.tool("searchTickets", {
	// ...
	schema: j.object({
		query: j.string().describe("The search query."),
		limit: j
			.number()
			.describe("The maximum number of results to return.")
			.nullable(),
	}),
	// ...
});
```

In `execute`, handle nullable fields explicitly:

```typescript theme={null}
worker.tool("searchTickets", {
	// ...
	execute: async ({ query, limit }) => {
		const results = await searchTickets({
			query,
			limit: limit ?? 10,
		});

		return { results };
	},
});
```

The schema builder marks object properties as required and sets `additionalProperties: false`. Use `.nullable()` instead of omitting a property from the schema when a value is optional.

## Return structured output

A tool can return a string or any JSON-serialisable value. Prefer structured objects for results the agent may need to inspect or reuse:

```typescript theme={null}
worker.tool("lookupCustomer", {
	// ...
	execute: async ({ email }) => {
		const customer = await findCustomerByEmail(email);

		if (!customer) {
			return { found: false };
		}

		return {
			found: true,
			customer: {
				name: customer.name,
				plan: customer.plan,
				accountUrl: customer.accountUrl,
			},
		};
	},
});
```

If the output has a predictable shape, add `outputSchema`. The worker validates the returned value against this schema.

```typescript theme={null}
worker.tool("searchTickets", {
	// ...
	outputSchema: j.object({
		results: j.array(
			j.object({
				id: j.string().describe("The ticket ID."),
				title: j.string().describe("The ticket title."),
				url: j.string().describe("A URL for the ticket."),
			}),
		),
	}),
	execute: async ({ query }) => {
		const tickets = await searchTickets(query);
		return {
			results: tickets.map(ticket => ({
				id: ticket.id,
				title: ticket.title,
				url: ticket.url,
			})),
		};
	},
});
```

## Mark read-only tools

If a tool only reads data and has no side effects, set `readOnlyHint`:

```typescript theme={null}
worker.tool("previewAccountDeletion", {
	title: "Preview Account Deletion",
	description:
		"Inspect what would be affected if an account were deleted, without deleting or changing anything.",
	// ...
	hints: { readOnlyHint: true },
	// ...
});
```

Read-only tools are safe to call repeatedly and can be auto-executed under the default policy. Tools without this hint are treated as write tools, so the Custom Agent will ask for permission from the user before executing the tool unless the agent's settings change that behaviour.

## Use Notion and external APIs

The second argument to `execute` is a context object. Use `context.notion` to call the Notion API with the worker's authenticated Notion client. The client has the same permissions as the Custom Agent running the tool:

```typescript theme={null}
worker.tool("getPageTitle", {
	title: "Get Page Title",
	description: "Read the title of a Notion page.",
	schema: j.object({
		pageId: j.string().describe("The Notion page ID."),
	}),
	hints: { readOnlyHint: true },
	execute: async ({ pageId }, { notion }) => {
		const page = await notion.pages.retrieve({ page_id: pageId });
		return page;
	},
});
```

For external APIs, store credentials as worker [secrets](/workers/guides/secrets) and read them from `process.env`. For APIs that require user authorization (GitHub, Google, Salesforce), use [OAuth](/workers/guides/oauth) instead.

For more on `context.notion`, see [Using the Notion API from a worker](/workers/guides/api-client).

## Test a tool locally

Run the tool from your worker project with `ntn workers exec --local`:

```bash theme={null}
ntn workers exec lookupCustomer --local -d '{"email":"ada@example.com"}'
```

The CLI loads `.env` by default for local execution. To load another file, pass `--dotenv`:

```bash theme={null}
ntn workers exec lookupCustomer --local --dotenv .env.local -d '{"email":"ada@example.com"}'
```

<Note>
  The Workers runtime injects a preauthenticated Notion SDK client when your
  tool runs in Notion, but that client is not available during local execution.
  When testing locally, we recommend setting `NOTION_API_TOKEN` to a
  [personal access token](/guides/get-started/personal-access-tokens) in your
  `.env` file, which the SDK uses to create the client.
</Note>

If you do not want to load a `.env` file, pass `--no-dotenv`:

```bash theme={null}
ntn workers exec lookupCustomer --local --no-dotenv -d '{"email":"ada@example.com"}'
```

Use local execution to check schema validation, returned output, and errors before deploying.

## Deploy and run the tool

Deploy the worker:

```bash theme={null}
ntn workers deploy
```

After deployment, run the hosted tool from the CLI:

```bash theme={null}
ntn workers exec lookupCustomer -d '{"email":"ada@example.com"}'
```

When the tool works as expected, add it to a Notion Custom Agent from the agent's tool configuration.

See the [CLI command reference](/cli/reference/commands) for all `ntn workers exec` flags and options.

## Next steps

<CardGroup cols={2}>
  <Card title="Schema and builders" icon="code" href="/workers/reference/schema">
    Full reference for the j schema builder and all input types.
  </Card>

  <Card title="SDK reference" icon="book-open" href="/workers/reference/sdk#worker-tool">
    Detailed API docs for worker.tool(), hints, and output schemas.
  </Card>

  <Card title="Secrets" icon="lock" href="/workers/guides/secrets">
    Store API keys and credentials for your tools.
  </Card>

  <Card title="Notion API" icon="database" href="/workers/guides/api-client">
    Read and write Notion data from inside a tool.
  </Card>
</CardGroup>


> ## Documentation Index
> Fetch the complete documentation index at: https://developers.notion.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Webhooks

> Receive HTTP events from external services in a Notion Worker.

Webhooks expose an HTTP endpoint that external services can call. Use them to push events from external systems into Notion, such as a GitHub push, Stripe event, Zendesk ticket update, or any service that can send an HTTP webhook.

## Basic webhook

Define a webhook capability on your worker like this:

```typescript theme={null}
import { Worker } from "@notionhq/workers";

const worker = new Worker();
export default worker;

worker.webhook("onExternalEvent", {
  title: "External Event Handler",
  description: "Processes incoming webhook requests",
  execute: async (events) => {
    for (const event of events) {
      console.log("Delivery:", event.deliveryId);
      console.log("Method:", event.method);
      console.log("Body:", event.body);
    }
  },
});
```

After you deploy, Notion creates a URL for each webhook capability. Give that URL to the external service as its webhook destination:

```bash theme={null}
ntn workers deploy
ntn workers webhooks list
```

## The event object

The `execute` function receives an array of `WebhookEvent` objects. The array currently contains one event, but may contain multiple events in the future.

| Property     | Type                      | Description                                                                                   |
| :----------- | :------------------------ | :-------------------------------------------------------------------------------------------- |
| `deliveryId` | `string`                  | Unique ID for this Notion delivery. It is stable across retries for the same inbound request. |
| `body`       | `Record<string, unknown>` | Parsed JSON body. If the request body is not a JSON object, this is `{}`.                     |
| `rawBody`    | `string`                  | Original request body as a string. Use this for signature verification.                       |
| `headers`    | `Record<string, string>`  | Request headers. Header names are lowercased.                                                 |
| `method`     | `string`                  | HTTP method used by the sender. Webhook URLs accept `POST` requests.                          |

<Tip>
  Use the external provider's own event ID for idempotency when the payload includes one.
  `deliveryId` is useful when Notion retries running your worker, but a provider may
  redeliver the same event as a new HTTP request.
</Tip>

## Webhook URLs

Webhook URLs include a unique ID that acts as a shared secret:

```text theme={null}
https://www.notion.so/webhooks/worker/{spaceId}/{workerId}/{uniqueWebhookId}/{webhookName}
```

Use the CLI to print the URLs for a deployed worker:

```bash theme={null}
ntn workers webhooks list
```

For scripts, use JSON or tab-separated output:

```bash theme={null}
ntn workers webhooks list --json
ntn workers webhooks list --plain
```

<Warning>
  Treat webhook URLs as secrets. Anyone with the full URL can send events to the
  webhook endpoint unless you add provider-specific signature verification inside your worker.
</Warning>

## Verify requests

Most webhook providers can sign requests with a shared [secret](/workers/guides/secrets). Store the signing secret as a worker secret, verify each request using `event.rawBody` and `event.headers`, and throw `WebhookVerificationError` when verification fails:

```typescript theme={null}
import * as crypto from "node:crypto";
import { WebhookVerificationError, Worker } from "@notionhq/workers";

const worker = new Worker();
export default worker;

/**
 * Verify a GitHub webhook signature.
 * GitHub sends the HMAC-SHA256 signature in the X-Hub-Signature-256 header
 * as "sha256={hex}". The raw body must be used for verification.
 */
function verifyGitHubSignature(
  rawBody: string,
  headers: Record<string, string>,
): void {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    throw new WebhookVerificationError("GITHUB_WEBHOOK_SECRET not configured");
  }

  const signature = headers["x-hub-signature-256"];
  if (!signature?.startsWith("sha256=")) {
    throw new WebhookVerificationError("Invalid GitHub signature");
  }

  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")}`;

  if (signature.length !== expected.length) {
    throw new WebhookVerificationError("Invalid GitHub signature");
  }

  // Use timing-safe comparison to prevent timing attacks.
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new WebhookVerificationError("Invalid GitHub signature");
  }
}

worker.webhook("onGithubPush", {
  title: "GitHub Push Webhook",
  description: "Handles push events from GitHub repositories",
  execute: async (events) => {
    for (const event of events) {
      verifyGitHubSignature(event.rawBody, event.headers);
      console.log("Verified GitHub event:", event.body);
    }
  },
});
```

Set the secret before deploying or push it from your local `.env` file:

```bash theme={null}
ntn workers env set GITHUB_WEBHOOK_SECRET=your-secret
```

See [Secrets](/workers/guides/secrets) for more ways to manage worker environment variables.

<Warning>
  After 5 consecutive `WebhookVerificationError` failures, Notion blocks that
  webhook before running your handler. Redeploy the worker to reset the failure
  counter.
</Warning>

## Execution and retries

When a webhook request reaches Notion, Notion validates the URL, enqueues the event, and responds with `202 Accepted`. Your worker runs asynchronously after the HTTP response is sent.

If your handler throws `WebhookVerificationError`, Notion records a verification failure and does not retry that event. If your handler throws another error, Notion retries the worker run up to 3 times.

Successful runs reset the consecutive verification failure counter.

## Use Notion from a webhook

Webhook handlers receive the same context object as other capabilities, including `context.notion`, the Notion API SDK client:

```typescript theme={null}
worker.webhook("createPageFromWebhook", {
  title: "Create Page From Webhook",
  description: "Creates a page when an external event is received",
  execute: async (events, { notion }) => {
    const databaseId = process.env.MY_WEBHOOK_DATABASE_ID;

    if (!databaseId) {
      throw new Error("MY_WEBHOOK_DATABASE_ID is not configured");
    }

    for (const event of events) {
      const externalId =
        typeof event.body.id === "string" ? event.body.id : event.deliveryId;

      await notion.pages.create({
        parent: { database_id: databaseId },
        properties: {
          Name: {
            title: [
              {
                text: {
                  content: `Webhook event ${externalId}`,
                },
              },
            ],
          },
        },
      });
    }
  },
});
```

For webhooks, `context.notion` is not automatically authenticated. To call the Notion API, create an internal integration, give it access to the relevant pages or databases, and store the integration token in `NOTION_API_TOKEN`:

```bash theme={null}
ntn workers env set NOTION_API_TOKEN=secret_xxx
```

At runtime, `context.notion` reads `process.env.NOTION_API_TOKEN` and uses it as the Notion API client token.

For more information about creating an integration token for a worker, see [Using the Notion API from a worker](/workers/guides/api-client).

## Inspect runs

Use worker run logs to debug webhook executions:

```bash theme={null}
ntn workers runs list
ntn workers runs logs <run-id>
```

To find recent webhook runs quickly:

```bash theme={null}
ntn workers runs list --plain | grep webhook
```

See the [CLI command reference](/cli/reference/commands) for all `ntn workers` flags and options.

## Next steps

<CardGroup cols={2}>
  <Card title="Secrets" icon="lock" href="/workers/guides/secrets">
    Store webhook signing secrets and API keys.
  </Card>

  <Card title="Notion API" icon="database" href="/workers/guides/api-client">
    Read and write Notion data from a webhook handler.
  </Card>

  <Card title="OAuth" icon="key" href="/workers/guides/oauth">
    Authenticate with third-party APIs from your webhook.
  </Card>

  <Card title="SDK reference" icon="book-open" href="/workers/reference/sdk#worker-webhook">
    Detailed API docs for worker.webhook() and WebhookVerificationError.
  </Card>
</CardGroup>


> ## Documentation Index
> Fetch the complete documentation index at: https://developers.notion.com/llms.txt
> Use this file to discover all available pages before exploring further.

# OAuth

> Authenticate with third-party APIs like GitHub, Google, and Salesforce from a Notion Worker.

Use OAuth when the API you're connecting to requires user authorization, such as GitHub, Google, Salesforce, and most SaaS APIs. You register an OAuth capability on your worker, deploy, complete the authorization flow via the CLI, and then call `accessToken()` in your code to get a valid token.

## Define an OAuth capability

Call `worker.oauth()` with your provider's OAuth 2.0 endpoints and credentials:

```typescript src/index.ts theme={null}
import { Worker } from "@notionhq/workers";

const worker = new Worker();
export default worker;

const githubAuth = worker.oauth("githubAuth", {
  name: "github-oauth",
  authorizationEndpoint: "https://github.com/login/oauth/authorize",
  tokenEndpoint: "https://github.com/login/oauth/access_token",
  scope: "repo user",
  clientId: process.env.GITHUB_CLIENT_ID ?? "",
  clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
});
```

<Warning>
  Store your `clientId` and `clientSecret` as [secrets](/workers/guides/secrets), not in code:

  ```bash theme={null}
  ntn workers env set GITHUB_CLIENT_ID=xxx GITHUB_CLIENT_SECRET=yyy
  ```
</Warning>

### Configuration options

| Property                | Required | Description                                                                         |
| :---------------------- | :------- | :---------------------------------------------------------------------------------- |
| `name`                  | Yes      | Unique identifier for this OAuth connection                                         |
| `authorizationEndpoint` | Yes      | The provider's OAuth 2.0 authorization URL                                          |
| `tokenEndpoint`         | Yes      | The provider's OAuth 2.0 token exchange URL                                         |
| `clientId`              | Yes      | Your OAuth app's client ID                                                          |
| `clientSecret`          | Yes      | Your OAuth app's client secret                                                      |
| `scope`                 | Yes      | Space-separated list of OAuth scopes to request                                     |
| `authorizationParams`   | No       | Additional parameters to include in the authorization request                       |
| `accessTokenExpireMs`   | No       | Default token expiry in milliseconds (for providers that don't return `expires_in`) |

## Deploy and authorize

Setting up OAuth requires multiple steps in a specific order. The worker must be deployed before you can store secrets or start the OAuth flow:

<Steps>
  <Step title="Deploy your worker">
    If you haven't deployed at least once already, do so first. The first deploy registers the worker with Notion. Your OAuth credentials won't be available yet (that's expected).

    ```bash theme={null}
    ntn workers deploy
    ```
  </Step>

  <Step title="Get your redirect URL">
    ```bash theme={null}
    ntn workers oauth show-redirect-url
    ```

    You'll need this when creating the OAuth app with your provider.
  </Step>

  <Step title="Create an OAuth app with your provider">
    Go to your provider's developer settings (e.g., GitHub Developer Settings, Google Cloud Console) and create an OAuth app. Add the redirect URL from the previous step as an authorized redirect URI. Copy the client ID and client secret.
  </Step>

  <Step title="Store your OAuth credentials">
    ```bash theme={null}
    ntn workers env set GITHUB_CLIENT_ID=xxx GITHUB_CLIENT_SECRET=yyy
    ```
  </Step>

  <Step title="Deploy again">
    Redeploy so the worker picks up the credentials:

    ```bash theme={null}
    ntn workers deploy
    ```
  </Step>

  <Step title="Start the OAuth flow">
    ```bash theme={null}
    ntn workers oauth start githubAuth
    ```

    This opens a browser window where you authorize the connection. Once complete, the worker runtime stores the token securely.
  </Step>
</Steps>

## Use the token

Call `accessToken()` on the OAuth capability object to get a valid token. The runtime handles refresh automatically. This works in [tools](/workers/guides/tools), [syncs](/workers/guides/syncs), and [webhooks](/workers/guides/webhooks):

```typescript theme={null}
import { j } from "@notionhq/workers/schema-builder";

worker.tool("getGitHubRepos", {
  title: "Get GitHub repos",
  description: "Fetch the user's GitHub repositories",
  schema: j.object({}),
  execute: async () => {
    const token = await githubAuth.accessToken();
    const response = await fetch("https://api.github.com/user/repos", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.json();
  },
});
```

This works the same way in syncs and webhooks:

```typescript theme={null}
import * as Builder from "@notionhq/workers/builder";

worker.sync("githubIssuesSync", {
  database: issues,
  execute: async (state) => {
    const token = await githubAuth.accessToken();
    const response = await fetch("https://api.github.com/issues", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const items = await response.json();
    return {
      changes: items.map((issue) => ({
        type: "upsert" as const,
        key: String(issue.id),
        properties: {
          Title: Builder.title(issue.title),
          "Issue ID": Builder.richText(String(issue.id)),
        },
      })),
      hasMore: false,
    };
  },
});
```

## Test locally

Once you've completed the OAuth flow (via `ntn workers oauth start`), pull your environment to get a fresh access token locally:

```bash theme={null}
ntn workers env pull
```

This writes a `.env` file with all your worker's secrets, including a fresh OAuth access token. The server refreshes the token automatically before returning it, so the token you get is always valid.

You can then test your capability locally with the `--local` flag:

```bash theme={null}
ntn workers exec getGitHubRepos --local
```

<Info>
  OAuth tokens expire. If you get a 401 from the provider, run `ntn workers env pull` again to get a refreshed token.
</Info>

## Examples

### Google

```typescript theme={null}
const googleAuth = worker.oauth("googleAuth", {
  name: "google-oauth",
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  scope: "https://www.googleapis.com/auth/calendar.readonly",
  clientId: process.env.GOOGLE_CLIENT_ID ?? "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  authorizationParams: {
    access_type: "offline",
    prompt: "consent",
  },
});
```

### Salesforce

```typescript theme={null}
const salesforceAuth = worker.oauth("salesforceAuth", {
  name: "salesforce-oauth",
  authorizationEndpoint: "https://login.salesforce.com/services/oauth2/authorize",
  tokenEndpoint: "https://login.salesforce.com/services/oauth2/token",
  scope: "api refresh_token",
  clientId: process.env.SALESFORCE_CLIENT_ID ?? "",
  clientSecret: process.env.SALESFORCE_CLIENT_SECRET ?? "",
});
```

<Tip>
  Some providers (like Salesforce) don't return `expires_in` in their token response. Set `accessTokenExpireMs` to a sensible default (e.g., `3600000` for 1 hour) so the runtime knows when to refresh.
</Tip>

## Next steps

<CardGroup cols={2}>
  <Card title="Secrets" icon="lock" href="/workers/guides/secrets">
    Store API keys and OAuth credentials securely.
  </Card>

  <Card title="Syncs" icon="rotate" href="/workers/guides/syncs">
    Sync external data into Notion databases.
  </Card>

  <Card title="Webhooks" icon="bell" href="/workers/guides/webhooks">
    Receive HTTP events from external services.
  </Card>
</CardGroup>


> ## Documentation Index
> Fetch the complete documentation index at: https://developers.notion.com/llms.txt
> Use this file to discover all available pages before exploring further.

# How to manage secrets

> Store API keys and credentials for your worker securely.

Secrets let your [Notion Workers](/workers/get-started/overview) use API keys, tokens, client secrets, webhook signing secrets, and other credentials without committing those values to your source code.

Notion encrypts worker secrets at rest and exposes them as environment variables at runtime. In your worker code, read them from `process.env`.

```typescript theme={null}
const apiKey = process.env.OPENWEATHER_API_KEY;
```

<Warning>
  Never commit `.env` files or any type of secret to source control. Worker
  projects created from the template include `.env` and `.env.*` in `.gitignore`
  by default.
</Warning>

## Add a secret

Use `ntn workers env set` to store one or more secrets for your worker:

```bash theme={null}
ntn workers env set OPENWEATHER_API_KEY=your-secret
```

To set multiple secrets at once, pass multiple `KEY=value` pairs:

```bash theme={null}
ntn workers env set GITHUB_CLIENT_ID=your-client-id GITHUB_CLIENT_SECRET=your-client-secret
```

If a key already exists, setting it again replaces the previous value.

<Tip>
  Quote values that contain spaces, shell metacharacters, or other characters
  your shell might interpret.
</Tip>

## Use a secret in worker code

Read secrets from `process.env` inside your worker capability:

```typescript theme={null}
worker.tool("getWeather", {
  title: "Get Weather",
  description: "Fetch the current weather for a city",
  schema: {
    type: "object",
    properties: {
      city: { type: "string" },
    },
    required: ["city"],
    additionalProperties: false,
  },
  execute: async ({ city }) => {
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      throw new Error("OPENWEATHER_API_KEY is not configured");
    }

    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        city,
      )}&appid=${apiKey}`,
    );

    return response.json();
  },
});
```

## Pull secrets for local development

When you run a worker locally, use a `.env` file to provide the same environment variables that the hosted worker receives.

Pull remote secrets into `.env`:

```bash theme={null}
ntn workers env pull
```

Or write to a different file:

```bash theme={null}
ntn workers env pull --file=.env.local
```

If the file already exists, `pull` preserves comments, blank lines, and local-only keys. It updates keys that also exist remotely, then appends new remote keys.

For non-interactive scripts, add `--yes` to skip the confirmation prompt:

```bash theme={null}
ntn workers env pull --yes
```

<Warning>
  Treat any pulled `.env` file as sensitive. Confirm that the file is ignored by Git
  before you pull secrets into a project.
</Warning>

## Push local secrets to your worker

If you've added secrets locally to `.env`, push them to the hosted worker:

```bash theme={null}
ntn workers env push
```

Or push a different file:

```bash theme={null}
ntn workers env push --file=.env.local
```

`push` adds new local keys and updates changed local keys. It does not remove keys that exist only in the remote worker environment.

For non-interactive scripts, add `--yes`:

```bash theme={null}
ntn workers env push --yes
```

## Manage another worker

When you run these commands inside a worker project, the CLI reads the worker ID from `workers.json`. To manage a different worker, pass its worker ID.

For `set` and `unset`, use `--worker-id`:

```bash theme={null}
ntn workers env set --worker-id <worker-id> API_KEY=your-secret
ntn workers env unset --worker-id <worker-id> API_KEY
```

For `list`, `pull`, and `push`, pass the worker ID as the positional argument:

```bash theme={null}
ntn workers env list <worker-id>
ntn workers env pull <worker-id>
ntn workers env push <worker-id>
```

## Use secrets for OAuth client credentials

For custom OAuth providers, store the OAuth client ID and client secret as worker secrets:

```bash theme={null}
ntn workers env set GITHUB_CLIENT_ID=xxx GITHUB_CLIENT_SECRET=yyy
```

Then read them from `process.env` in the OAuth capability configuration:

```typescript theme={null}
worker.oauth("githubAuth", {
  name: "github-oauth",
  authorizationEndpoint: "https://github.com/login/oauth/authorize",
  tokenEndpoint: "https://github.com/login/oauth/access_token",
  scope: "repo user",
  clientId: process.env.GITHUB_CLIENT_ID ?? "",
  clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
});
```

## Command summary

| Command                         | What it does                                            |
| :------------------------------ | :------------------------------------------------------ |
| `ntn workers env set KEY=value` | Stores or replaces one or more secrets                  |
| `ntn workers env list`          | Lists secret keys without revealing values              |
| `ntn workers env unset KEY`     | Removes a secret                                        |
| `ntn workers env pull`          | Writes remote secrets to a local `.env` file            |
| `ntn workers env push`          | Adds or updates remote secrets from a local `.env` file |

See the [CLI command reference](/cli/reference/commands) for all `ntn workers env` flags and options.

## Next steps

<CardGroup cols={2}>
  <Card title="OAuth" icon="key" href="/workers/guides/oauth">
    Authenticate with third-party APIs using OAuth.
  </Card>

  <Card title="Syncs" icon="rotate" href="/workers/guides/syncs">
    Sync external data into Notion databases.
  </Card>

  <Card title="Agent tools" icon="wand-magic-sparkles" href="/workers/guides/tools">
    Build custom tools for Notion AI.
  </Card>

  <Card title="Webhooks" icon="bell" href="/workers/guides/webhooks">
    Receive HTTP events from external services.
  </Card>
</CardGroup>

> ## Documentation Index
> Fetch the complete documentation index at: https://developers.notion.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Using the Notion API from a worker

> Read and write Notion pages and databases from inside a Notion Worker.

Every capability's `execute` function receives a [Notion API client](https://github.com/makenotion/notion-sdk-js) as `context.notion`. This is the official `@notionhq/client` SDK (the same one you'd use outside of Workers):

```typescript theme={null}
worker.tool("example", {
  // ...
  execute: async (input, { notion }) => {
    const page = await notion.pages.retrieve({ page_id: "..." });
    return page;
  },
});
```

## Authentication

How the client is authenticated depends on how the capability runs:

| Context                                                | How it works                                                                                                                  |
| :----------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| **Tool called by a Custom Agent**                      | The platform sets `NOTION_API_TOKEN` automatically. The client has the same permissions as the Custom Agent. No setup needed. |
| **Syncs, webhooks, local testing, `ntn workers exec`** | You must provide a token yourself.                                                                                            |

To set a token for syncs, webhooks, or local development, you have two options:

* **[Personal access token](/guides/get-started/personal-access-tokens):** acts as you, with access to everything your user has access to. Simpler to set up since you don't need to manually connect it to each page.
* **[Internal integration token](/guides/get-started/internal-connections):** acts as a bot, with access limited to pages explicitly connected via the Connections menu.

<Steps>
  <Step title="Create a token">
    Create a [personal access token](https://www.notion.so/profile/integrations) or an [internal integration](https://www.notion.so/profile/integrations/internal) and copy the token.
  </Step>

  <Step title="Store the token as a secret">
    ```bash theme={null}
    ntn workers env set NOTION_API_TOKEN=ntn_...
    ```
  </Step>

  <Step title="Grant access (internal integrations only)">
    If using an internal integration, open each page or database your worker needs access to, click the **three-dot menu** in the top right, and add the integration under **Connections**. This step is not needed for personal access tokens.
  </Step>
</Steps>

For local development, pull secrets to a `.env` file so the token is available when running `ntn workers exec`:

```bash theme={null}
ntn workers env pull
```

## Common operations

The examples below use `{ notion }` destructured from the second argument to `execute`. They work the same way in tools, syncs, and webhooks:

### Query a database

```typescript theme={null}
const response = await notion.databases.query({
  database_id: "...",
  filter: {
    property: "Status",
    select: { equals: "Active" },
  },
});

for (const page of response.results) {
  // process each page
}
```

### Retrieve a page

```typescript theme={null}
const page = await notion.pages.retrieve({
  page_id: "...",
});
```

### Create a page

```typescript theme={null}
await notion.pages.create({
  parent: { database_id: "..." },
  properties: {
    Name: {
      title: [{ text: { content: "New item" } }],
    },
    Status: {
      select: { name: "Open" },
    },
  },
});
```

### Update page properties

```typescript theme={null}
await notion.pages.update({
  page_id: "...",
  properties: {
    Status: {
      select: { name: "Done" },
    },
  },
});
```

### Search

```typescript theme={null}
const results = await notion.search({
  query: "meeting notes",
  filter: { property: "object", value: "page" },
});
```

### Read page content (blocks)

```typescript theme={null}
const blocks = await notion.blocks.children.list({
  block_id: pageId,
});
```

## Permissions

What the client can access depends on the token type:

* **Custom Agent tools:** the client has the same permissions as the Custom Agent.
* **Personal access token:** the client can access everything you can access in Notion.
* **Internal integration token:** the client can only access pages and databases that the integration has been explicitly connected to via the Connections menu.

If a request returns a 403 or 404, check that your token has access to the relevant page.

For full SDK documentation, see the [Notion API reference](/reference/intro) and the [TypeScript SDK on GitHub](https://github.com/makenotion/notion-sdk-js).

## Next steps

<CardGroup cols={2}>
  <Card title="Syncs" icon="rotate" href="/workers/guides/syncs">
    Sync external data into Notion databases.
  </Card>

  <Card title="Agent tools" icon="wand-magic-sparkles" href="/workers/guides/tools">
    Build custom tools for Notion AI.
  </Card>

  <Card title="Webhooks" icon="bell" href="/workers/guides/webhooks">
    Receive HTTP events from external services.
  </Card>

  <Card title="OAuth" icon="key" href="/workers/guides/oauth">
    Connect to third-party APIs with user authorization.
  </Card>

  <Card title="Secrets" icon="lock" href="/workers/guides/secrets">
    Store API keys and credentials securely.
  </Card>
</CardGroup>

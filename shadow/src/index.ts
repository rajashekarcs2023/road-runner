// Shadow — Preview Mode for Notion AI.
//
// Entry point. Side-effect imports register all capabilities (sync + tools)
// onto the shared `worker` instance declared in worker.ts.

import { worker } from "./worker.js";

// Register capabilities. All four are worker.tool — no worker.sync, because
// sync-managed DB properties are read-only to tools (blocks triage from
// writing to the shadow). The shadowThisDB tool replaces what would have
// been a sync.
import "./tools/shadow-this-db.js";
import "./tools/triage.js";
import "./tools/diff.js";
import "./tools/promote.js";
import "./tools/explain-promotion.js";
import "./tools/shadow-console.js";
import "./tools/apply-corrections.js";

export default worker;


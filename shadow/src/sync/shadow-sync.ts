// DEPRECATED — kept as a stub for import compatibility. The worker.sync
// approach was abandoned because sync-managed DB properties are read-only
// to tools, which blocks the triage tool from writing back to the shadow.
//
// The shadow mirroring logic now lives in src/tools/shadow-this-db.ts as an
// imperative worker.tool that creates rows directly via notion.pages.create.
// The shadow DB itself is a user-owned regular Notion DB created via
// scripts/setup-shadow-db.ts.

export {};

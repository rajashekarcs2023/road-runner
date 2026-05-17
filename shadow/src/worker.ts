import { Worker } from "@notionhq/workers";

// Single Worker instance shared across all capability registrations.
// Side-effect imports in index.ts register sync + tools onto this instance.
export const worker = new Worker();

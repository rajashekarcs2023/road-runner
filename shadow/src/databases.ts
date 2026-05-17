// Compatibility shim. The worker and the pacer moved to their own modules.
// Keep this file so old imports still resolve during the rename.
export { worker } from "./worker.js";
export { notionPacer } from "./lib/notion-pacer.js";

import { j } from "@notionhq/workers/schema-builder";
import { worker } from "../worker.js";
import { notionPacer } from "../lib/notion-pacer.js";
import {
  getProp,
  extractRequestId,
  fetchAllRows,
  fetchAllBlockChildren,
} from "../lib/notion-utils.js";

const PROMOTED_FIELDS = [
  "Priority",
  "Owner",
  "Status",
  "Classification",
  "Severity Score",
  "Draft Response",
] as const;

function propsFromShadow(shadowRow: any): Record<string, any> {
  const props: Record<string, any> = {};

  const priority = getProp(shadowRow, "Priority");
  if (priority) props.Priority = { select: { name: priority } };

  const owner = getProp(shadowRow, "Owner");
  if (owner) props.Owner = { select: { name: owner } };

  const status = getProp(shadowRow, "Status");
  if (status) props.Status = { select: { name: status } };

  const classification = getProp(shadowRow, "Classification");
  props.Classification = {
    rich_text: [{ text: { content: classification } }],
  };

  const severityScore = getProp(shadowRow, "Severity Score");
  if (severityScore) {
    const n = Number(severityScore);
    if (Number.isFinite(n)) props["Severity Score"] = { number: n };
  }

  const draft = getProp(shadowRow, "Draft Response");
  props["Draft Response"] = { rich_text: [{ text: { content: draft } }] };

  return props;
}

function buildAuditBlock(requestId: string, shadowRow: any, realRow: any) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const parts: string[] = [`${ts} — promoted ${requestId}`];
  for (const field of PROMOTED_FIELDS) {
    const before = getProp(realRow, field);
    const after = getProp(shadowRow, field);
    if (before !== after && (before || after)) {
      parts.push(`${field}: "${before || "(empty)"}" → "${after}"`);
    }
  }
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [{ type: "text", text: { content: parts.join(" | ") } }],
    },
  };
}

worker.tool("promoteSelected", {
  title: "Promote Selected",
  description:
    "Read the Diff Report page, apply every checked row's shadow values to the real DB, and append one entry per promotion to the Audit Log page. Rows that are unchecked are NOT promoted. Use this when the user says 'promote selected' or 'apply the changes I checked'.",
  schema: j.object({}),
  execute: async (_input, { notion }) => {
    const realDbId = process.env.REQUESTS_DB_ID;
    const shadowDbId = process.env.REQUESTS_SHADOW_DB_ID;
    const reportPageId = process.env.DIFF_REPORT_PAGE_ID;
    const auditPageId = process.env.AUDIT_LOG_PAGE_ID;
    if (!realDbId || !shadowDbId || !reportPageId || !auditPageId) {
      throw new Error(
        "Missing env: REQUESTS_DB_ID, REQUESTS_SHADOW_DB_ID, DIFF_REPORT_PAGE_ID, AUDIT_LOG_PAGE_ID must all be set.",
      );
    }

    await notionPacer.wait();
    const blocks = await fetchAllBlockChildren(notion, reportPageId);

    const checkedIds: string[] = [];
    for (const b of blocks as any[]) {
      if (b.type !== "to_do") continue;
      if (!b.to_do?.checked) continue;
      const id = extractRequestId(b.to_do.rich_text);
      if (id) checkedIds.push(id);
    }

    if (checkedIds.length === 0) {
      return { promoted: 0, skipped: 0, message: "No rows checked in Diff Report." };
    }

    // Build lookup maps once, paginated.
    await notionPacer.wait();
    const realPages = await fetchAllRows(notion, realDbId);
    await notionPacer.wait();
    const shadowPages = await fetchAllRows(notion, shadowDbId);

    const realByKey = new Map<string, any>(
      realPages.map((p: any) => [getProp(p, "Request ID"), p]),
    );
    const shadowByKey = new Map<string, any>(
      shadowPages.map((p: any) => [getProp(p, "Request ID"), p]),
    );

    let promoted = 0;
    let skipped = 0;
    const auditBlocks: any[] = [];
    const message = "";

    for (const id of checkedIds) {
      const realRow = realByKey.get(id);
      const shadowRow = shadowByKey.get(id);
      if (!realRow || !shadowRow) {
        skipped++;
        continue;
      }
      try {
        await notionPacer.wait();
        await notion.pages.update({
          page_id: realRow.id,
          properties: propsFromShadow(shadowRow),
        });
        auditBlocks.push(buildAuditBlock(id, shadowRow, realRow));
        promoted++;
      } catch (_e) {
        skipped++;
      }
    }

    // Append audit log entries in chunks of 100.
    for (let i = 0; i < auditBlocks.length; i += 100) {
      await notionPacer.wait();
      await notion.blocks.children.append({
        block_id: auditPageId,
        children: auditBlocks.slice(i, i + 100),
      });
    }

    return { promoted, skipped, message };
  },
});

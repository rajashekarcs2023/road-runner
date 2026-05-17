// Helpers for pulling values out of Notion API page objects, and for paginating
// through Notion's collections (databases.query and blocks.children.list both
// cap at 100 results per request).

export function getProp(page: any, propName: string): string {
  const p = page?.properties?.[propName];
  if (!p) return "";
  if (p.title) return p.title.map((t: any) => t.plain_text ?? "").join("");
  if (p.rich_text) return p.rich_text.map((t: any) => t.plain_text ?? "").join("");
  if (p.select) return p.select?.name ?? "";
  if (p.number !== undefined && p.number !== null) return String(p.number);
  if (p.date) return p.date?.start ?? "";
  if (p.checkbox !== undefined) return p.checkbox ? "true" : "false";
  return "";
}

// Promote tool uses this to parse "Request ID: REQ-001" out of a to_do block's
// rich_text array. The diff renderer guarantees this exact substring is the
// first text run in every checked to_do block.
export function extractRequestId(richTextArray: any[]): string | null {
  if (!Array.isArray(richTextArray)) return null;
  const flat = richTextArray.map((r: any) => r.plain_text ?? "").join("");
  const match = flat.match(/REQ-\d+/);
  return match ? match[0] : null;
}

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

// Pure diff function. No I/O. Easy to test.
//
// Joins two row collections on primary key and emits structured per-row deltas.
// The renderer (src/tools/diff.ts) turns these into Notion blocks; the promote
// tool reads checkboxes off the renderer's output to decide which deltas to
// apply. This file only computes — it never touches Notion.

export type RowValues = Record<string, string | number | null | undefined>;

export type Row = {
  requestId: string;
  values: RowValues;
};

export type FieldDelta = {
  field: string;
  before: string;
  after: string;
};

export type RowDiff = {
  requestId: string;
  kind: "added" | "modified" | "deleted";
  fieldDeltas: FieldDelta[];
};

const SKIP_FIELDS = new Set<string>([
  // Last Touched mutates on every shadow edit. Not a real diff.
  "Last Touched",
]);

function normalize(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function compareFields(real: Row, shadow: Row): FieldDelta[] {
  const allKeys = new Set([
    ...Object.keys(real.values),
    ...Object.keys(shadow.values),
  ]);
  const deltas: FieldDelta[] = [];
  for (const field of allKeys) {
    if (SKIP_FIELDS.has(field)) continue;
    const before = normalize(real.values[field]);
    const after = normalize(shadow.values[field]);
    if (before !== after) {
      deltas.push({ field, before, after });
    }
  }
  return deltas;
}

export function computeDiff(real: Row[], shadow: Row[]): RowDiff[] {
  const realByKey = new Map(real.map((r) => [r.requestId, r]));
  const shadowByKey = new Map(shadow.map((r) => [r.requestId, r]));
  const allKeys = new Set([...realByKey.keys(), ...shadowByKey.keys()]);

  const diffs: RowDiff[] = [];
  for (const key of allKeys) {
    const r = realByKey.get(key);
    const s = shadowByKey.get(key);
    if (!r && s) {
      diffs.push({ requestId: key, kind: "added", fieldDeltas: [] });
    } else if (r && !s) {
      diffs.push({ requestId: key, kind: "deleted", fieldDeltas: [] });
    } else if (r && s) {
      const deltas = compareFields(r, s);
      if (deltas.length > 0) {
        diffs.push({ requestId: key, kind: "modified", fieldDeltas: deltas });
      }
    }
  }
  diffs.sort((a, b) => a.requestId.localeCompare(b.requestId));
  return diffs;
}

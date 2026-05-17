import { describe, it, expect } from "vitest";
import { computeDiff, type Row } from "./diff.js";

const mkRow = (id: string, values: Row["values"] = {}): Row => ({
  requestId: id,
  values,
});

describe("computeDiff", () => {
  it("returns [] when real and shadow are identical", () => {
    const real = [mkRow("REQ-001", { Priority: "Low", Owner: "Unassigned" })];
    const shadow = [mkRow("REQ-001", { Priority: "Low", Owner: "Unassigned" })];
    expect(computeDiff(real, shadow)).toEqual([]);
  });

  it("emits 'added' for rows present in shadow but not real", () => {
    const real = [mkRow("REQ-001", { Priority: "Low" })];
    const shadow = [
      mkRow("REQ-001", { Priority: "Low" }),
      mkRow("REQ-002", { Priority: "High" }),
    ];
    const diffs = computeDiff(real, shadow);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({ requestId: "REQ-002", kind: "added" });
  });

  it("emits 'modified' for rows with property differences", () => {
    const real = [mkRow("REQ-001", { Priority: "Low", Owner: "Unassigned" })];
    const shadow = [mkRow("REQ-001", { Priority: "High", Owner: "Security" })];
    const diffs = computeDiff(real, shadow);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].kind).toBe("modified");
    expect(diffs[0].fieldDeltas).toEqual(
      expect.arrayContaining([
        { field: "Priority", before: "Low", after: "High" },
        { field: "Owner", before: "Unassigned", after: "Security" },
      ]),
    );
  });

  it("ignores the 'Last Touched' field", () => {
    const real = [
      mkRow("REQ-001", { Priority: "Low", "Last Touched": "2026-05-17T00:00:00Z" }),
    ];
    const shadow = [
      mkRow("REQ-001", { Priority: "Low", "Last Touched": "2026-05-17T09:30:00Z" }),
    ];
    expect(computeDiff(real, shadow)).toEqual([]);
  });

  it("emits a delta for new property: Severity Score appearing from empty to a value", () => {
    const real = [mkRow("REQ-001", { Priority: "Low", "Severity Score": "" })];
    const shadow = [mkRow("REQ-001", { Priority: "Low", "Severity Score": 75 })];
    const diffs = computeDiff(real, shadow);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].fieldDeltas).toEqual([
      { field: "Severity Score", before: "", after: "75" },
    ]);
  });

  it("emits 'deleted' for rows present in real but not shadow", () => {
    const real = [mkRow("REQ-001"), mkRow("REQ-002")];
    const shadow = [mkRow("REQ-001")];
    const diffs = computeDiff(real, shadow);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({ requestId: "REQ-002", kind: "deleted" });
  });

  it("treats null and undefined as empty string", () => {
    const real = [mkRow("REQ-001", { Owner: null, Status: undefined })];
    const shadow = [mkRow("REQ-001", { Owner: "Security", Status: "Triaged" })];
    const diffs = computeDiff(real, shadow);
    expect(diffs[0].fieldDeltas).toEqual(
      expect.arrayContaining([
        { field: "Owner", before: "", after: "Security" },
        { field: "Status", before: "", after: "Triaged" },
      ]),
    );
  });

  it("sorts results by requestId for stable rendering", () => {
    const real = [mkRow("REQ-003"), mkRow("REQ-001"), mkRow("REQ-002")];
    const shadow = [
      mkRow("REQ-003", { Priority: "High" }),
      mkRow("REQ-001", { Priority: "High" }),
      mkRow("REQ-002", { Priority: "High" }),
    ];
    const diffs = computeDiff(real, shadow);
    expect(diffs.map((d) => d.requestId)).toEqual(["REQ-001", "REQ-002", "REQ-003"]);
  });
});

import { describe, it, expect } from "vitest";
import { getProp, extractRequestId } from "./notion-utils.js";

describe("getProp", () => {
  it("reads a title property", () => {
    const page = {
      properties: { Name: { title: [{ plain_text: "Hello" }, { plain_text: " world" }] } },
    };
    expect(getProp(page, "Name")).toBe("Hello world");
  });

  it("reads a rich_text property", () => {
    const page = {
      properties: { "Inbound Text": { rich_text: [{ plain_text: "Need SOC2" }] } },
    };
    expect(getProp(page, "Inbound Text")).toBe("Need SOC2");
  });

  it("reads a select property", () => {
    const page = { properties: { Priority: { select: { name: "High" } } } };
    expect(getProp(page, "Priority")).toBe("High");
  });

  it("reads a number property", () => {
    const page = { properties: { "Severity Score": { number: 75 } } };
    expect(getProp(page, "Severity Score")).toBe("75");
  });

  it("reads a date property", () => {
    const page = { properties: { "Last Touched": { date: { start: "2026-05-17" } } } };
    expect(getProp(page, "Last Touched")).toBe("2026-05-17");
  });

  it("returns empty string for missing property", () => {
    expect(getProp({ properties: {} }, "Missing")).toBe("");
  });

  it("returns empty string when page is null", () => {
    expect(getProp(null, "Anything")).toBe("");
  });

  it("returns empty string for null select", () => {
    expect(getProp({ properties: { Priority: { select: null } } }, "Priority")).toBe("");
  });
});

describe("extractRequestId", () => {
  it("returns REQ-001 from 'Request ID: REQ-001'", () => {
    const richText = [{ plain_text: "Request ID: REQ-001" }];
    expect(extractRequestId(richText)).toBe("REQ-001");
  });

  it("returns the request ID even when split across multiple text runs", () => {
    const richText = [{ plain_text: "Request ID: " }, { plain_text: "REQ-042" }];
    expect(extractRequestId(richText)).toBe("REQ-042");
  });

  it("returns null when no match present", () => {
    const richText = [{ plain_text: "Just some other text" }];
    expect(extractRequestId(richText)).toBeNull();
  });

  it("returns null for non-array input", () => {
    expect(extractRequestId(null as any)).toBeNull();
    expect(extractRequestId(undefined as any)).toBeNull();
  });

  it("returns first match if multiple IDs appear", () => {
    const richText = [{ plain_text: "REQ-001 and REQ-002" }];
    expect(extractRequestId(richText)).toBe("REQ-001");
  });
});

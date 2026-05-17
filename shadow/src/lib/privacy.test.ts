import { describe, it, expect } from "vitest";
import { redactPII, restorePII } from "./privacy.js";

describe("redactPII", () => {
  it("returns empty result for empty input", () => {
    const r = redactPII("");
    expect(r.redacted).toBe("");
    expect(r.map).toEqual({});
  });

  it("redacts emails with stable tokens", () => {
    const r = redactPII("Email me at sarah@acme.com or john@test.io");
    expect(r.redacted).toBe("Email me at [EMAIL_1] or [EMAIL_2]");
    expect(r.map["[EMAIL_1]"]).toBe("sarah@acme.com");
    expect(r.map["[EMAIL_2]"]).toBe("john@test.io");
    expect(r.counts.emails).toBe(2);
  });

  it("redacts URLs", () => {
    const r = redactPII("See https://example.com/help and http://foo.io");
    expect(r.redacted).toContain("[URL_1]");
    expect(r.redacted).toContain("[URL_2]");
    expect(r.counts.urls).toBe(2);
  });

  it("redacts phones in multiple formats", () => {
    const r = redactPII("Call (650) 555-0142 or 415.555.9000 or 4155551234");
    expect(r.counts.phones).toBeGreaterThanOrEqual(2);
  });

  it("restorePII is the exact inverse of redactPII", () => {
    const original = "Hi sarah@acme.com call me at (650) 555-0142 or visit https://acme.com";
    const r = redactPII(original);
    expect(restorePII(r.redacted, r.map)).toBe(original);
  });

  it("preserves text without PII unchanged", () => {
    const original = "Need SOC2 docs for procurement review.";
    const r = redactPII(original);
    expect(r.redacted).toBe(original);
    expect(r.counts).toEqual({ emails: 0, phones: 0, urls: 0, ssns: 0, creditCards: 0 });
  });

  it("handles overlapping cases — URL containing email-like substring", () => {
    const r = redactPII("Go to https://example.com/mail?to=test@x.com");
    // URL should be captured as one token; emails after should still work.
    expect(r.redacted).toContain("[URL_1]");
    expect(r.counts.urls).toBe(1);
  });
});

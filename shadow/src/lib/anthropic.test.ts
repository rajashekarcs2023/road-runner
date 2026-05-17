import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Anthropic SDK before importing the module under test.
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class {
      messages = { create: mockCreate };
    },
  };
});

const { triageOneRow } = await import("./anthropic.js");

beforeEach(() => {
  mockCreate.mockReset();
});

describe("triageOneRow", () => {
  it("parses a valid JSON response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          text: JSON.stringify({
            priority: "High",
            owner: "Security",
            classification: "SOC2, compliance",
            severityScore: 72,
            draft: "Thanks for the SOC2 ask. Our Security team will follow up with the packet. Expect a response within one business day.",
          }),
        },
      ],
    });

    const result = await triageOneRow("Need SOC2 and SSO");
    expect(result.priority).toBe("High");
    expect(result.owner).toBe("Security");
    expect(result.severityScore).toBe(72);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("retries once if first response is not parseable JSON", async () => {
    mockCreate
      .mockResolvedValueOnce({ content: [{ text: "Here is the answer: invalid prose" }] })
      .mockResolvedValueOnce({
        content: [
          {
            text: JSON.stringify({
              priority: "Medium",
              owner: "Support",
              classification: "general",
              severityScore: 20,
              draft: "Thanks for reaching out. Support will be in touch.",
            }),
          },
        ],
      });

    const result = await triageOneRow("hello");
    expect(result.priority).toBe("Medium");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("strips markdown fences from JSON response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          text:
            "```json\n" +
            JSON.stringify({
              priority: "Urgent",
              owner: "Engineering",
              classification: "production outage",
              severityScore: 95,
              draft: "We see the outage. Engineering is on it now.",
            }) +
            "\n```",
        },
      ],
    });

    const result = await triageOneRow("Production is down");
    expect(result.priority).toBe("Urgent");
    expect(result.severityScore).toBe(95);
  });

  it("clamps out-of-range severity scores", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          text: JSON.stringify({
            priority: "Low",
            owner: "Support",
            classification: "discount",
            severityScore: 250, // out of range
            draft: "Thanks.",
          }),
        },
      ],
    });
    const result = await triageOneRow("hi");
    expect(result.severityScore).toBe(100);
  });

  it("defaults invalid priority/owner to safe values", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          text: JSON.stringify({
            priority: "Critical", // not in allowed set
            owner: "Marketing", // not in allowed set
            classification: "weird",
            severityScore: 50,
            draft: "Thanks.",
          }),
        },
      ],
    });
    const result = await triageOneRow("test");
    expect(result.priority).toBe("Medium");
    expect(result.owner).toBe("Support");
  });
});

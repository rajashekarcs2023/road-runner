import Anthropic from "@anthropic-ai/sdk";

// AI self-correction. When the Reviewer flags a Triager-produced draft as
// Risky, this rewrites the draft taking the Reviewer's concern into account
// — without losing the underlying intent.
//
// This is the multi-turn AI collaboration step. By the time the human sees
// the diff, AI #1 has already learned from AI #2 and produced a safer
// version. The human reviews the corrected draft, not the original.

const SYSTEM_PROMPT = `You are rewriting a customer-facing draft response that another AI flagged as risky. Your job is to preserve the helpful intent but remove the specific concerns the Reviewer raised.

Output STRICT JSON. No prose. No markdown fence.

{
  "corrected": "the rewritten draft, 2-3 sentences"
}

Rules:
- Keep the warm, professional tone.
- Remove specific commitments to timelines, prices, regulatory postures (SOC2, HIPAA, FedRAMP), or features unless the original concern was clearly about something else.
- Replace specific promises with intent to follow up: "we'll get back to you", "we'll be in touch", "our team will follow up shortly".
- Name the owner team that will handle it (Support / Security / Sales / Engineering).
- Don't acknowledge the rewrite. The customer should not see "rewritten" or "corrected" — just a natural, safer response.
- If the Reviewer concern is about routing (wrong owner), do not change the draft — the issue is elsewhere. Output the original.`;

export async function correctDraft(
  inbound: string,
  originalDraft: string,
  reviewerConcern: string,
): Promise<string> {
  const userMessage = [
    "Inbound message:",
    inbound,
    "",
    "Original draft response (flagged risky by Reviewer):",
    originalDraft,
    "",
    "Reviewer's concern:",
    reviewerConcern,
  ].join("\n");

  const c = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await c.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });
  const text = (response.content[0] as any)?.text ?? "";
  // Tolerant JSON extraction.
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  let parsed = tryParse(text);
  if (!parsed) {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) parsed = tryParse(fenced[1]);
  }
  if (!parsed) {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) parsed = tryParse(m[0]);
  }
  const corrected = typeof parsed?.corrected === "string" ? parsed.corrected : originalDraft;
  return corrected;
}

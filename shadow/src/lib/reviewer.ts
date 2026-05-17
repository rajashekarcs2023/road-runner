// Reviewer Agent — Claude #2. Watches Claude #1 (the triager).
//
// Takes the original inbound text + the triager's proposed change, returns a
// risk verdict (safe/review/risky) and a short reason. The diff renderer uses
// this verdict to default-check or default-uncheck each row's to_do block,
// turning the diff into a risk-graded review surface.
//
// This is the multi-agent safety primitive: AI #1 acts, AI #2 audits, human
// makes the final call. The shadow DB carries both AIs' outputs side by side
// so the diff is more than "what changed" — it's "what changed AND whether
// the second AI thinks the first AI got it right."

import Anthropic from "@anthropic-ai/sdk";
import type { TriageResult } from "./anthropic.js";

const SYSTEM_PROMPT = `You are a Reviewer agent supervising a Triage agent. You will see one inbound customer request and the Triage agent's proposed action. Your job is to classify the risk of accepting that action.

Output STRICT JSON. No prose. No markdown fence.

{
  "verdict": "safe" | "review" | "risky",
  "reason": "one short sentence, under 140 characters"
}

Risk verdict rules:

SAFE — the Triage agent's call is clearly correct, and the action is low-stakes. Examples: routine support request routed to Support team with a generic acknowledgement draft. Light feature requests with Medium priority. Cases where the inbound message clearly matches the triage rules.

REVIEW — judgment call. The triage may be right but a reasonable reviewer would want to glance at it. Examples: ambiguous routing between two owner teams. Pricing inquiries that could be Sales or Support. Drafts that contain soft commitments ("we'll look into it"). Severity scores in the 60-85 range.

RISKY — the Triage agent may be wrong, OR the action is high-impact and irreversible. Always RISKY if:
- The proposed Priority is "Urgent" (always worth a human glance)
- The proposed draft contains specific time commitments ("by Friday", "within 24 hours") or pricing commitments
- The proposed draft references a specific feature, deal, or decision the company hasn't publicly committed to
- The inbound mentions a legal/regulatory term (SOC2, HIPAA, GDPR, FedRAMP) AND the proposed action sends a customer-facing reply
- The Severity Score is 86+ AND the Owner is anything other than Engineering/Security (likely a routing miss)
- The proposed Owner clearly contradicts the inbound content (e.g., security issue routed to Sales)

Be conservative. When in doubt between SAFE and REVIEW, choose REVIEW. When in doubt between REVIEW and RISKY, choose RISKY. The human can always override your verdict by checking the box.

Your reason should be short and specific. Examples:
- "Urgent priority — worth a human glance before auto-promote."
- "Draft promises 'within 24 hours' which the team hasn't committed to."
- "Compliance topic + customer-facing draft — high-blast-radius if wrong."
- "Routine support request, classification matches inbound clearly."`;

const VERDICTS = new Set(["safe", "review", "risky"]);

export type RiskVerdict = "safe" | "review" | "risky";

export type ReviewResult = {
  verdict: RiskVerdict;
  reason: string;
};

function extractJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    // continue
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // continue
    }
  }
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) {
    return JSON.parse(obj[0]);
  }
  throw new Error("No JSON object found in response");
}

function validate(parsed: any): ReviewResult {
  const v = typeof parsed?.verdict === "string" ? parsed.verdict.toLowerCase() : "";
  const verdict: RiskVerdict = (VERDICTS.has(v) ? v : "review") as RiskVerdict;
  const reason =
    typeof parsed?.reason === "string" ? parsed.reason.slice(0, 200) : "Reviewer returned no reason.";
  return { verdict, reason };
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export async function reviewOneChange(
  inbound: string,
  triage: TriageResult,
): Promise<ReviewResult> {
  const userMessage = [
    "Inbound message:",
    inbound,
    "",
    "Triage agent's proposed action:",
    `  Priority: ${triage.priority}`,
    `  Owner: ${triage.owner}`,
    `  Classification: ${triage.classification}`,
    `  Severity Score: ${triage.severityScore}`,
    `  Draft response: ${triage.draft}`,
  ].join("\n");

  const c = getClient();
  let response = await c.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });
  let text = (response.content[0] as any)?.text ?? "";

  try {
    return validate(extractJson(text));
  } catch {
    // Retry once.
    response = await c.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      system:
        SYSTEM_PROMPT +
        "\n\nYour previous output was not valid JSON. Output ONLY the JSON object.",
      messages: [{ role: "user", content: userMessage }],
    });
    text = (response.content[0] as any)?.text ?? "";
    return validate(extractJson(text));
  }
}

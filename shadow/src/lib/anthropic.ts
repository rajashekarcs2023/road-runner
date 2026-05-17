import Anthropic from "@anthropic-ai/sdk";
import { redactPII, restorePII, type RedactionResult } from "./privacy.js";

// Inlined prompt — keeps the bundle self-contained so the worker doesn't need
// to readFileSync from disk at runtime in the sandboxed deploy environment.
const SYSTEM_PROMPT = `You are triaging an inbound customer request for a SaaS company.

Output STRICT JSON matching this shape. No prose. No markdown fence.

{
  "priority": "Low" | "Medium" | "High" | "Urgent",
  "owner": "Support" | "Security" | "Sales" | "Engineering",
  "classification": "short comma-separated topic tags",
  "severityScore": <integer 0-100>,
  "draft": "a 2-3 sentence draft response in a professional but warm tone"
}

Routing rules:
- Request mentions SOC2, SSO, HIPAA, compliance, procurement, security review, audit, or pentest -> Owner=Security, Priority=High
- Request mentions a bug, error, broken, not working, crashed, 500, 503, login failure -> Owner=Engineering. Priority=High by default. Priority=Urgent if the request also mentions "down", "everyone", "all customers", "production", or "outage".
- Request mentions pricing, billing, refund, enterprise pricing, contract, invoice, discount -> Owner=Sales, Priority=Medium
- Everything else -> Owner=Support, Priority=Medium

Severity score guidance:
- 0-30: routine requests (student discount, light feature ask, general question)
- 31-60: medium business impact (single-customer bug, pricing question, integration help)
- 61-85: High-priority items (SOC2/SSO compliance request, breaking bug for one customer, billing dispute over significant amount)
- 86-100: Urgent items (production down, mass outage, security incident, data loss)

Draft response rules:
- Acknowledge the request directly. Set an expectation for follow-up. Name the owner team that will handle it.
- Do NOT make promises about timelines, prices, refunds, or specific commitments.
- 2-3 sentences. Warm but professional. No corporate jargon.`;

const PRIORITIES = new Set(["Low", "Medium", "High", "Urgent"]);
const OWNERS = new Set(["Support", "Security", "Sales", "Engineering"]);

export type TriageResult = {
  priority: "Low" | "Medium" | "High" | "Urgent";
  owner: "Support" | "Security" | "Sales" | "Engineering";
  classification: string;
  severityScore: number;
  draft: string;
};

function clampScore(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 50;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function validate(parsed: any): TriageResult {
  const priority = PRIORITIES.has(parsed?.priority) ? parsed.priority : "Medium";
  const owner = OWNERS.has(parsed?.owner) ? parsed.owner : "Support";
  const classification = typeof parsed?.classification === "string" ? parsed.classification : "";
  const draft = typeof parsed?.draft === "string" ? parsed.draft : "";
  const severityScore = clampScore(parsed?.severityScore);
  return { priority, owner, classification, severityScore, draft };
}

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

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export type TriageWithRedaction = {
  triage: TriageResult;
  redaction: RedactionResult;
};

export async function triageOneRow(inbound: string): Promise<TriageResult> {
  const { triage } = await triageOneRowWithRedaction(inbound);
  return triage;
}

// Privacy-aware triage. The Triager never sees raw PII — only token
// placeholders like [EMAIL_1], [PHONE_1], [URL_1]. The final draft is
// returned with PII restored, so the customer-facing reply looks natural.
// The redaction map is also returned so callers can audit what was hidden.
export async function triageOneRowWithRedaction(inbound: string): Promise<TriageWithRedaction> {
  const redaction = redactPII(inbound);
  const c = getClient();
  const userMessage = `Inbound message:\n${redaction.redacted}`;

  let response = await c.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });
  let text = (response.content[0] as any)?.text ?? "";

  let parsed: TriageResult;
  try {
    parsed = validate(extractJson(text));
  } catch (_e) {
    response = await c.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system:
        SYSTEM_PROMPT +
        "\n\nYour previous output was not valid JSON. Output ONLY the JSON object. No prose. No markdown fence.",
      messages: [{ role: "user", content: userMessage }],
    });
    text = (response.content[0] as any)?.text ?? "";
    parsed = validate(extractJson(text));
  }

  // Restore PII in the draft so the final customer-facing reply looks natural.
  return {
    triage: {
      ...parsed,
      draft: restorePII(parsed.draft, redaction.map),
    },
    redaction,
  };
}

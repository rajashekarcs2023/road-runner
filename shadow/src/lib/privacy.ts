// PII redaction layer. Sits between every inbound message and every Claude
// call. The Triager, Reviewer, and Corrector see token placeholders — never
// raw customer PII. PII is restored in the final Draft Response before any
// human or production write.
//
// This is the privacy primitive that complements the multi-agent supervision
// primitive. Together they answer the two enterprise objections to AI
// agents on real data: (1) "I don't trust what it will do" — Shadow gates;
// (2) "I don't want our customer PII leaving for an LLM" — Privacy layer.
//
// Implementation: deterministic regex-based redaction. No false positives
// on synthetic inputs, restorable losslessly. Token format makes the
// redaction visible to the LLM as structured placeholders, which keeps the
// model's responses well-formed.

export type RedactionMap = Record<string, string>;

export type RedactionResult = {
  redacted: string;
  map: RedactionMap;
  counts: {
    emails: number;
    phones: number;
    urls: number;
    ssns: number;
    creditCards: number;
  };
};

// Sequenced regex passes. Order matters — apply URL before email so that
// emails inside query strings don't get half-redacted.
const PATTERNS: Array<{ name: string; regex: RegExp; prefix: string }> = [
  // URLs first (so e.g. mailto: links don't cascade).
  { name: "urls", regex: /https?:\/\/\S+/g, prefix: "URL" },
  // Email addresses.
  {
    name: "emails",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    prefix: "EMAIL",
  },
  // Credit card-ish digits — 13-19 digits, optionally hyphen/space separated.
  {
    name: "creditCards",
    regex: /\b(?:\d[ -]*?){13,19}\b/g,
    prefix: "CARD",
  },
  // US SSN.
  { name: "ssns", regex: /\b\d{3}-\d{2}-\d{4}\b/g, prefix: "SSN" },
  // US phone numbers — flexible formatting.
  {
    name: "phones",
    regex: /\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
    prefix: "PHONE",
  },
];

export function redactPII(text: string): RedactionResult {
  if (!text) {
    return {
      redacted: text,
      map: {},
      counts: { emails: 0, phones: 0, urls: 0, ssns: 0, creditCards: 0 },
    };
  }

  const map: RedactionMap = {};
  const counts = { emails: 0, phones: 0, urls: 0, ssns: 0, creditCards: 0 };
  let working = text;

  for (const pattern of PATTERNS) {
    let counter = 0;
    working = working.replace(pattern.regex, (match) => {
      counter++;
      const token = `[${pattern.prefix}_${counter}]`;
      map[token] = match;
      return token;
    });
    (counts as any)[pattern.name] = counter;
  }

  return { redacted: working, map, counts };
}

export function restorePII(text: string, map: RedactionMap): string {
  if (!text) return text;
  let working = text;
  // Restore in stable order so [EMAIL_1] always maps to its original.
  for (const [token, original] of Object.entries(map)) {
    working = working.split(token).join(original);
  }
  return working;
}

export function summarizeRedactions(counts: RedactionResult["counts"]): string {
  const parts: string[] = [];
  if (counts.emails) parts.push(`${counts.emails} email${counts.emails > 1 ? "s" : ""}`);
  if (counts.phones) parts.push(`${counts.phones} phone${counts.phones > 1 ? "s" : ""}`);
  if (counts.urls) parts.push(`${counts.urls} URL${counts.urls > 1 ? "s" : ""}`);
  if (counts.ssns) parts.push(`${counts.ssns} SSN${counts.ssns > 1 ? "s" : ""}`);
  if (counts.creditCards)
    parts.push(`${counts.creditCards} card number${counts.creditCards > 1 ? "s" : ""}`);
  return parts.length > 0 ? parts.join(", ") : "none";
}

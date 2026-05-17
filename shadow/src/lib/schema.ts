import * as Schema from "@notionhq/workers/schema";

// Shared property schema for the shadow DB managed by worker.sync.
// The real DB is created manually in Notion (or by the seed script) and is
// NOT managed by this Worker — that DB is the user's source of truth for
// inbound customer requests. The Worker only owns the shadow.

export const PRIORITY_OPTIONS = [
  { name: "Low", color: "gray" as const },
  { name: "Medium", color: "yellow" as const },
  { name: "High", color: "orange" as const },
  { name: "Urgent", color: "red" as const },
];

export const OWNER_OPTIONS = [
  { name: "Unassigned", color: "default" as const },
  { name: "Support", color: "blue" as const },
  { name: "Security", color: "red" as const },
  { name: "Sales", color: "green" as const },
  { name: "Engineering", color: "purple" as const },
];

export const STATUS_OPTIONS = [
  { name: "Inbox", color: "gray" as const },
  { name: "Triaged", color: "blue" as const },
  { name: "In Progress", color: "yellow" as const },
  { name: "Resolved", color: "green" as const },
];

export const shadowSchema = {
  defaultName: "Customer Requests (Shadow)",
  properties: {
    Name: Schema.title(),
    "Request ID": Schema.richText(),
    Priority: Schema.select(PRIORITY_OPTIONS),
    Owner: Schema.select(OWNER_OPTIONS),
    Status: Schema.select(STATUS_OPTIONS),
    "Inbound Text": Schema.richText(),
    "Draft Response": Schema.richText(),
    Classification: Schema.richText(),
    "Severity Score": Schema.number(),
    "Last Touched": Schema.date(),
  },
} as const;

export type PrimaryKey = "Request ID";

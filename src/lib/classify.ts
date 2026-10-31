import { z } from "zod";
import { WORK_TYPES, WORK_TYPE_DEFINITIONS, type WorkType } from "./workTypes";

const ReportSchema = z.object({
  intern_name: z.string().nullable(),
  client_name: z.string().nullable(),
  report_date: z.string().nullable(),
  hours_spent: z.number().nullable(),
  hours_remaining: z.number().nullable(),
  tasks_summary: z.string().nullable(),
  work_types: z.array(z.enum(WORK_TYPES)),
  primary_work_type: z.enum(WORK_TYPES).nullable(),
});
const ResponseSchema = z.object({ reports: z.array(ReportSchema) });

export type ExtractedReport = z.infer<typeof ReportSchema>;

const nullable = (type: string) => ({ type: [type, "null"] });

// JSON Schema for OpenRouter structured outputs (strict mode: every property required).
const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reports"],
  properties: {
    reports: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "intern_name",
          "client_name",
          "report_date",
          "hours_spent",
          "hours_remaining",
          "tasks_summary",
          "work_types",
          "primary_work_type",
        ],
        properties: {
          intern_name: nullable("string"),
          client_name: nullable("string"),
          report_date: { ...nullable("string"), description: "YYYY-MM-DD" },
          hours_spent: { ...nullable("number"), description: "Decimal hours worked that day" },
          hours_remaining: { ...nullable("number"), description: "Decimal internship hours remaining; 0 if done" },
          tasks_summary: nullable("string"),
          work_types: { type: "array", items: { type: "string", enum: [...WORK_TYPES] } },
          primary_work_type: { type: ["string", "null"], enum: [...WORK_TYPES, null] },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `You extract structured data from intern end-of-day (EOD) reports posted in a Slack channel for a staffing agency.

A message usually contains ONE report, but may contain several (one per client or per intern) or none (chatter, questions, clock-in notes). Return one entry per report; return an empty "reports" array if the message is not an EOD report.

For each report:
- intern_name: the intern's full name as written (from "Name:" / "Prepared by:"), else null.
- client_name: the client's name as written, trimmed of titles like "Client:"; null if absent.
- report_date: the work date in YYYY-MM-DD. If the year is missing, use the year of the posted date given below.
- hours_spent: hours worked for this report as a decimal (e.g. "01:09:09" -> 1.15, "3 hrs and 37 mins" -> 3.62, "2:13 hour" -> 2.22). Null if absent or nonsensical (> 16).
- hours_remaining: internship hours remaining as a decimal; 0 if they say done/complete; negative values -> 0; null if absent.
- tasks_summary: one short sentence summarizing what was done (max 200 chars).
- work_types: every category that represents a meaningful part of the work (usually 1–3). Do not tag a category for a passing mention.
- primary_work_type: the single category that took the most effort.

Categories:
${WORK_TYPES.map((t) => `- ${t}: ${WORK_TYPE_DEFINITIONS[t as WorkType]}`).join("\n")}`;

export function classifierModel(): string {
  return process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
}

export async function extractReports(text: string, postedAtIso: string): Promise<ExtractedReport[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Intern EOD Trends",
    },
    body: JSON.stringify({
      model: classifierModel(),
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Posted at: ${postedAtIso}\n\nMessage:\n"""\n${text.slice(0, 8000)}\n"""` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "eod_reports", strict: true, schema: JSON_SCHEMA },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = body.choices?.[0]?.message?.content ?? "";
  const json = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  return ResponseSchema.parse(json).reports.map(sanitize);
}

function sanitize(r: ExtractedReport): ExtractedReport {
  const hours = r.hours_spent != null && r.hours_spent > 0 && r.hours_spent <= 16 ? round2(r.hours_spent) : null;
  const remaining = r.hours_remaining != null ? Math.max(0, round2(r.hours_remaining)) : null;
  const date = r.report_date && /^\d{4}-\d{2}-\d{2}$/.test(r.report_date) ? r.report_date : null;
  const types = [...new Set(r.work_types)];
  if (types.length === 0) types.push("admin_research_other");
  const primary = r.primary_work_type && types.includes(r.primary_work_type) ? r.primary_work_type : types[0];
  return {
    ...r,
    intern_name: tidyName(r.intern_name),
    client_name: tidyName(r.client_name),
    report_date: date,
    hours_spent: hours,
    hours_remaining: remaining,
    work_types: types,
    primary_work_type: primary,
  };
}

function tidyName(s: string | null): string | null {
  if (!s) return null;
  const t = s.replace(/[*_]/g, "").replace(/\s+/g, " ").trim();
  return t.length ? t : null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

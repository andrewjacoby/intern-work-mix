// The fixed set of work types. Order matters: it is the categorical color order
// (validated for adjacent-pair colorblind separation in stacked charts).
export const WORK_TYPES = [
  "lead_gen",
  "outreach",
  "social_content",
  "video",
  "graphic_design",
  "docs_writing",
  "client_meetings",
  "admin_research_other",
] as const;

export type WorkType = (typeof WORK_TYPES)[number];

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  lead_gen: "Lead gen & prospecting",
  outreach: "Outreach",
  social_content: "Social content",
  video: "Video",
  graphic_design: "Graphic design",
  docs_writing: "Docs & writing",
  client_meetings: "Client meetings",
  admin_research_other: "Admin, research & other",
};

// Definitions shown to the classifier (and in the dashboard footnote).
export const WORK_TYPE_DEFINITIONS: Record<WorkType, string> = {
  lead_gen:
    "Finding and qualifying prospects: lead lists, prospect/decision-maker research, Apollo/LinkedIn Sales Nav searches, contact enrichment and verification, lead databases.",
  outreach:
    "Contacting prospects or partners: cold email, LinkedIn connection requests and messages, follow-ups, DM campaigns, partner outreach.",
  social_content:
    "Planning, writing or scheduling social media posts: content calendars, captions, hashtags, hooks, carousels, posting and scheduling, profile optimization.",
  video:
    "Recording or editing video: reels, shorts, YouTube, CapCut/Premiere editing, video scripts.",
  graphic_design:
    "Visual design work: Canva graphics, templates, brand boards, logos, banners, presentations' visual design, flyers.",
  docs_writing:
    "Writing and producing documents: guides, SOPs, proposals, articles/blogs, newsletters, email copy, reports, website copy.",
  client_meetings:
    "Meetings or calls with the client: onboarding, check-ins, feedback sessions, weekly syncs.",
  admin_research_other:
    "Everything else: admin/data entry, CRM or inbox management, market/competitor research, website or funnel builds, spreadsheets, legal/medical records work, other.",
};

export function isWorkType(v: unknown): v is WorkType {
  return typeof v === "string" && (WORK_TYPES as readonly string[]).includes(v);
}

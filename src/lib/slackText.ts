// Message subtypes that are never EOD reports.
const IGNORED_SUBTYPES = new Set([
  "channel_join",
  "channel_leave",
  "channel_topic",
  "channel_purpose",
  "channel_name",
  "channel_archive",
  "channel_unarchive",
  "group_join",
  "group_leave",
  "pinned_item",
  "message_deleted",
  "bot_message",
]);

export type IncomingMessage = {
  ts: string;
  text: string;
  channel: string;
  user?: string | null;
  user_name?: string | null;
  subtype?: string | null;
  thread_ts?: string | null;
};

/** Why a message should be skipped before classification, or null to keep it. */
export function skipReason(m: IncomingMessage): string | null {
  if (m.subtype && IGNORED_SUBTYPES.has(m.subtype)) return `subtype:${m.subtype}`;
  if (m.thread_ts && m.thread_ts !== m.ts) return "thread_reply";
  if (m.text.trim().length < 40) return "too_short";
  return null;
}

/** Converts Slack mrkdwn-ish text to plain text good enough for the classifier. */
export function cleanSlackText(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<mailto:[^|>]+\|([^>]+)>/g, "$1")
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, "$2 ($1)")
    .replace(/<(https?:[^>]+)>/g, "$1")
    .trim();
}

export function slackTsToIso(ts: string): string {
  return new Date(Math.floor(Number(ts) * 1000)).toISOString();
}

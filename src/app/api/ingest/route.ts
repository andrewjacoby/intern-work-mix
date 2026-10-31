import { tasks } from "@trigger.dev/sdk";
import { timingSafeEqual } from "node:crypto";
import type { ingestEodMessage } from "@/trigger/ingestMessage";
import { skipReason, type IncomingMessage } from "@/lib/slackText";

export const dynamic = "force-dynamic";

/**
 * Webhook for the n8n workflow. Send each new #active-client-internship message:
 *
 *   POST /api/ingest
 *   Header: x-ingest-secret: <INGEST_SECRET>
 *   Body:   { "ts": "1793449927.123456", "text": "...", "user": "U123", "user_name": "Jane Doe",
 *             "channel": "C08E42PACSE", "subtype": null, "thread_ts": null }
 *
 * Also accepts an array of messages, or { "messages": [...] }, for backfills.
 */
export async function POST(req: Request) {
  const secret = process.env.INGEST_SECRET;
  if (!secret) return Response.json({ error: "INGEST_SECRET is not configured" }, { status: 500 });
  const supplied = req.headers.get("x-ingest-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!safeEqual(supplied, secret)) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const list = Array.isArray(body) ? body : (body as { messages?: unknown[] })?.messages ?? [body];
  const defaultChannel = process.env.SLACK_CHANNEL_ID || "C08E42PACSE";
  const accepted: IncomingMessage[] = [];
  const skipped: { ts?: string; reason: string }[] = [];

  for (const raw of list as Record<string, unknown>[]) {
    const ts = str(raw?.ts) ?? str(raw?.event_ts);
    const text = str(raw?.text);
    if (!ts || !/^\d+(\.\d+)?$/.test(ts) || !text) {
      skipped.push({ ts: ts ?? undefined, reason: "missing ts or text" });
      continue;
    }
    const msg: IncomingMessage = {
      ts,
      text,
      channel: str(raw.channel) ?? str(raw.channel_id) ?? defaultChannel,
      user: str(raw.user) ?? str(raw.user_id),
      user_name: str(raw.user_name) ?? str(raw.username) ?? str(raw.real_name),
      subtype: str(raw.subtype),
      thread_ts: str(raw.thread_ts),
    };
    if (msg.channel !== defaultChannel) {
      skipped.push({ ts, reason: "other channel" });
      continue;
    }
    const reason = skipReason(msg);
    if (reason) skipped.push({ ts, reason });
    else accepted.push(msg);
  }

  if (accepted.length > 0) {
    await tasks.batchTrigger<typeof ingestEodMessage>(
      "ingest-eod-message",
      accepted.map((m) => ({
        payload: m,
        // n8n retries or duplicate events for the same message won't double-process.
        options: { idempotencyKey: `slack-${m.channel}-${m.ts}`, idempotencyKeyTTL: "1h", tags: [`ts_${m.ts}`] },
      })),
    );
  }

  return Response.json({ accepted: accepted.length, skipped }, { status: 202 });
}

function str(v: unknown): string | null {
  if (typeof v === "number") return String(v);
  return typeof v === "string" && v.length ? v : null;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

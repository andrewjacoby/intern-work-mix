import { logger, task } from "@trigger.dev/sdk";
import { classifierModel, extractReports } from "../lib/classify";
import { cleanSlackText, slackTsToIso, type IncomingMessage } from "../lib/slackText";
import { getSupabase, REPORTS_TABLE, SYNC_STATE_TABLE, type ReportRow } from "../lib/supabase";

/**
 * One Slack message → 0..n EOD report rows in Supabase.
 * Triggered by POST /api/ingest (called from the n8n workflow). Retries automatically on failure.
 * Re-sending the same message overwrites its rows, so this is safe to replay.
 */
export const ingestEodMessage = task({
  id: "ingest-eod-message",
  queue: { concurrencyLimit: 5 },
  run: async (msg: IncomingMessage) => {
    const text = cleanSlackText(msg.text);
    const postedAt = slackTsToIso(msg.ts);
    const reports = await extractReports(text, postedAt);
    const supabase = getSupabase();

    // Replace any earlier rows for this message (edits / replays / re-classification).
    const del = await supabase.from(REPORTS_TABLE).delete().eq("channel_id", msg.channel).eq("slack_ts", msg.ts);
    if (del.error) throw new Error(del.error.message);

    if (reports.length === 0) {
      logger.info("Not an EOD report; skipped", { ts: msg.ts });
      return { reports: 0 };
    }

    const now = new Date().toISOString();
    const model = classifierModel();
    const rows: ReportRow[] = reports.map((r, n) => ({
      id: `${msg.channel}:${msg.ts}:${n}`,
      channel_id: msg.channel,
      slack_ts: msg.ts,
      slack_user_id: msg.user ?? null,
      posted_at: postedAt,
      intern_name: r.intern_name ?? msg.user_name ?? null,
      client_name: r.client_name,
      report_date: r.report_date,
      hours_spent: r.hours_spent,
      hours_remaining: r.hours_remaining,
      tasks_text: r.tasks_summary,
      work_types: r.work_types,
      primary_work_type: r.primary_work_type,
      raw_text: text.slice(0, 4000),
      classifier_model: model,
      classified_at: now,
      updated_at: now,
    }));

    const { error } = await supabase.from(REPORTS_TABLE).upsert(rows, { onConflict: "id" });
    if (error) throw new Error(error.message);

    // Track the newest message seen (shown as "last synced" on the dashboard).
    const { data: state } = await supabase.from(SYNC_STATE_TABLE).select("last_ts").eq("channel_id", msg.channel).maybeSingle();
    const newer = !state?.last_ts || Number(msg.ts) > Number(state.last_ts);
    await supabase.from(SYNC_STATE_TABLE).upsert({
      channel_id: msg.channel,
      last_ts: newer ? msg.ts : state!.last_ts,
      last_run_at: now,
    });

    logger.info("Saved reports", { ts: msg.ts, count: rows.length, types: rows.map((r) => r.primary_work_type) });
    return { reports: rows.length };
  },
});

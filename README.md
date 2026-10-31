# Intern Work Mix

A dashboard of what kind of work interns do over time, built from the end-of-day (EOD) reports they post in Slack `#active-client-internship`.

```
Slack #active-client-internship
        │  existing n8n workflow (Slack trigger)
        ▼
POST /api/ingest  (Vercel, this repo; checks x-ingest-secret)
        │  queues one job per message
        ▼
Trigger.dev task "ingest-eod-message"
        │  OpenRouter LLM: extracts intern, client and hours, and tags work types (retries on failure)
        ▼
Supabase (Datavault): public.intern_eod_reports
        │
        ▼
Dashboard at /  (Vercel, password-protected)
```

There's no Slack app and no Slack token. n8n already watches the channel and forwards each message.

Reports are saved as they arrive, so the dashboard keeps the full history even after Slack's free plan hides messages older than 90 days. History starts on Aug 2, 2026; those reports were loaded once at setup.

## Work types

| Key | Label |
|---|---|
| `lead_gen` | Lead gen & prospecting |
| `outreach` | Outreach |
| `social_content` | Social content |
| `video` | Video |
| `graphic_design` | Graphic design |
| `docs_writing` | Docs & writing |
| `client_meetings` | Client meetings |
| `admin_research_other` | Admin, research & other |

A report can have several types and has one **primary** type. Definitions live in `src/lib/workTypes.ts`. The classifier prompt and the dashboard both read from that file.

## Project layout

```
src/app/api/ingest/route.ts   webhook for n8n → queues Trigger.dev jobs
src/trigger/ingestMessage.ts  Trigger.dev task: classify one message → upsert into Supabase
src/lib/classify.ts           OpenRouter call (structured JSON output)
src/lib/slackText.ts          message filtering / cleanup
src/lib/aggregate.ts          dashboard aggregations
src/app/page.tsx              dashboard
src/components/Charts.tsx     charts (Recharts)
src/proxy.ts                  password gate (HTTP Basic auth) for the dashboard
supabase/migrations/          table definitions (already applied to Datavault)
```

## Setup

### 1. Environment variables

| Variable | Used by | Where to get it |
|---|---|---|
| `SUPABASE_URL` | Vercel + Trigger.dev | `https://wffjyvomffxqyharktfc.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + Trigger.dev | Supabase → Datavault → Project Settings → API Keys → `service_role` |
| `OPENROUTER_API_KEY` | Trigger.dev | <https://openrouter.ai/keys> |
| `OPENROUTER_MODEL` | Trigger.dev | Optional; default `openai/gpt-4o-mini`, about $0.0003 per report |
| `SLACK_CHANNEL_ID` | Vercel | `C08E42PACSE` |
| `INGEST_SECRET` | Vercel + n8n | Any long random string |
| `TRIGGER_SECRET_KEY` | Vercel | Trigger.dev → API Keys → **Production** secret key (`tr_prod_…`) |
| `TRIGGER_PROJECT_REF` | deploy | Trigger.dev → Project Settings (`proj_…`) |
| `DASHBOARD_PASSWORD` | Vercel | Any password. Leave it blank to make the dashboard public. |

### 2. Trigger.dev

```bash
npm install
npx trigger.dev@4.8.3 login
TRIGGER_PROJECT_REF=proj_xxx npm run trigger:deploy
```

In the Trigger.dev dashboard, go to **Environment Variables → Production** and add:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`

Optional: under **Settings → Git**, connect this repo so every push to `main` deploys automatically.

### 3. Vercel

1. **Add New → Project** and import this repo. Next.js is detected automatically.
2. Add these environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SLACK_CHANNEL_ID`
   - `INGEST_SECRET`
   - `TRIGGER_SECRET_KEY`
   - `DASHBOARD_PASSWORD`
3. Click **Deploy**.

### 4. n8n

In the workflow that already triggers on new messages in `#active-client-internship`, add an **HTTP Request** node after the Slack trigger:

- **Method:** POST
- **URL:** `https://<your-vercel-domain>/api/ingest`
- **Headers:** `x-ingest-secret` = the `INGEST_SECRET` value
- **Body (JSON):**

```json
{
  "ts": "{{ $json.ts }}",
  "text": {{ JSON.stringify($json.text) }},
  "user": "{{ $json.user }}",
  "channel": "{{ $json.channel }}",
  "subtype": "{{ $json.subtype ?? '' }}",
  "thread_ts": "{{ $json.thread_ts ?? '' }}"
}
```

Field names depend on the Slack trigger node. Map them to whatever the trigger outputs; `ts` and `text` are the only required fields. Thread replies, join/leave events and short chatter are skipped automatically. Sending the same message twice is safe: duplicates within an hour are ignored, and a replay overwrites the earlier rows.

To test it:

```bash
curl -X POST https://<domain>/api/ingest \
  -H "x-ingest-secret: $INGEST_SECRET" -H "content-type: application/json" \
  -d '{"ts":"1793449999.000100","channel":"C08E42PACSE","text":"Name: Test Intern\nClient: Test Client\nDate: Oct 31, 2026\nHours Spent: 2 hours\nTasks: Built a lead list of 40 decision-makers and sent LinkedIn connection requests"}'
```

That should return `{"accepted":1,...}`, and a run of `ingest-eod-message` appears in Trigger.dev. Delete the test row afterwards:

```sql
delete from intern_eod_reports where client_name = 'Test Client';
```

## Local development

```bash
cp .env.example .env.local
npm run dev           # dashboard at http://localhost:3000
npm run trigger:dev   # runs the task locally against your Trigger.dev dev environment
```

`GET /api/health` returns `{ "ok": true }`. It skips the dashboard password, so it can be used for uptime checks.

-- Already applied to the Datavault project. Kept here for reference / new environments.
create table if not exists public.intern_eod_reports (
  id text primary key,                      -- "<channel_id>:<slack_ts>:<n>"
  channel_id text not null,
  slack_ts text not null,
  slack_user_id text,
  posted_at timestamptz not null,
  intern_name text,
  client_name text,
  report_date date,
  hours_spent numeric(6,2),
  hours_remaining numeric(7,2),
  tasks_text text,
  work_types text[] not null default '{}',
  primary_work_type text,
  raw_text text not null,
  classifier_model text,
  classified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists intern_eod_reports_posted_at_idx on public.intern_eod_reports (posted_at);
create index if not exists intern_eod_reports_client_idx on public.intern_eod_reports (client_name);
create index if not exists intern_eod_reports_intern_idx on public.intern_eod_reports (intern_name);
create index if not exists intern_eod_reports_work_types_idx on public.intern_eod_reports using gin (work_types);

create table if not exists public.intern_eod_sync_state (
  channel_id text primary key,
  last_ts text,
  last_run_at timestamptz,
  messages_seen integer not null default 0
);

alter table public.intern_eod_reports enable row level security;
alter table public.intern_eod_sync_state enable row level security;

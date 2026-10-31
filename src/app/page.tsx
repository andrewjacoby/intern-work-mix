import { byEntity, byPeriod, shifts, uniqueCount, type DashRow, type Granularity } from "@/lib/aggregate";
import { getSupabase, REPORTS_TABLE, SYNC_STATE_TABLE } from "@/lib/supabase";
import { WORK_TYPES, WORK_TYPE_DEFINITIONS, WORK_TYPE_LABELS, type WorkType } from "@/lib/workTypes";
import { MixChart, TrendSmallMultiples, Swatch } from "@/components/Charts";

export const dynamic = "force-dynamic";

const RANGES = { "90": 90, "180": 180, "365": 365, all: null } as const;
type RangeKey = keyof typeof RANGES;

async function loadRows(sinceIso: string | null): Promise<DashRow[]> {
  const supabase = getSupabase();
  const rows: DashRow[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase
      .from(REPORTS_TABLE)
      .select("posted_at, intern_name, client_name, hours_spent, work_types, primary_work_type")
      .order("posted_at", { ascending: true })
      .range(from, from + 999);
    if (sinceIso) q = q.gte("posted_at", sinceIso);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    rows.push(...(data as DashRow[]).map((r) => ({ ...r, hours_spent: r.hours_spent == null ? null : Number(r.hours_spent) })));
    if (data.length < 1000) break;
  }
  return rows;
}

const MIN_REPORTS_FOR_TREND = 10;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const num = (n: number) => Math.round(n).toLocaleString("en-US");

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const range: RangeKey = sp.range && sp.range in RANGES ? (sp.range as RangeKey) : "all";
  const gran: Granularity = sp.g === "month" ? "month" : "week";
  const days = RANGES[range];
  const since = days ? new Date(Date.now() - days * 86400_000).toISOString() : null;

  const rows = await loadRows(since);
  const { data: sync } = await getSupabase().from(SYNC_STATE_TABLE).select("last_run_at").limit(1).maybeSingle();

  const periods = byPeriod(rows, gran);
  const clients = byEntity(rows, "client_name", 25);
  const interns = byEntity(rows, "intern_name", 25);
  const moves = shifts(rows).slice(0, 4);
  const totalHours = rows.reduce((s, r) => s + (r.hours_spent ?? 0), 0);

  const mixData = periods.map((p) => ({
    label: p.label,
    reports: p.reports,
    ...Object.fromEntries(WORK_TYPES.map((t) => [t, p.primary[t]])),
  }));
  const trendData = periods.map((p) => ({
    label: p.label,
    reports: p.reports,
    // Periods with very few reports (e.g. a partial first week) make noisy spikes; leave a gap instead.
    ...Object.fromEntries(WORK_TYPES.map((t) => [t, p.reports >= MIN_REPORTS_FOR_TREND ? p.tagged[t] / p.reports : null])),
  }));

  const link = (r: RangeKey, g: Granularity) => `/?range=${r}&g=${g}`;

  return (
    <main>
      <header className="top">
        <div>
          <h1>Intern work mix</h1>
          <p className="muted">
            EOD reports from #active-client-internship, classified by work type.
            {sync?.last_run_at && <> Last synced {new Date(sync.last_run_at).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" })} ET.</>}
          </p>
        </div>
        <nav className="filters" aria-label="Filters">
          <div className="seg" role="group" aria-label="Time range">
            {(Object.keys(RANGES) as RangeKey[]).map((r) => (
              <a key={r} href={link(r, gran)} aria-current={r === range ? "true" : undefined}>
                {r === "all" ? "All" : `${r}d`}
              </a>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Group by">
            {(["week", "month"] as Granularity[]).map((g) => (
              <a key={g} href={link(range, g)} aria-current={g === gran ? "true" : undefined}>
                {g === "week" ? "Weekly" : "Monthly"}
              </a>
            ))}
          </div>
        </nav>
      </header>

      {rows.length === 0 ? (
        <section className="card empty">
          <h2>No reports yet</h2>
          <p className="muted">Reports appear here as the n8n workflow sends new channel messages to /api/ingest.</p>
        </section>
      ) : (
        <>
          <section className="kpis">
            <div className="kpi"><span className="muted">Reports</span><strong>{num(rows.length)}</strong></div>
            <div className="kpi"><span className="muted">Hours logged</span><strong>{num(totalHours)}</strong></div>
            <div className="kpi"><span className="muted">Interns</span><strong>{num(uniqueCount(rows, "intern_name"))}</strong></div>
            <div className="kpi"><span className="muted">Clients</span><strong>{num(uniqueCount(rows, "client_name"))}</strong></div>
          </section>

          {moves.length > 0 && (
            <section className="card">
              <h2>Biggest shifts</h2>
              <p className="muted small">Share of reports tagged with each type, first half of this range vs. second half.</p>
              <ul className="shifts">
                {moves.map((m) => (
                  <li key={m.type}>
                    <Swatch type={m.type} />
                    <span>{WORK_TYPE_LABELS[m.type]}</span>
                    <span className="muted">{pct(m.before)} → {pct(m.after)}</span>
                    <strong>{m.delta >= 0 ? "▲" : "▼"} {Math.abs(Math.round(m.delta * 100))} pts</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card">
            <h2>Work mix over time</h2>
            <p className="muted small">Reports per {gran}, colored by each report&apos;s main work type.</p>
            <MixChart data={mixData} />
          </section>

          <section className="card">
            <h2>Trend by work type</h2>
            <p className="muted small">% of reports per {gran} that include each type. A report can include several types.</p>
            <TrendSmallMultiples data={trendData} />
          </section>

          <section className="card">
            <h2>Table view</h2>
            <p className="muted small">% of reports tagged with each type, per {gran}.</p>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>{gran === "week" ? "Week of" : "Month"}</th>
                    <th className="r">Reports</th>
                    <th className="r">Hours</th>
                    {WORK_TYPES.map((t) => <th key={t} className="r">{WORK_TYPE_LABELS[t]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[...periods].reverse().map((p) => (
                    <tr key={p.key}>
                      <td>{p.label}</td>
                      <td className="r">{p.reports}</td>
                      <td className="r">{num(p.hours)}</td>
                      {WORK_TYPES.map((t) => <td key={t} className="r">{pct(p.tagged[t] / p.reports)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="two">
            <EntityTable title="By client" peopleLabel="Interns" rows={clients} />
            <EntityTable title="By intern" peopleLabel="Clients" rows={interns} />
          </div>

          <details className="card defs">
            <summary>How work types are defined</summary>
            <dl>
              {WORK_TYPES.map((t) => (
                <div key={t}>
                  <dt><Swatch type={t} /> {WORK_TYPE_LABELS[t]}</dt>
                  <dd className="muted">{WORK_TYPE_DEFINITIONS[t]}</dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      )}
    </main>
  );
}

function EntityTable({
  title,
  peopleLabel,
  rows,
}: {
  title: string;
  peopleLabel: string;
  rows: { name: string; reports: number; hours: number; people: number; topTypes: { type: WorkType; share: number }[] }[];
}) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <p className="muted small">Top 25 by reports in this range.</p>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th className="r">Reports</th>
              <th className="r">Hours</th>
              <th className="r">{peopleLabel}</th>
              <th>Main work types</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td className="r">{r.reports}</td>
                <td className="r">{num(r.hours)}</td>
                <td className="r">{r.people}</td>
                <td>
                  <span className="chips">
                    {r.topTypes.map((t) => (
                      <span key={t.type} className="chip">
                        <Swatch type={t.type} /> {WORK_TYPE_LABELS[t.type]} {pct(t.share)}
                      </span>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

import { WORK_TYPES, isWorkType, type WorkType } from "./workTypes";

export type DashRow = {
  posted_at: string;
  intern_name: string | null;
  client_name: string | null;
  hours_spent: number | null;
  work_types: string[];
  primary_work_type: string | null;
};

export type Granularity = "week" | "month";

export type PeriodStat = {
  key: string; // YYYY-MM-DD (week start, Monday) or YYYY-MM
  label: string;
  reports: number;
  hours: number;
  interns: number;
  /** reports whose primary work type is t */
  primary: Record<WorkType, number>;
  /** reports tagged with t (multi-tag) */
  tagged: Record<WorkType, number>;
  /** hours split evenly across a report's tags */
  hoursByType: Record<WorkType, number>;
};

export type EntityStat = {
  name: string;
  reports: number;
  hours: number;
  people: number; // interns per client, or clients per intern
  lastSeen: string;
  topTypes: { type: WorkType; share: number }[];
};

export type Shift = { type: WorkType; before: number; after: number; delta: number };

const zero = (): Record<WorkType, number> =>
  Object.fromEntries(WORK_TYPES.map((t) => [t, 0])) as Record<WorkType, number>;

const etDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar date (YYYY-MM-DD) in Eastern Time. */
export function etDay(iso: string): string {
  return etDate.format(new Date(iso));
}

function periodKey(iso: string, g: Granularity): string {
  const day = etDay(iso);
  if (g === "month") return day.slice(0, 7);
  const d = new Date(`${day}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

function periodLabel(key: string, g: Granularity): string {
  if (g === "month") {
    const [y, m] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 15)).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  const d = new Date(`${key}T12:00:00Z`);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function typesOf(r: DashRow): WorkType[] {
  const t = r.work_types.filter(isWorkType);
  return t.length ? t : ["admin_research_other"];
}

function primaryOf(r: DashRow): WorkType {
  return isWorkType(r.primary_work_type) ? r.primary_work_type : typesOf(r)[0];
}

/** Lowercase/whitespace-insensitive key so "kristi Gorinas" and "Kristi Gorinas" merge. */
const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function byPeriod(rows: DashRow[], g: Granularity): PeriodStat[] {
  const map = new Map<string, PeriodStat & { _interns: Set<string> }>();
  for (const r of rows) {
    const key = periodKey(r.posted_at, g);
    let p = map.get(key);
    if (!p) {
      p = {
        key,
        label: periodLabel(key, g),
        reports: 0,
        hours: 0,
        interns: 0,
        primary: zero(),
        tagged: zero(),
        hoursByType: zero(),
        _interns: new Set(),
      };
      map.set(key, p);
    }
    const types = typesOf(r);
    const h = r.hours_spent ?? 0;
    p.reports++;
    p.hours += h;
    p.primary[primaryOf(r)]++;
    for (const t of types) {
      p.tagged[t]++;
      p.hoursByType[t] += h / types.length;
    }
    if (r.intern_name) p._interns.add(normKey(r.intern_name));
  }
  return [...map.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ _interns, ...p }) => ({ ...p, interns: _interns.size }));
}

export function byEntity(rows: DashRow[], field: "client_name" | "intern_name", limit = 25): EntityStat[] {
  const other = field === "client_name" ? "intern_name" : "client_name";
  const map = new Map<
    string,
    { names: Map<string, number>; reports: number; hours: number; people: Set<string>; last: string; tagged: Record<WorkType, number> }
  >();
  for (const r of rows) {
    const raw = r[field];
    if (!raw) continue;
    const k = normKey(raw);
    let e = map.get(k);
    if (!e) {
      e = { names: new Map(), reports: 0, hours: 0, people: new Set(), last: r.posted_at, tagged: zero() };
      map.set(k, e);
    }
    e.names.set(raw, (e.names.get(raw) ?? 0) + 1);
    e.reports++;
    e.hours += r.hours_spent ?? 0;
    const o = r[other];
    if (o) e.people.add(normKey(o));
    if (r.posted_at > e.last) e.last = r.posted_at;
    for (const t of typesOf(r)) e.tagged[t]++;
  }
  return [...map.values()]
    .sort((a, b) => b.reports - a.reports)
    .slice(0, limit)
    .map((e) => ({
      name: [...e.names.entries()].sort((a, b) => b[1] - a[1])[0][0],
      reports: e.reports,
      hours: e.hours,
      people: e.people.size,
      lastSeen: e.last,
      topTypes: WORK_TYPES.map((t) => ({ type: t, share: e.tagged[t] / e.reports }))
        .filter((x) => x.share > 0)
        .sort((a, b) => b.share - a.share)
        .slice(0, 3),
    }));
}

/** % of reports tagged with each type: first half of the range vs second half. */
export function shifts(rows: DashRow[]): Shift[] {
  if (rows.length < 20) return [];
  const sorted = [...rows].sort((a, b) => a.posted_at.localeCompare(b.posted_at));
  const mid = Math.floor(sorted.length / 2);
  const share = (rs: DashRow[]) => {
    const c = zero();
    rs.forEach((r) => typesOf(r).forEach((t) => c[t]++));
    return Object.fromEntries(WORK_TYPES.map((t) => [t, c[t] / rs.length])) as Record<WorkType, number>;
  };
  const a = share(sorted.slice(0, mid));
  const b = share(sorted.slice(mid));
  return WORK_TYPES.map((t) => ({ type: t, before: a[t], after: b[t], delta: b[t] - a[t] })).sort(
    (x, y) => Math.abs(y.delta) - Math.abs(x.delta),
  );
}

export function uniqueCount(rows: DashRow[], field: "client_name" | "intern_name"): number {
  return new Set(rows.map((r) => r[field]).filter(Boolean).map((s) => normKey(s as string))).size;
}

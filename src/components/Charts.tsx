"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { WORK_TYPES, WORK_TYPE_LABELS, type WorkType } from "@/lib/workTypes";

// Colors come from CSS custom properties (light/dark steps defined in globals.css).
const color = (t: WorkType) => `var(--series-${WORK_TYPES.indexOf(t) + 1})`;

export function Swatch({ type }: { type: WorkType }) {
  return <span className="swatch" style={{ background: color(type) }} aria-hidden="true" />;
}

type Row = { label: string; reports: number } & Record<string, number | string | null>;

const axisTick = { fill: "var(--text-secondary)", fontSize: 12 };

function MixTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Row;
  const items = [...payload].filter((p) => Number(p.value) > 0).reverse();
  return (
    <div className="tip">
      <div className="tip-h">{label} · {row.reports} reports</div>
      {items.map((p) => (
        <div key={String(p.dataKey)} className="tip-row">
          <Swatch type={p.dataKey as WorkType} />
          <span>{WORK_TYPE_LABELS[p.dataKey as WorkType]}</span>
          <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function MixChart({ data }: { data: Row[] }) {
  return (
    <>
      <Legend />
      <div style={{ width: "100%", height: 340 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--axis)" }} minTickGap={16} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={(p) => <MixTooltip {...(p as TooltipContentProps<number, string>)} />} cursor={{ fill: "var(--hover)" }} />
            {WORK_TYPES.map((t, i) => (
              <Bar
                key={t}
                dataKey={t}
                stackId="mix"
                fill={color(t)}
                stroke="var(--surface-1)"
                strokeWidth={2}
                radius={i === WORK_TYPES.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function Legend() {
  return (
    <ul className="legend">
      {WORK_TYPES.map((t) => (
        <li key={t}>
          <Swatch type={t} /> {WORK_TYPE_LABELS[t]}
        </li>
      ))}
    </ul>
  );
}

function TrendTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length || payload[0].value == null) return null;
  const row = payload[0].payload as Row;
  return (
    <div className="tip">
      <div className="tip-h">{label}</div>
      <div className="tip-row">
        <strong>{Math.round(Number(payload[0].value) * 100)}%</strong>
        <span className="muted">of {row.reports} reports</span>
      </div>
    </div>
  );
}

export function TrendSmallMultiples({ data }: { data: Row[] }) {
  const lastValue = (t: WorkType) => {
    for (let i = data.length - 1; i >= 0; i--) if (data[i][t] != null) return Number(data[i][t]);
    return null;
  };
  return (
    <div className="multiples">
      {WORK_TYPES.map((t) => (
        <figure key={t} className="multiple">
          <figcaption>
            <span><Swatch type={t} /> {WORK_TYPE_LABELS[t]}</span>
            {lastValue(t) != null && <strong>{Math.round(lastValue(t)! * 100)}%</strong>}
          </figcaption>
          <div style={{ width: "100%", height: 120 }}>
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -24 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="label" hide />
                <YAxis
                  domain={[0, 1]}
                  ticks={[0, 0.5, 1]}
                  tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                  tick={{ ...axisTick, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={(p) => <TrendTooltip {...(p as TooltipContentProps<number, string>)} />} cursor={{ stroke: "var(--axis)" }} />
                <Line
                  type="monotone"
                  dataKey={t}
                  stroke={color(t)}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  activeDot={{ r: 4, stroke: "var(--surface-1)", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </figure>
      ))}
    </div>
  );
}

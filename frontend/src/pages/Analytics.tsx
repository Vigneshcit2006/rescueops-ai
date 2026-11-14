import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMission } from "../context/MissionContext";
import { useMissionState } from "../hooks/useMissionState";
import { ErrorBanner, LoadingBlock, EmptyState } from "../components/Feedback";
import { KpiCard } from "../components/Kpi";
import { api } from "../lib/api";

const COLOR_ACCENT = "#3b82f6";
const COLOR_OK = "#22c55e";
const COLOR_CRITICAL = "#ef4444";
const COLOR_INFO = "#38bdf8";
const COLOR_PURPLE = "#a855f7";
const GRID = "#1b2430";
const AXIS = "#5b6b7f";

function chartTooltipStyle() {
  return {
    background: "#0e131b",
    border: "1px solid #26313f",
    borderRadius: 6,
    fontSize: 12,
    color: "#e2e8f0",
  };
}

export function Analytics() {
  const { missionId } = useMission();
  const { state, loading, error } = useMissionState(missionId, 3000, true);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!missionId) return;
    let cancelled = false;
    api
      .getAnalytics(missionId)
      .then((data) => {
        if (!cancelled) setAnalytics(data);
      })
      .catch(() => {
        // Analytics endpoint may not be ready yet; charts fall back to mission state metrics.
      });
    return () => {
      cancelled = true;
    };
  }, [missionId, state?.metrics.victims_evacuated]);

  const evacuationSeries = useMemo(() => {
    if (!state) return [];
    const events = [...state.trace]
      .filter((e) => e.kind === "SUCCESS" || /evacuat/i.test(e.event))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    let cumulative = 0;
    const points = events.map((e) => {
      cumulative += 1;
      return {
        time: new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        evacuated: Math.min(cumulative, state.metrics.victims_evacuated || cumulative),
      };
    });
    if (points.length === 0) {
      return [{ time: "now", evacuated: state.metrics.victims_evacuated }];
    }
    return points;
  }, [state]);

  const resourceUtilization = useMemo(() => {
    if (!state) return [];
    const byType = new Map<string, { type: string; total: number; utilized: number }>();
    state.vehicles.forEach((v) => {
      const entry = byType.get(v.type) ?? { type: v.type, total: 0, utilized: 0 };
      entry.total += 1;
      if (v.status === "ASSIGNED" || v.status === "EN_ROUTE") entry.utilized += 1;
      byType.set(v.type, entry);
    });
    return Array.from(byType.values()).map((e) => ({
      type: e.type.replace(/_/g, " "),
      Utilized: e.utilized,
      Available: e.total - e.utilized,
    }));
  }, [state]);

  const actionOutcome = useMemo(() => {
    if (!state) return [];
    return [
      { name: "Successful", value: state.metrics.successful_actions, fill: COLOR_OK },
      { name: "Failed", value: state.metrics.failed_actions, fill: COLOR_CRITICAL },
    ];
  }, [state]);

  if (!missionId) return <EmptyState title="No active mission" hint="Launch a mission from the landing page" />;
  if (loading && !state) return <LoadingBlock label="Loading analytics..." />;
  if (error && !state) return <ErrorBanner message={error} />;
  if (!state) return null;

  const { metrics } = state;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-slate-100">Analytics</h1>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Victims Evacuated" value={metrics.victims_evacuated} />
        <KpiCard label="Critical Evacuated" value={`${metrics.critical_evacuated}/${metrics.critical_total}`} />
        <KpiCard label="Replans" value={metrics.replans} tone={metrics.replans > 0 ? "risk" : "default"} />
        <KpiCard
          label="Failed Actions"
          value={metrics.failed_actions}
          tone={metrics.failed_actions > 0 ? "critical" : "ok"}
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="panel p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-1">Victims evacuated over time</h2>
          <p className="text-xs text-slate-500 mb-3">Derived from SUCCESS / evacuation trace events</p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={evacuationSeries}>
              <defs>
                <linearGradient id="evacGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR_ACCENT} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={COLOR_ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="time" stroke={AXIS} tick={{ fontSize: 11 }} />
              <YAxis stroke={AXIS} tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle()} />
              <Area
                type="monotone"
                dataKey="evacuated"
                stroke={COLOR_ACCENT}
                strokeWidth={2}
                fill="url(#evacGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="panel p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-1">Resource utilization</h2>
          <p className="text-xs text-slate-500 mb-3">Vehicles assigned/en route vs. available, by type</p>
          {resourceUtilization.length === 0 ? (
            <EmptyState title="No vehicles in this mission" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={resourceUtilization}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="type" stroke={AXIS} tick={{ fontSize: 11 }} />
                <YAxis stroke={AXIS} tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={chartTooltipStyle()} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Utilized" stackId="a" fill={COLOR_INFO} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Available" stackId="a" fill={COLOR_PURPLE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="panel p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-1">Successful vs failed actions</h2>
          <p className="text-xs text-slate-500 mb-3">Cumulative mission metrics</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={actionOutcome} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" stroke={AXIS} tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" stroke={AXIS} tick={{ fontSize: 12 }} width={80} />
              <Tooltip contentStyle={chartTooltipStyle()} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {actionOutcome.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel p-4 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-300">Replanning activity</h2>
          <p className="text-xs text-slate-500">
            The agent has triggered <span className="text-slate-200 font-semibold">{metrics.replans}</span>{" "}
            replan cycle{metrics.replans === 1 ? "" : "s"} this mission, in response to environment changes
            (road blocks, vehicle failures, capacity changes).
          </p>
          <div className="flex-1 flex items-center justify-center">
            <span className="text-5xl font-extrabold tabular-nums text-status-risk">{metrics.replans}</span>
          </div>
        </div>
      </div>

      {analytics && (
        <div className="panel p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-2">Raw analytics response</h2>
          <pre className="text-xs text-slate-500 overflow-x-auto bg-base-900 rounded p-3 border border-base-700">
            {JSON.stringify(analytics, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

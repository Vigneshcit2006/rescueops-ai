import { useEffect, useState } from "react";
import { API_BASE, api } from "../lib/api";
import { useMission } from "../context/MissionContext";
import { Badge } from "../components/StatusBadge";

interface HealthInfo {
  ok: boolean;
  llm_provider?: string;
  [key: string]: unknown;
}

export function Settings() {
  const { missionId } = useMission();
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getHealth()
      .then((data) => {
        if (!cancelled) setHealth(data);
      })
      .catch((err) => {
        if (!cancelled) setHealthError(err instanceof Error ? err.message : "Health check failed");
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-lg font-semibold text-slate-100">Settings</h1>

      <div className="panel p-5 flex flex-col gap-4">
        <div>
          <span className="kpi-label">API base URL</span>
          <p className="text-sm text-slate-300 font-mono mt-1">{API_BASE}</p>
          <p className="text-xs text-slate-500 mt-1">
            Configured via the <span className="font-mono">VITE_API_BASE</span> environment variable at
            build time. See <span className="font-mono">.env.example</span>.
          </p>
        </div>

        <div>
          <span className="kpi-label">Backend health</span>
          {!checked ? (
            <p className="text-sm text-slate-500 mt-1">Checking...</p>
          ) : health ? (
            <div className="mt-1 flex items-center gap-2">
              <Badge tone={health.ok ? "ok" : "critical"}>{health.ok ? "Reachable" : "Unhealthy"}</Badge>
              {health.llm_provider && (
                <span className="text-sm text-slate-300">
                  LLM provider: <span className="font-mono text-accent">{health.llm_provider}</span>
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-status-risk mt-1">
              Could not reach /health ({healthError}). This endpoint is not part of the documented v1
              contract, so its absence is expected on some backend builds.
            </p>
          )}
        </div>

        <div>
          <span className="kpi-label">Active mission</span>
          <p className="text-sm text-slate-300 font-mono mt-1">{missionId ?? "none"}</p>
        </div>
      </div>

      <div className="panel p-5 flex flex-col gap-2">
        <span className="kpi-label">Build info</span>
        <p className="text-sm text-slate-400">RescueOps AI frontend — React + TypeScript + Vite.</p>
        <p className="text-xs text-slate-500">
          Polling interval: 2s on live pages (dashboard, map, agent). Map tiles served from
          OpenStreetMap. Evidence graph rendered with ReactFlow.
        </p>
      </div>
    </div>
  );
}

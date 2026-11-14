import { useState } from "react";
import { useMission } from "../context/MissionContext";
import { useMissionState } from "../hooks/useMissionState";
import { ErrorBanner, LoadingBlock, EmptyState } from "../components/Feedback";
import { SimulationControls } from "../components/SimulationControls";
import { AgentStateBadge, MissionStatusBadge } from "../components/StatusBadge";

interface LogEntry {
  id: number;
  message: string;
  ok: boolean;
  timestamp: string;
}

export function Simulation() {
  const { missionId } = useMission();
  const { state, loading, error, refresh } = useMissionState(missionId, 2000, true);
  const [log, setLog] = useState<LogEntry[]>([]);

  function pushLog(message: string, ok: boolean) {
    setLog((prev) => [{ id: Date.now() + Math.random(), message, ok, timestamp: new Date().toISOString() }, ...prev].slice(0, 50));
  }

  if (!missionId) return <EmptyState title="No active mission" hint="Launch a mission from the landing page" />;
  if (loading && !state) return <LoadingBlock label="Loading simulation..." />;
  if (error && !state) return <ErrorBanner message={error} />;
  if (!state) return null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 flex-wrap">
        <h1 className="text-lg font-semibold text-slate-100">Simulation Control</h1>
        <MissionStatusBadge status={state.mission.status} />
        <AgentStateBadge state={state.mission.agent_state} />
      </header>

      <div className="panel p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Actions</h2>
        <SimulationControls missionId={missionId} onChanged={refresh} onLog={pushLog} />
      </div>

      <div className="panel p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Event log</h2>
        {log.length === 0 ? (
          <EmptyState title="No actions triggered yet" hint="Use the controls above to inject events" />
        ) : (
          <div className="flex flex-col gap-1.5 max-h-[420px] overflow-y-auto">
            {log.map((entry) => (
              <div
                key={entry.id}
                className={`text-sm px-3 py-2 rounded-md border flex items-center justify-between gap-2 ${
                  entry.ok
                    ? "border-status-ok/30 bg-status-ok/5 text-slate-300"
                    : "border-status-critical/30 bg-status-critical/5 text-slate-300"
                }`}
              >
                <span>{entry.message}</span>
                <span className="text-[10px] text-slate-500 shrink-0">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

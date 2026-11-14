import { useMission } from "../context/MissionContext";
import { useMissionState } from "../hooks/useMissionState";
import { AGENT_STATES } from "../types";
import { AgentStateBadge } from "../components/StatusBadge";
import { ErrorBanner, LoadingBlock, EmptyState } from "../components/Feedback";

const kindTone: Record<string, string> = {
  INFO: "border-status-info/30 bg-status-info/5",
  WARNING: "border-status-risk/30 bg-status-risk/5",
  DECISION: "border-accent/30 bg-accent/5",
  FAILURE: "border-status-critical/30 bg-status-critical/5",
  SUCCESS: "border-status-ok/30 bg-status-ok/5",
};

export function AgentPage() {
  const { missionId } = useMission();
  const { state, loading, error } = useMissionState(missionId, 2000, true);

  if (!missionId) return <EmptyState title="No active mission" hint="Launch a mission from the landing page" />;
  if (loading && !state) return <LoadingBlock label="Loading agent state..." />;
  if (error && !state) return <ErrorBanner message={error} />;
  if (!state) return null;

  const current = state.mission.agent_state;
  const trace = [...state.trace].reverse();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-slate-100">Agent Activity</h1>
        <AgentStateBadge state={current} />
      </header>

      <div className="panel p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">State machine</h2>
        <div className="flex flex-wrap gap-2">
          {AGENT_STATES.map((s) => (
            <div
              key={s}
              className={`px-3 py-2 rounded-md border text-xs font-semibold tracking-wide transition-colors ${
                s === current
                  ? "border-accent bg-accent/15 text-accent shadow-[0_0_0_1px_rgba(59,130,246,0.4)]"
                  : "border-base-700 bg-base-800 text-slate-500"
              }`}
            >
              {s.replace(/_/g, " ")}
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">
          Trace log <span className="text-slate-600 font-normal">({trace.length} events)</span>
        </h2>
        {trace.length === 0 ? (
          <EmptyState title="No trace events yet" />
        ) : (
          <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1">
            {trace.map((event) => (
              <div
                key={event.id}
                className={`rounded-md border px-3 py-2 ${kindTone[event.kind] ?? "border-base-700 bg-base-800"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-200 font-medium">{event.event}</span>
                  <span className="text-[10px] text-slate-500 shrink-0">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {event.detail && <p className="text-xs text-slate-500 mt-0.5">{event.detail}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

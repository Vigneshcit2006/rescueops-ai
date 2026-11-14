import { useParams } from "react-router-dom";
import { useMissionState } from "../hooks/useMissionState";
import { MissionStatusBadge, AgentStateBadge } from "../components/StatusBadge";
import { ErrorBanner, LoadingBlock } from "../components/Feedback";
import { KpiCard } from "../components/Kpi";

export function MissionDetail() {
  const { id } = useParams<{ id: string }>();
  const { state, loading, error } = useMissionState(id, 2000, true);

  if (loading && !state) return <LoadingBlock label="Loading mission..." />;
  if (error && !state) return <ErrorBanner message={error} />;
  if (!state) return null;

  const { mission, goal, metrics } = state;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <header className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-slate-50">{mission.name}</h1>
        <MissionStatusBadge status={mission.status} />
        <AgentStateBadge state={mission.agent_state} />
      </header>

      <div className="panel p-5 flex flex-col gap-4">
        <div>
          <span className="kpi-label">Objective</span>
          <p className="text-slate-200 mt-1">{goal.objective}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="kpi-label">Deadline</span>
            <p className="text-slate-300 mt-1">{goal.deadline_minutes} minutes</p>
          </div>
          <div>
            <span className="kpi-label">Priority</span>
            <p className="text-slate-300 mt-1">{goal.priority}</p>
          </div>
        </div>

        <div>
          <span className="kpi-label">Constraints</span>
          <ul className="mt-2 flex flex-col gap-1.5">
            {goal.constraints.map((c, i) => (
              <li key={i} className="text-sm text-slate-400 flex gap-2">
                <span className="text-slate-600">&bull;</span>
                {c}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <span className="kpi-label">Success conditions</span>
          <ul className="mt-2 flex flex-col gap-1.5">
            {goal.success_conditions.map((c, i) => (
              <li key={i} className="text-sm text-slate-400 flex gap-2">
                <span className="text-status-ok">&#10003;</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard label="Progress" value={`${Math.round(mission.progress_pct)}%`} />
        <KpiCard label="Elapsed" value={`${mission.elapsed_min}min`} />
        <KpiCard label="ETA" value={`${mission.estimated_completion_min}min`} />
        <KpiCard label="Victims Evacuated" value={metrics.victims_evacuated} />
        <KpiCard label="Replans" value={metrics.replans} />
        <KpiCard label="Failed Actions" value={metrics.failed_actions} tone={metrics.failed_actions > 0 ? "risk" : "ok"} />
      </section>
    </div>
  );
}

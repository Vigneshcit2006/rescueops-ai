import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMission } from "../context/MissionContext";
import { useMissionState } from "../hooks/useMissionState";
import { AgentStateBadge, MissionStatusBadge } from "../components/StatusBadge";
import { KpiCard } from "../components/Kpi";
import { MapLegend, MapView } from "../components/MapView";
import { ErrorBanner, LoadingBlock } from "../components/Feedback";
import { ApprovalBanner } from "../components/ApprovalBanner";
import { SimulationControls } from "../components/SimulationControls";
import { AgentPanel } from "../components/AgentPanel";
import { DecisionPanel } from "../components/DecisionPanel";

export function Dashboard() {
  const { missionId: routeMissionId } = useParams<{ missionId: string }>();
  const { missionId, setMissionId } = useMission();
  const navigate = useNavigate();

  useEffect(() => {
    if (routeMissionId && routeMissionId !== missionId) setMissionId(routeMissionId);
  }, [routeMissionId, missionId, setMissionId]);

  const activeId = routeMissionId ?? missionId ?? undefined;
  const { state, loading, error, refresh } = useMissionState(activeId, 2000, true);

  if (!activeId) {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <p className="text-slate-400">No mission selected.</p>
        <button className="btn-primary" onClick={() => navigate("/")}>
          Go to landing page
        </button>
      </div>
    );
  }

  if (loading && !state) return <LoadingBlock label="Connecting to mission..." />;

  if (error && !state) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorBanner message={error} />
        <p className="text-sm text-slate-500">
          Could not reach the backend at the configured VITE_API_BASE. Confirm the FastAPI server
          is running on http://localhost:8020.
        </p>
      </div>
    );
  }

  if (!state) return null;

  const { mission, metrics, victims, vehicles, approvals } = state;
  const activeVictims = victims.filter((v) => v.status !== "EVACUATED").length;
  const criticalVictims = victims.filter((v) => v.severity === "CRITICAL" && v.status !== "EVACUATED").length;
  const availableResources = vehicles.filter((v) => v.status === "AVAILABLE").length;

  return (
    <div className="flex flex-col gap-6">
      {error && <ErrorBanner message={`Live update failed, showing last known state — ${error}`} />}

      <ApprovalBanner approvals={approvals} missionId={mission.id} onChanged={refresh} />

      <header className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-slate-50">{mission.name}</h1>
          <MissionStatusBadge status={mission.status} />
          <AgentStateBadge state={mission.agent_state} />
        </div>
        <span className="text-xs text-slate-500">
          Elapsed {mission.elapsed_min}min &middot; ETA {mission.estimated_completion_min}min
        </span>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Mission Progress" value={`${Math.round(mission.progress_pct)}%`} />
        <KpiCard label="Active Victims" value={activeVictims} />
        <KpiCard
          label="Critical Victims"
          value={criticalVictims}
          tone={criticalVictims > 0 ? "critical" : "ok"}
        />
        <KpiCard label="Available Resources" value={availableResources} />
        <KpiCard label="Mission ETA" value={`${mission.estimated_completion_min}min`} />
        <KpiCard
          label="Status"
          value={mission.status.replace(/_/g, " ")}
          tone={mission.status === "FAILED" ? "critical" : mission.status === "AT_RISK" ? "risk" : "ok"}
        />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 flex flex-col gap-3">
          <div className="panel p-3">
            <MapView state={state} height={440} />
            <div className="pt-3">
              <MapLegend />
            </div>
          </div>

          <div className="panel p-4">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Simulation Control</h2>
            <SimulationControls missionId={mission.id} onChanged={refresh} />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <AgentPanel state={state} />
          <DecisionPanel state={state} />
        </div>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Victims Evacuated" value={metrics.victims_evacuated} />
        <KpiCard label="Critical Evacuated" value={`${metrics.critical_evacuated}/${metrics.critical_total}`} />
        <KpiCard label="Replans" value={metrics.replans} />
        <KpiCard
          label="Successful / Failed Actions"
          value={`${metrics.successful_actions} / ${metrics.failed_actions}`}
        />
      </section>
    </div>
  );
}

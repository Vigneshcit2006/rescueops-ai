import { useNavigate } from "react-router-dom";
import { useMission } from "../context/MissionContext";
import { useMissionState } from "../hooks/useMissionState";
import { MapLegend, MapView } from "../components/MapView";
import { ErrorBanner, LoadingBlock } from "../components/Feedback";
import { api, ApiRequestError } from "../lib/api";
import { useState } from "react";

export function MapPage() {
  const { missionId, setMissionId } = useMission();
  const navigate = useNavigate();
  const { state, loading, error } = useMissionState(missionId, 2000, true);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  async function launch() {
    setLaunching(true);
    setLaunchError(null);
    try {
      const created = await api.createMission("flood_default");
      setMissionId(created.mission.id);
      navigate(`/dashboard/${created.mission.id}`);
    } catch (err) {
      setLaunchError(err instanceof ApiRequestError ? err.message : "Failed to launch mission");
    } finally {
      setLaunching(false);
    }
  }

  if (!missionId) {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <p className="text-slate-400">No active mission. Launch one to see the live map.</p>
        <button className="btn-primary" onClick={launch} disabled={launching}>
          {launching ? "Launching..." : "Launch Mission Simulator"}
        </button>
        {launchError && <p className="text-status-critical text-sm">{launchError}</p>}
      </div>
    );
  }

  if (loading && !state) return <LoadingBlock label="Loading map..." />;
  if (error && !state) return <ErrorBanner message={error} />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-100">Live Mission Map</h1>
        <MapLegend />
      </div>
      <div className="panel p-2">
        <MapView state={state} height={window.innerHeight - 220} />
      </div>
    </div>
  );
}

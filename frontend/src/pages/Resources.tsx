import { useMission } from "../context/MissionContext";
import { useMissionState } from "../hooks/useMissionState";
import { ErrorBanner, LoadingBlock, EmptyState } from "../components/Feedback";
import { Badge } from "../components/StatusBadge";

function occupancyTone(occupancy: number, capacity: number): "ok" | "risk" | "critical" {
  if (capacity <= 0) return "ok";
  const ratio = occupancy / capacity;
  if (ratio >= 1) return "critical";
  if (ratio >= 0.75) return "risk";
  return "ok";
}

const vehicleStatusTone: Record<string, "ok" | "risk" | "critical" | "info" | "neutral"> = {
  AVAILABLE: "ok",
  ASSIGNED: "info",
  EN_ROUTE: "info",
  UNAVAILABLE: "critical",
};

export function Resources() {
  const { missionId } = useMission();
  const { state, loading, error } = useMissionState(missionId, 2000, true);

  if (!missionId) return <EmptyState title="No active mission" hint="Launch a mission from the landing page" />;
  if (loading && !state) return <LoadingBlock label="Loading resources..." />;
  if (error && !state) return <ErrorBanner message={error} />;
  if (!state) return null;

  const { vehicles, hospitals, shelters } = state;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-slate-100">Resources</h1>

      <div className="panel p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">
          Vehicles <span className="text-slate-600 font-normal">({vehicles.length})</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-base-700">
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Location</th>
                <th className="py-2 pr-3">Capacity</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Assignment</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id} className="border-b border-base-800">
                  <td className="py-2 pr-3 font-mono text-xs text-slate-400">{v.id}</td>
                  <td className="py-2 pr-3 text-slate-300">{v.type.replace(/_/g, " ")}</td>
                  <td className="py-2 pr-3 text-slate-400">{v.location}</td>
                  <td className="py-2 pr-3 text-slate-400">{v.capacity}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={vehicleStatusTone[v.status] ?? "neutral"}>{v.status.replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="py-2 pr-3 text-slate-500 text-xs">{v.current_assignment ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {vehicles.length === 0 && <EmptyState title="No vehicles" />}
        </div>
      </div>

      <div className="panel p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">
          Hospitals <span className="text-slate-600 font-normal">({hospitals.length})</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-base-700">
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Location</th>
                <th className="py-2 pr-3">Occupancy</th>
                <th className="py-2 pr-3">Capabilities</th>
              </tr>
            </thead>
            <tbody>
              {hospitals.map((h) => (
                <tr key={h.id} className="border-b border-base-800">
                  <td className="py-2 pr-3 font-mono text-xs text-slate-400">{h.id}</td>
                  <td className="py-2 pr-3 text-slate-300">{h.location}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={occupancyTone(h.occupancy, h.capacity)}>
                      {h.occupancy}/{h.capacity}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-500">{h.capabilities.join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {hospitals.length === 0 && <EmptyState title="No hospitals" />}
        </div>
      </div>

      <div className="panel p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">
          Shelters <span className="text-slate-600 font-normal">({shelters.length})</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-base-700">
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Location</th>
                <th className="py-2 pr-3">Occupancy</th>
              </tr>
            </thead>
            <tbody>
              {shelters.map((s) => (
                <tr key={s.id} className="border-b border-base-800">
                  <td className="py-2 pr-3 font-mono text-xs text-slate-400">{s.id}</td>
                  <td className="py-2 pr-3 text-slate-300">{s.location}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={occupancyTone(s.occupancy, s.capacity)}>
                      {s.occupancy}/{s.capacity}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shelters.length === 0 && <EmptyState title="No shelters" />}
        </div>
      </div>
    </div>
  );
}

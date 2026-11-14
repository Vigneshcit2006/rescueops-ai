import { useMemo, useState } from "react";
import { useMission } from "../context/MissionContext";
import { useMissionState } from "../hooks/useMissionState";
import { ErrorBanner, LoadingBlock, EmptyState } from "../components/Feedback";
import { EvidenceGraph } from "../components/EvidenceGraph";

export function EvidencePage() {
  const { missionId } = useMission();
  const { state, loading, error } = useMissionState(missionId, 2000, true);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [query, setQuery] = useState("");

  const types = useMemo(() => {
    if (!state) return [];
    return Array.from(new Set(state.evidence.map((e) => e.type)));
  }, [state]);

  const filtered = useMemo(() => {
    if (!state) return [];
    return state.evidence
      .filter((e) => typeFilter === "ALL" || e.type === typeFilter)
      .filter(
        (e) =>
          query.trim() === "" ||
          e.summary.toLowerCase().includes(query.toLowerCase()) ||
          e.related_entities.some((r) => r.toLowerCase().includes(query.toLowerCase()))
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [state, typeFilter, query]);

  if (!missionId) return <EmptyState title="No active mission" hint="Launch a mission from the landing page" />;
  if (loading && !state) return <LoadingBlock label="Loading evidence..." />;
  if (error && !state) return <ErrorBanner message={error} />;
  if (!state) return null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-slate-100">Evidence Explorer</h1>

      <div className="panel p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Reasoning graph</h2>
        <EvidenceGraph state={state} />
      </div>

      <div className="panel p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="bg-base-800 border border-base-700 rounded-md px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 flex-1 min-w-[200px]"
            placeholder="Search evidence summary or entity id..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="bg-base-800 border border-base-700 rounded-md px-3 py-1.5 text-sm text-slate-200"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No evidence matches your filters" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-base-700">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Summary</th>
                  <th className="py-2 pr-3">Related</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b border-base-800 align-top">
                    <td className="py-2 pr-3 text-slate-500 whitespace-nowrap text-xs">
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="badge bg-base-700 text-slate-300 border border-base-600">{e.type}</span>
                    </td>
                    <td className="py-2 pr-3 text-slate-400 text-xs">{e.source}</td>
                    <td className="py-2 pr-3 text-slate-300">{e.summary}</td>
                    <td className="py-2 pr-3 text-xs text-slate-500">
                      {e.related_entities.join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useMission } from "../context/MissionContext";
import { useMissionState } from "../hooks/useMissionState";
import { RiskBadge } from "../components/StatusBadge";
import { ErrorBanner, LoadingBlock, EmptyState } from "../components/Feedback";
import type { Decision } from "../types";

function DecisionRow({ decision }: { decision: Decision }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="panel">
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium text-slate-200 truncate">{decision.selected_action}</span>
          <span className="text-xs text-slate-500">{new Date(decision.timestamp).toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {decision.requires_human_approval && (
            <span className="badge bg-status-risk/15 text-status-risk border border-status-risk/30">
              approval
            </span>
          )}
          <RiskBadge risk={decision.risk_level} />
          <span className="text-slate-500 text-xs">{open ? "−" : "+"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-base-700 px-4 py-3 flex flex-col gap-3">
          <div>
            <span className="kpi-label">Reason</span>
            <p className="text-sm text-slate-400 mt-0.5">{decision.reason}</p>
          </div>
          <div>
            <span className="kpi-label">Expected impact</span>
            <p className="text-sm text-slate-400 mt-0.5">{decision.expected_impact}</p>
          </div>

          {decision.alternatives.length > 0 && (
            <div>
              <span className="kpi-label">Alternatives</span>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {decision.alternatives.map((alt, i) => (
                  <li
                    key={i}
                    className="text-xs bg-base-800 border border-base-700 rounded px-2.5 py-1.5 flex items-center justify-between gap-2"
                  >
                    <span className="text-slate-300">{alt.action}</span>
                    <span className="text-slate-500 shrink-0">
                      {alt.eta_min != null && `${alt.eta_min}min `}
                      impact {alt.impact_score.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {decision.evidence_ids.length > 0 && (
            <div>
              <span className="kpi-label">Evidence</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {decision.evidence_ids.map((id) => (
                  <span key={id} className="text-[11px] font-mono bg-base-800 border border-base-700 rounded px-2 py-1 text-slate-400">
                    {id}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 border-t border-base-700">
            <span>Confidence {(decision.confidence * 100).toFixed(0)}%</span>
            <span>Mission impact {decision.mission_impact_score.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function Decisions() {
  const { missionId } = useMission();
  const { state, loading, error } = useMissionState(missionId, 2000, true);

  if (!missionId) return <EmptyState title="No active mission" hint="Launch a mission from the landing page" />;
  if (loading && !state) return <LoadingBlock label="Loading decisions..." />;
  if (error && !state) return <ErrorBanner message={error} />;
  if (!state) return null;

  const decisions = [...state.decisions].reverse();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-100">
        Decision Timeline <span className="text-slate-600 font-normal text-sm">({decisions.length})</span>
      </h1>
      {decisions.length === 0 ? (
        <EmptyState title="No decisions recorded yet" />
      ) : (
        <div className="flex flex-col gap-2">
          {decisions.map((d) => (
            <DecisionRow key={d.id} decision={d} />
          ))}
        </div>
      )}
    </div>
  );
}

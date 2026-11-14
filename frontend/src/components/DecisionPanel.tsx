import type { MissionState } from "../types";
import { RiskBadge } from "./StatusBadge";

export function DecisionPanel({ state }: { state: MissionState }) {
  const decision = state.decisions[state.decisions.length - 1];

  return (
    <div className="panel p-4 flex flex-col gap-3">
      <div className="panel-header -mx-4 -mt-4 mb-1 px-4">
        <h2 className="text-sm font-semibold text-slate-300">Current Decision</h2>
        {decision && <RiskBadge risk={decision.risk_level} />}
      </div>

      {!decision ? (
        <p className="text-sm text-slate-500">No decision has been made yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <span className="kpi-label">Selected action</span>
            <p className="text-sm text-slate-200 mt-0.5">{decision.selected_action}</p>
          </div>
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
              <span className="kpi-label">Alternatives considered</span>
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

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-base-700">
            <span>Confidence {(decision.confidence * 100).toFixed(0)}%</span>
            <span>Mission impact {decision.mission_impact_score.toFixed(2)}</span>
            {decision.requires_human_approval && (
              <span className="text-status-risk font-medium">Requires approval</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

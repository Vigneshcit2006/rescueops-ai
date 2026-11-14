import { Link } from "react-router-dom";
import type { MissionState } from "../types";
import { AgentStateBadge } from "./StatusBadge";

const kindTone: Record<string, string> = {
  INFO: "text-status-info",
  WARNING: "text-status-risk",
  DECISION: "text-accent",
  FAILURE: "text-status-critical",
  SUCCESS: "text-status-ok",
};

export function AgentPanel({ state }: { state: MissionState }) {
  const { mission, goal, trace, decisions } = state;
  const latestTrace = trace[trace.length - 1];
  const latestDecision = decisions[decisions.length - 1];

  return (
    <div className="panel p-4 flex flex-col gap-3">
      <div className="panel-header -mx-4 -mt-4 mb-1 px-4">
        <h2 className="text-sm font-semibold text-slate-300">Agent</h2>
        <AgentStateBadge state={mission.agent_state} />
      </div>

      <div>
        <span className="kpi-label">Current goal</span>
        <p className="text-sm text-slate-200 mt-0.5">{goal.objective}</p>
        <p className="text-xs text-slate-500 mt-1">
          Deadline {goal.deadline_minutes}min &middot; Priority {goal.priority}
        </p>
      </div>

      <div>
        <span className="kpi-label">Latest trace event</span>
        {latestTrace ? (
          <p className={`text-sm mt-0.5 ${kindTone[latestTrace.kind] ?? "text-slate-300"}`}>
            {latestTrace.event}
            {latestTrace.detail && <span className="text-slate-500"> — {latestTrace.detail}</span>}
          </p>
        ) : (
          <p className="text-sm text-slate-500 mt-0.5">No trace events yet</p>
        )}
      </div>

      <div>
        <span className="kpi-label">Latest decision</span>
        {latestDecision ? (
          <div className="mt-0.5">
            <p className="text-sm text-slate-200">{latestDecision.selected_action}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Impact score {latestDecision.mission_impact_score.toFixed(2)} &middot; Confidence{" "}
              {(latestDecision.confidence * 100).toFixed(0)}%
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500 mt-0.5">No decisions yet</p>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <Link to="/decisions" className="btn-secondary flex-1 text-center">
          View decisions
        </Link>
        <Link to="/evidence" className="btn-secondary flex-1 text-center">
          View evidence
        </Link>
      </div>
    </div>
  );
}

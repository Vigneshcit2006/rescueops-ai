import type { AgentState, MissionStatus, RiskLevel, Severity } from "../types";

type BadgeTone = "ok" | "risk" | "critical" | "info" | "neutral";

const toneClasses: Record<BadgeTone, string> = {
  ok: "bg-status-ok/15 text-status-ok border border-status-ok/30",
  risk: "bg-status-risk/15 text-status-risk border border-status-risk/30",
  critical: "bg-status-critical/15 text-status-critical border border-status-critical/30",
  info: "bg-status-info/15 text-status-info border border-status-info/30",
  neutral: "bg-base-600/40 text-slate-300 border border-base-500/40",
};

export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return <span className={`badge ${toneClasses[tone]}`}>{children}</span>;
}

const missionStatusTone: Record<MissionStatus, BadgeTone> = {
  ON_TRACK: "ok",
  AT_RISK: "risk",
  FAILED: "critical",
  COMPLETED: "ok",
  PLANNING: "info",
};

export function MissionStatusBadge({ status }: { status: MissionStatus }) {
  return <Badge tone={missionStatusTone[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Badge>;
}

const agentStateTone: Record<AgentState, BadgeTone> = {
  IDLE: "neutral",
  OBSERVING: "info",
  PLANNING: "info",
  EXECUTING: "ok",
  EVALUATING: "info",
  REPLANNING: "risk",
  WAITING_APPROVAL: "risk",
  COMPLETED: "ok",
  FAILED: "critical",
};

export function AgentStateBadge({ state }: { state: AgentState }) {
  return <Badge tone={agentStateTone[state] ?? "neutral"}>{state.replace(/_/g, " ")}</Badge>;
}

const severityTone: Record<Severity, BadgeTone> = {
  CRITICAL: "critical",
  HIGH: "risk",
  MEDIUM: "info",
  LOW: "neutral",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge tone={severityTone[severity] ?? "neutral"}>{severity}</Badge>;
}

const riskTone: Record<RiskLevel, BadgeTone> = {
  LOW: "ok",
  MEDIUM: "info",
  HIGH: "risk",
  CRITICAL: "critical",
};

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return <Badge tone={riskTone[risk] ?? "neutral"}>{risk}</Badge>;
}

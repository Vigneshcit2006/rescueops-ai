import type {
  Approval,
  Decision,
  DecisionTraceEvent,
  Evidence,
  MissionMetrics,
  MissionState,
  SimulationEventType,
} from "../types";

export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) || "http://localhost:8020/api";

export class ApiRequestError extends Error {
  status: number;
  detail?: string;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch (err) {
    throw new ApiRequestError(
      `Network error contacting API at ${API_BASE}${path}`,
      0,
      err instanceof Error ? err.message : String(err)
    );
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let detail: string | undefined;
    try {
      const body = await res.json();
      message = body?.error || message;
      detail = body?.detail;
    } catch {
      // ignore non-json error body
    }
    throw new ApiRequestError(message, res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  createMission: (scenario: string = "flood_default") =>
    request<MissionState>("/missions", {
      method: "POST",
      body: JSON.stringify({ scenario }),
    }),

  getMission: (id: string) => request<MissionState>(`/missions/${id}`),

  getMissionState: (id: string) => request<MissionState>(`/missions/${id}/state`),

  // These four wrap { steps: [...], state } — unwrap to the state the UI renders.
  startMission: (id: string) =>
    request<{ steps: unknown[]; state: MissionState }>(`/missions/${id}/start`, { method: "POST" }).then(
      (r) => r.state
    ),

  pauseMission: (id: string) => request<MissionState>(`/missions/${id}/pause`, { method: "POST" }),

  resumeMission: (id: string) =>
    request<{ steps: unknown[]; state: MissionState }>(`/missions/${id}/resume`, { method: "POST" }).then(
      (r) => r.state
    ),

  agentStep: (missionId: string) =>
    request<{ result: Record<string, unknown>; state: MissionState }>("/agent/step", {
      method: "POST",
      body: JSON.stringify({ mission_id: missionId }),
    }),

  agentReplan: (missionId: string) =>
    request<{ result: Record<string, unknown>; state: MissionState }>("/agent/replan", {
      method: "POST",
      body: JSON.stringify({ mission_id: missionId }),
    }),

  getDecisions: (id: string) => request<Decision[]>(`/missions/${id}/decisions`),

  getEvidence: (id: string) => request<Evidence[]>(`/missions/${id}/evidence`),

  getTrace: (id: string) => request<DecisionTraceEvent[]>(`/missions/${id}/trace`),

  triggerSimulationEvent: (
    missionId: string,
    event: SimulationEventType,
    params?: Record<string, unknown>
  ) =>
    request<{ event_result: Record<string, unknown>; step_result: Record<string, unknown>; state: MissionState }>(
      "/simulation/events",
      { method: "POST", body: JSON.stringify({ mission_id: missionId, event, params: params ?? {} }) }
    ).then((r) => r.state),

  resetSimulation: (missionId: string) =>
    request<MissionState>("/simulation/reset", {
      method: "POST",
      body: JSON.stringify({ mission_id: missionId }),
    }),

  approve: (approvalId: string, missionId: string) =>
    request<{ steps: unknown[]; state: MissionState }>(`/approvals/${approvalId}/approve`, {
      method: "POST",
      body: JSON.stringify({ mission_id: missionId }),
    }).then((r) => r.state),

  reject: (approvalId: string, missionId: string) =>
    request<MissionState>(`/approvals/${approvalId}/reject`, {
      method: "POST",
      body: JSON.stringify({ mission_id: missionId }),
    }),

  getAnalytics: (id: string) => request<Record<string, unknown> & Partial<MissionMetrics>>(
    `/analytics/${id}`
  ),

  runDemo: (missionId: string) =>
    request<{ log: unknown[]; state: MissionState }>("/demo/run", {
      method: "POST",
      body: JSON.stringify({ mission_id: missionId }),
    }).then((r) => r.state),

  // Not part of the documented v1 contract, but confirmed live on the dev
  // backend (returns e.g. { ok: true, llm_provider: "local-fallback" }).
  // Settings page uses this when available and falls back gracefully.
  getHealth: () => request<{ ok: boolean; llm_provider?: string; [key: string]: unknown }>("/health"),
};

export type ApprovalAction = (approval: Approval) => Promise<void>;

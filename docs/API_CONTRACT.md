# RescueOps AI — API Contract (v1)

Base URL (dev): `http://localhost:8020/api`

All responses are JSON. Timestamps are ISO-8601 strings. IDs are strings.

## Core types

```ts
type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type RoadStatus = "OPEN" | "CONGESTED" | "BLOCKED";
type MissionStatus = "ON_TRACK" | "AT_RISK" | "FAILED" | "COMPLETED" | "PLANNING";
type AgentState = "IDLE" | "OBSERVING" | "PLANNING" | "EXECUTING" | "EVALUATING" | "REPLANNING" | "WAITING_APPROVAL" | "COMPLETED" | "FAILED";

interface Victim {
  id: string; location: string; severity: Severity; people_count: number;
  medical_requirement: string; destination_requirement: "HOSPITAL"|"SHELTER";
  status: "PENDING"|"ASSIGNED"|"IN_TRANSIT"|"EVACUATED"; assigned_resource?: string;
}
interface Vehicle { id: string; type: "AMBULANCE"|"RESCUE_TEAM"|"MEDICAL_TEAM"|"TRANSPORT"; location: string;
  capacity: number; status: "AVAILABLE"|"ASSIGNED"|"EN_ROUTE"|"UNAVAILABLE"; current_assignment?: string; }
interface Hospital { id: string; location: string; capacity: number; occupancy: number; capabilities: string[]; }
interface Shelter { id: string; location: string; capacity: number; occupancy: number; }
interface Road { id: string; source: string; destination: string; distance_km: number; base_travel_min: number; status: RoadStatus; risk: number; }
interface Evidence { id: string; type: string; source: string; timestamp: string; summary: string; related_entities: string[]; data?: object; }
interface DecisionTraceEvent { id: string; timestamp: string; event: string; detail?: string; kind: "INFO"|"WARNING"|"DECISION"|"FAILURE"|"SUCCESS"; }
interface Decision {
  id: string; timestamp: string; selected_action: string; reason: string;
  alternatives: { action: string; eta_min?: number; impact_score: number }[];
  expected_impact: string; risk_level: RiskLevel; confidence: number;
  mission_impact_score: number; requires_human_approval: boolean; evidence_ids: string[];
}
interface Approval { id: string; decision_id: string; summary: string; risk_level: RiskLevel; status: "PENDING"|"APPROVED"|"REJECTED"; }
interface MissionGoal { goal_id: string; objective: string; deadline_minutes: number; priority: string; constraints: string[]; success_conditions: string[]; }
interface MissionState {
  mission: { id, name, status: MissionStatus, agent_state: AgentState, created_at, elapsed_min, progress_pct, estimated_completion_min };
  goal: MissionGoal;
  victims: Victim[]; vehicles: Vehicle[]; hospitals: Hospital[]; shelters: Shelter[]; roads: Road[];
  decisions: Decision[]; evidence: Evidence[]; trace: DecisionTraceEvent[]; approvals: Approval[];
  metrics: { victims_evacuated: number; critical_evacuated: number; critical_total: number; replans: number; failed_actions: number; successful_actions: number; };
}
```

## Endpoints

- `POST /api/missions` — create mission from demo scenario. Body: `{ scenario?: "flood_default" }` → `MissionState`
- `GET /api/missions/{id}` — full mission state
- `GET /api/missions/{id}/state` — alias of above (lightweight polling)
- `POST /api/missions/{id}/start` — begin autonomous loop (runs steps until blocked/approval/completed, capped iterations)
- `POST /api/missions/{id}/pause`
- `POST /api/missions/{id}/resume`
- `POST /api/agent/step` — body `{mission_id}` → executes exactly one loop iteration, returns updated state + last decision
- `POST /api/agent/replan` — body `{mission_id}` → force a replan cycle
- `GET /api/missions/{id}/decisions` → `Decision[]`
- `GET /api/missions/{id}/evidence` → `Evidence[]`
- `GET /api/missions/{id}/trace` → `DecisionTraceEvent[]`
- `POST /api/simulation/events` — body `{mission_id, event: "ROAD_BLOCKED"|"VEHICLE_UNAVAILABLE"|"HOSPITAL_FULL"|"NEW_VICTIM", params?}` → triggers env change, returns updated state
- `POST /api/simulation/reset` — body `{mission_id}`
- `POST /api/approvals/{id}/approve` body `{mission_id}`
- `POST /api/approvals/{id}/reject` body `{mission_id}`
- `GET /api/analytics/{id}` → metrics summary object
- `POST /api/demo/run` — body `{mission_id}` → runs the full scripted demo sequence server-side, returns final state (frontend can also step through it live via SSE-less polling of /state after each simulation/events call)

Errors: `{ "error": string, "detail"?: string }` with appropriate HTTP status.

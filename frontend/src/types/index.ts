// Types mirroring docs/API_CONTRACT.md exactly.

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type RoadStatus = "OPEN" | "CONGESTED" | "BLOCKED";
export type MissionStatus = "ON_TRACK" | "AT_RISK" | "FAILED" | "COMPLETED" | "PLANNING";
export type AgentState =
  | "IDLE"
  | "OBSERVING"
  | "PLANNING"
  | "EXECUTING"
  | "EVALUATING"
  | "REPLANNING"
  | "WAITING_APPROVAL"
  | "COMPLETED"
  | "FAILED";

export const AGENT_STATES: AgentState[] = [
  "IDLE",
  "OBSERVING",
  "PLANNING",
  "EXECUTING",
  "EVALUATING",
  "REPLANNING",
  "WAITING_APPROVAL",
  "COMPLETED",
  "FAILED",
];

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Victim {
  id: string;
  location: string;
  severity: Severity;
  people_count: number;
  medical_requirement: string;
  destination_requirement: "HOSPITAL" | "SHELTER";
  status: "PENDING" | "ASSIGNED" | "IN_TRANSIT" | "EVACUATED";
  assigned_resource?: string;
  lat?: number;
  lng?: number;
  [key: string]: unknown;
}

export interface Vehicle {
  id: string;
  type: "AMBULANCE" | "RESCUE_TEAM" | "MEDICAL_TEAM" | "TRANSPORT";
  location: string;
  capacity: number;
  status: "AVAILABLE" | "ASSIGNED" | "EN_ROUTE" | "UNAVAILABLE";
  current_assignment?: string;
  lat?: number;
  lng?: number;
  [key: string]: unknown;
}

export interface Hospital {
  id: string;
  location: string;
  capacity: number;
  occupancy: number;
  capabilities: string[];
  lat?: number;
  lng?: number;
  [key: string]: unknown;
}

export interface Shelter {
  id: string;
  location: string;
  capacity: number;
  occupancy: number;
  lat?: number;
  lng?: number;
  [key: string]: unknown;
}

export interface Road {
  id: string;
  source: string;
  destination: string;
  distance_km: number;
  base_travel_min: number;
  status: RoadStatus;
  risk: number;
  [key: string]: unknown;
}

export interface Evidence {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  summary: string;
  related_entities: string[];
  data?: Record<string, unknown>;
}

export interface DecisionTraceEvent {
  id: string;
  timestamp: string;
  event: string;
  detail?: string;
  kind: "INFO" | "WARNING" | "DECISION" | "FAILURE" | "SUCCESS";
}

export interface DecisionAlternative {
  action: string;
  eta_min?: number;
  impact_score: number;
}

export interface Decision {
  id: string;
  timestamp: string;
  selected_action: string;
  reason: string;
  alternatives: DecisionAlternative[];
  expected_impact: string;
  risk_level: RiskLevel;
  confidence: number;
  mission_impact_score: number;
  requires_human_approval: boolean;
  evidence_ids: string[];
}

export interface Approval {
  id: string;
  decision_id: string;
  summary: string;
  risk_level: RiskLevel;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export interface MissionGoal {
  goal_id: string;
  objective: string;
  deadline_minutes: number;
  priority: string;
  constraints: string[];
  success_conditions: string[];
}

export interface Zone {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/** A live entry of the agent's current plan — used to draw active routes. */
export interface Assignment {
  victim_id: string;
  resource_id: string | null;
  dest_kind: "HOSPITAL" | "SHELTER" | null;
  dest_id: string | null;
  road_ids: string[];
  eta_min: number | null;
}

export interface SuccessConditions {
  all_critical_victims_assigned: boolean;
  safe_destination_available: boolean;
  completed_within_deadline: boolean;
}

export interface MissionSummary {
  id: string;
  name: string;
  status: MissionStatus;
  agent_state: AgentState;
  created_at: string;
  elapsed_min: number;
  progress_pct: number;
  estimated_completion_min: number;
  iterations: number;
  deadline_minutes: number;
  mission_impact_score: number;
  mission_impact_factors: Record<string, number>;
  deadline_met: boolean;
  success_conditions_met: SuccessConditions;
}

export interface MissionMetrics {
  victims_evacuated: number;
  critical_evacuated: number;
  critical_total: number;
  replans: number;
  failed_actions: number;
  successful_actions: number;
  route_changes: number;
  human_escalations: number;
}

export interface MissionState {
  mission: MissionSummary;
  goal: MissionGoal;
  zones: Zone[];
  assignments: Assignment[];
  victims: Victim[];
  vehicles: Vehicle[];
  hospitals: Hospital[];
  shelters: Shelter[];
  roads: Road[];
  decisions: Decision[];
  evidence: Evidence[];
  trace: DecisionTraceEvent[];
  approvals: Approval[];
  metrics: MissionMetrics;
}

export type SimulationEventType =
  | "ROAD_BLOCKED"
  | "VEHICLE_UNAVAILABLE"
  | "HOSPITAL_FULL"
  | "NEW_VICTIM";

export interface ApiError {
  error: string;
  detail?: string;
}

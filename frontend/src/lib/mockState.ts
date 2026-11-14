// Local-dev-only fixture used by MissionContext when the real backend is
// unreachable. This is NEVER used automatically in production; it exists so
// pages can be visually developed/previewed before the backend is up.
// Real API calls in src/lib/api.ts are always the default data path.
import type { MissionState } from "../types";

export const MOCK_MISSION_STATE: MissionState = {
  mission: {
    id: "mock-mission-1",
    name: "Riverside Flood Response (offline preview)",
    status: "AT_RISK",
    agent_state: "REPLANNING",
    created_at: new Date(Date.now() - 12 * 60_000).toISOString(),
    elapsed_min: 12,
    progress_pct: 41,
    estimated_completion_min: 58,
    iterations: 4,
    deadline_minutes: 90,
    mission_impact_score: 0.74,
    mission_impact_factors: { eta: 0.6, capacity: 0.8, risk: 0.74 },
    deadline_met: true,
    success_conditions_met: {
      all_critical_victims_assigned: false,
      safe_destination_available: true,
      completed_within_deadline: true,
    },
  },
  goal: {
    goal_id: "goal-1",
    objective: "Evacuate all flagged victims to appropriate hospital/shelter capacity before floodwater peak.",
    deadline_minutes: 90,
    priority: "CRITICAL",
    constraints: ["Prioritize CRITICAL severity", "Do not exceed hospital capacity", "Avoid BLOCKED roads"],
    success_conditions: ["All CRITICAL victims evacuated", "No hospital over capacity", "Mission completed under deadline"],
  },
  zones: [
    { id: "z1", name: "Riverside Ave", lat: 37.775, lng: -122.418 },
    { id: "z2", name: "Elm Street", lat: 37.771, lng: -122.428 },
    { id: "z3", name: "Oak Court", lat: 37.768, lng: -122.41 },
  ],
  assignments: [
    { victim_id: "v1", resource_id: "amb-1", dest_kind: "HOSPITAL", dest_id: "h1", road_ids: ["r1"], eta_min: 11 },
    { victim_id: "v3", resource_id: "amb-2", dest_kind: "SHELTER", dest_id: "s1", road_ids: ["r3"], eta_min: 6 },
  ],
  victims: [
    { id: "v1", location: "Riverside Ave", severity: "CRITICAL", people_count: 3, medical_requirement: "trauma", destination_requirement: "HOSPITAL", status: "IN_TRANSIT", assigned_resource: "amb-1", lat: 37.775, lng: -122.418 },
    { id: "v2", location: "Elm Street", severity: "HIGH", people_count: 5, medical_requirement: "general", destination_requirement: "SHELTER", status: "PENDING", lat: 37.771, lng: -122.428 },
    { id: "v3", location: "Oak Court", severity: "MEDIUM", people_count: 2, medical_requirement: "none", destination_requirement: "SHELTER", status: "ASSIGNED", assigned_resource: "amb-2", lat: 37.768, lng: -122.41 },
  ],
  vehicles: [
    { id: "amb-1", type: "AMBULANCE", location: "Riverside Ave", capacity: 4, status: "EN_ROUTE", current_assignment: "v1", lat: 37.773, lng: -122.42 },
    { id: "amb-2", type: "AMBULANCE", location: "Oak Court", capacity: 4, status: "ASSIGNED", current_assignment: "v3", lat: 37.769, lng: -122.412 },
    { id: "rt-1", type: "RESCUE_TEAM", location: "Depot", capacity: 6, status: "AVAILABLE", lat: 37.78, lng: -122.415 },
  ],
  hospitals: [
    { id: "h1", location: "Downtown General", capacity: 40, occupancy: 34, capabilities: ["trauma", "general"], lat: 37.779, lng: -122.42 },
    { id: "h2", location: "Northside Medical", capacity: 25, occupancy: 25, capabilities: ["general"], lat: 37.785, lng: -122.405 },
  ],
  shelters: [
    { id: "s1", location: "Community Center", capacity: 100, occupancy: 62, lat: 37.766, lng: -122.415 },
  ],
  roads: [
    { id: "r1", source: "Riverside Ave", destination: "Downtown General", distance_km: 3.2, base_travel_min: 8, status: "CONGESTED", risk: 0.4 },
    { id: "r2", source: "Elm Street", destination: "Community Center", distance_km: 1.8, base_travel_min: 5, status: "BLOCKED", risk: 0.9 },
    { id: "r3", source: "Oak Court", destination: "Community Center", distance_km: 2.1, base_travel_min: 6, status: "OPEN", risk: 0.1 },
  ],
  decisions: [
    {
      id: "d1",
      timestamp: new Date(Date.now() - 3 * 60_000).toISOString(),
      selected_action: "Reroute amb-1 via r3 to Downtown General",
      reason: "Primary route r1 CONGESTED; alternate route reduces ETA variance under deadline risk.",
      alternatives: [
        { action: "Hold at staging", eta_min: 22, impact_score: 0.31 },
        { action: "Reroute via r3", eta_min: 11, impact_score: 0.82 },
      ],
      expected_impact: "Reduces victim v1 ETA by ~9 minutes",
      risk_level: "MEDIUM",
      confidence: 0.78,
      mission_impact_score: 0.74,
      requires_human_approval: false,
      evidence_ids: ["e1", "e2"],
    },
  ],
  evidence: [
    { id: "e1", type: "SENSOR", source: "traffic-feed", timestamp: new Date(Date.now() - 4 * 60_000).toISOString(), summary: "Road r1 congestion detected, +6min travel time", related_entities: ["r1"] },
    { id: "e2", type: "PLAN_FAILURE", source: "planner", timestamp: new Date(Date.now() - 3.5 * 60_000).toISOString(), summary: "Original route ETA exceeds victim survivability window", related_entities: ["v1", "r1"] },
  ],
  trace: [
    { id: "t1", timestamp: new Date(Date.now() - 5 * 60_000).toISOString(), event: "Observation cycle started", kind: "INFO" },
    { id: "t2", timestamp: new Date(Date.now() - 4 * 60_000).toISOString(), event: "Congestion detected on r1", kind: "WARNING" },
    { id: "t3", timestamp: new Date(Date.now() - 3 * 60_000).toISOString(), event: "Replanned route for amb-1", detail: "via r3", kind: "DECISION" },
  ],
  approvals: [],
  metrics: {
    victims_evacuated: 1,
    critical_evacuated: 0,
    critical_total: 1,
    replans: 1,
    failed_actions: 0,
    successful_actions: 3,
    route_changes: 1,
    human_escalations: 0,
  },
};

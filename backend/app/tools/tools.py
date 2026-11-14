"""The agent's tool layer. Every tool returns a structured result and records
evidence. Tools wrap the deterministic engines — the agent decides WHICH
tool to call and WHEN, but the underlying math is not LLM-generated.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Callable

from app.models.domain import MissionWorld, RiskLevel, Approval, next_id
from app.simulation import route_engine, resource_engine, goal_engine, scoring


def _wrap(world: MissionWorld, tool: str, input_: dict, result: dict, evidence_type: str, summary: str, related: list[str] | None = None) -> dict:
    ev = world.add_evidence(evidence_type, f"tool:{tool}", summary, related or [])
    return {
        "tool": tool,
        "input": input_,
        "result": result,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "evidence_id": ev.id,
    }


def get_incident_state(world: MissionWorld) -> dict:
    prog = goal_engine.evaluate_progress(world)
    return _wrap(world, "get_incident_state", {}, prog, "TOOL_RESULT", "Fetched current incident/mission state")


def get_victims(world: MissionWorld, status: str | None = None) -> dict:
    victims = [v for v in world.victims.values() if status is None or v.status == status]
    result = {"count": len(victims), "victims": [v.id for v in victims]}
    return _wrap(world, "get_victims", {"status": status}, result, "VICTIM", f"Listed {len(victims)} victims (status={status or 'ANY'})")


def get_available_resources(world: MissionWorld, vtype: str | None = None) -> dict:
    vehicles = resource_engine.available_vehicles(world, vtype)
    result = {"count": len(vehicles), "vehicles": [v.id for v in vehicles]}
    return _wrap(world, "get_available_resources", {"type": vtype}, result, "RESOURCE", f"Found {len(vehicles)} available resources")


def get_hospital_capacity(world: MissionWorld, hospital_id: str) -> dict:
    h = world.hospitals.get(hospital_id)
    result = {"exists": bool(h), "capacity": h.capacity if h else None, "occupancy": h.occupancy if h else None,
              "available": (h.capacity - h.occupancy) if h else None}
    return _wrap(world, "get_hospital_capacity", {"hospital_id": hospital_id}, result, "HOSPITAL", f"Checked capacity of {hospital_id}", [hospital_id])


def get_shelter_capacity(world: MissionWorld, shelter_id: str) -> dict:
    s = world.shelters.get(shelter_id)
    result = {"exists": bool(s), "capacity": s.capacity if s else None, "occupancy": s.occupancy if s else None,
              "available": (s.capacity - s.occupancy) if s else None}
    return _wrap(world, "get_shelter_capacity", {"shelter_id": shelter_id}, result, "TOOL_RESULT", f"Checked capacity of {shelter_id}", [shelter_id])


def get_road_status(world: MissionWorld, road_id: str) -> dict:
    r = world.roads.get(road_id)
    result = {"exists": bool(r), "status": r.status.value if r else None, "risk": r.risk if r else None}
    return _wrap(world, "get_road_status", {"road_id": road_id}, result, "ROAD", f"Road {road_id} status: {result['status']}", [road_id])


def calculate_route(world: MissionWorld, source: str, destination: str) -> dict:
    route = route_engine.calculate_route(world, source, destination)
    return _wrap(world, "calculate_route", {"source": source, "destination": destination}, route or {"feasible": False},
                 "TOOL_RESULT", f"Route {source}->{destination}: {'ETA ' + str(route['eta_min']) + 'min' if route else 'INFEASIBLE'}")


def calculate_eta(world: MissionWorld, source: str, destination: str) -> dict:
    eta = route_engine.calculate_eta(world, source, destination)
    return _wrap(world, "calculate_eta", {"source": source, "destination": destination}, {"eta_min": eta},
                 "TOOL_RESULT", f"ETA {source}->{destination}: {eta}")


def get_weather_condition(world: MissionWorld) -> dict:
    # Deterministic placeholder condition tied to scenario (flood emergency).
    result = {"condition": "HEAVY_RAIN", "visibility": "LOW", "flood_risk": "HIGH"}
    return _wrap(world, "get_weather_condition", {}, result, "WEATHER", "Weather: heavy rain, high flood risk")


def evaluate_mission(world: MissionWorld) -> dict:
    prog = goal_engine.evaluate_progress(world)
    score, factors = scoring.mission_impact_score(world)
    result = {**prog, "mission_impact_score": score, "score_factors": factors}
    return _wrap(world, "evaluate_mission", {}, result, "TOOL_RESULT", f"Mission evaluated: {prog['status'].value} @ {prog['progress_pct']}%")


def detect_plan_failure(world: MissionWorld) -> dict:
    """Check whether the current assignment plan is still feasible given current state."""
    broken = []
    for victim_id, assignment in world.current_plan.items():
        victim = world.victims.get(victim_id)
        if not victim or victim.status == "EVACUATED":
            continue
        resource_id = assignment.get("resource_id")
        resource = world.vehicles.get(resource_id) if resource_id else None
        if resource and resource.status == "UNAVAILABLE":
            broken.append({"victim_id": victim_id, "reason": f"resource {resource_id} unavailable"})
            continue
        road_ids = assignment.get("road_ids", [])
        for rid in road_ids:
            road = world.roads.get(rid)
            if road and road.status.value == "BLOCKED":
                broken.append({"victim_id": victim_id, "reason": f"road {rid} blocked"})
                break
        dest_kind = assignment.get("dest_kind")
        dest_id = assignment.get("dest_id")
        if dest_kind == "HOSPITAL" and dest_id in world.hospitals:
            h = world.hospitals[dest_id]
            if not resource_engine.hospital_has_capacity(h, 0):
                broken.append({"victim_id": victim_id, "reason": f"hospital {dest_id} at capacity"})
    result = {"valid": len(broken) == 0, "broken_assignments": broken}
    kind = "FAILURE" if broken else "TOOL_RESULT"
    return _wrap(world, "detect_plan_failure", {}, result, kind, f"Plan check: {'VALID' if not broken else str(len(broken)) + ' broken assignment(s)'}")


def generate_alternative_plans(world: MissionWorld, victim_id: str) -> dict:
    """Generate up to 3 alternative resource+route+destination options for a victim."""
    victim = world.victims.get(victim_id)
    if not victim:
        return _wrap(world, "generate_alternative_plans", {"victim_id": victim_id}, {"alternatives": []}, "TOOL_RESULT", "victim not found")

    need_hospital = victim.destination_requirement == "HOSPITAL"
    alternatives = []
    vehicles = resource_engine.available_vehicles(world)
    destinations = []
    if need_hospital:
        destinations = [("HOSPITAL", h) for h in world.hospitals.values() if resource_engine.hospital_has_capacity(h)]
    else:
        destinations = [("SHELTER", s) for s in world.shelters.values() if resource_engine.shelter_has_capacity(s)]

    for vehicle in vehicles:
        pickup_routes = route_engine.k_alternative_routes(world, vehicle.location, victim.location, k=1)
        if not pickup_routes:
            continue
        pickup = pickup_routes[0]
        for dest_kind, dest in destinations:
            drop_routes = route_engine.k_alternative_routes(world, victim.location, dest.location, k=1)
            if not drop_routes:
                continue
            drop = drop_routes[0]
            total_eta = pickup["eta_min"] + drop["eta_min"]
            avg_risk = (pickup["risk"] + drop["risk"]) / 2
            score, factors = scoring.score_route_option(
                world, total_eta, avg_risk, victim.severity, world.goal.deadline_minutes, world.mission.elapsed_min,
            )
            alternatives.append({
                "vehicle_id": vehicle.id,
                "dest_kind": dest_kind,
                "dest_id": dest.id,
                "road_ids": pickup["road_ids"] + drop["road_ids"],
                "eta_min": round(total_eta, 1),
                "risk": round(avg_risk, 2),
                "impact_score": score,
                "score_factors": factors,
            })
    alternatives.sort(key=lambda a: a["impact_score"], reverse=True)
    result = {"victim_id": victim_id, "alternatives": alternatives[:3]}
    return _wrap(world, "generate_alternative_plans", {"victim_id": victim_id}, result, "REPLAN",
                 f"Generated {len(result['alternatives'])} alternative(s) for {victim_id}", [victim_id])


def compare_plans(world: MissionWorld, alternatives: list[dict]) -> dict:
    if not alternatives:
        return _wrap(world, "compare_plans", {}, {"best": None}, "TOOL_RESULT", "No alternatives to compare")
    best = max(alternatives, key=lambda a: a["impact_score"])
    result = {"best": best, "ranked": sorted(alternatives, key=lambda a: a["impact_score"], reverse=True)}
    return _wrap(world, "compare_plans", {"count": len(alternatives)}, result, "TOOL_RESULT",
                 f"Compared {len(alternatives)} plan(s); best impact={best['impact_score']}")


def assign_resource(world: MissionWorld, victim_id: str, vehicle_id: str, dest_kind: str, dest_id: str, road_ids: list[str], eta_min: float) -> dict:
    victim = world.victims.get(victim_id)
    vehicle = world.vehicles.get(vehicle_id)
    if not victim or not vehicle:
        return _wrap(world, "assign_resource", {"victim_id": victim_id, "vehicle_id": vehicle_id}, {"ok": False}, "TOOL_RESULT", "assignment failed: not found")
    if vehicle.status != "AVAILABLE":
        return _wrap(world, "assign_resource", {"victim_id": victim_id, "vehicle_id": vehicle_id}, {"ok": False, "reason": "vehicle unavailable"}, "TOOL_RESULT", "assignment failed: vehicle unavailable")

    vehicle.status = "ASSIGNED"
    vehicle.current_assignment = victim_id
    victim.status = "ASSIGNED"
    victim.assigned_resource = vehicle_id
    world.current_plan[victim_id] = {
        "resource_id": vehicle_id, "dest_kind": dest_kind, "dest_id": dest_id,
        "road_ids": road_ids, "eta_min": eta_min, "_start": world.mission.elapsed_min,
    }
    if dest_kind == "HOSPITAL" and dest_id in world.hospitals:
        world.hospitals[dest_id].occupancy += 1
    elif dest_kind == "SHELTER" and dest_id in world.shelters:
        world.shelters[dest_id].occupancy += 1

    result = {"ok": True, "victim_id": victim_id, "vehicle_id": vehicle_id, "dest_kind": dest_kind, "dest_id": dest_id, "eta_min": eta_min}
    return _wrap(world, "assign_resource", result, result, "ACTION", f"Assigned {vehicle_id} to {victim_id} -> {dest_kind} {dest_id}", [victim_id, vehicle_id, dest_id])


def reserve_resource(world: MissionWorld, resource_type: str, dest_id: str, count: int = 1) -> dict:
    """Reserve capacity ahead of assignment (used defensively during replanning)."""
    result = {"reserved": True, "resource_type": resource_type, "dest_id": dest_id, "count": count}
    return _wrap(world, "reserve_resource", {"resource_type": resource_type, "dest_id": dest_id}, result, "TOOL_RESULT", f"Reserved {count} slot(s) at {dest_id}")


def update_resource(world: MissionWorld, vehicle_id: str, status: str) -> dict:
    vehicle = world.vehicles.get(vehicle_id)
    if not vehicle:
        return _wrap(world, "update_resource", {"vehicle_id": vehicle_id}, {"ok": False}, "TOOL_RESULT", "resource not found")
    vehicle.status = status
    return _wrap(world, "update_resource", {"vehicle_id": vehicle_id, "status": status}, {"ok": True}, "RESOURCE", f"{vehicle_id} status -> {status}", [vehicle_id])


def simulate_action(world: MissionWorld, action: str, victim_id: str) -> dict:
    """Advance a victim through transit -> evacuated over simulated time."""
    victim = world.victims.get(victim_id)
    if not victim:
        return _wrap(world, "simulate_action", {"action": action, "victim_id": victim_id}, {"ok": False}, "TOOL_RESULT", "victim not found")
    if action == "TRANSIT":
        victim.status = "IN_TRANSIT"
    elif action == "COMPLETE":
        victim.status = "EVACUATED"
        world.metrics.victims_evacuated += 1
        if victim.severity.value == "CRITICAL":
            world.metrics.critical_evacuated += 1
        vid = victim.assigned_resource
        if vid and vid in world.vehicles:
            world.vehicles[vid].status = "AVAILABLE"
            world.vehicles[vid].current_assignment = None
    result = {"ok": True, "victim_id": victim_id, "new_status": victim.status}
    return _wrap(world, "simulate_action", {"action": action, "victim_id": victim_id}, result, "ACTION", f"{victim_id} -> {victim.status}", [victim_id])


def execute_action(world: MissionWorld, action_type: str, **kwargs) -> dict:
    """Generic dispatcher some callers use; records ACTION evidence + success/fail metrics."""
    try:
        if action_type == "ASSIGN":
            res = assign_resource(world, **kwargs)
            world.metrics.successful_actions += 1
            return res
        elif action_type == "ADVANCE":
            res = simulate_action(world, kwargs.get("action", "TRANSIT"), kwargs["victim_id"])
            world.metrics.successful_actions += 1
            return res
        else:
            world.metrics.failed_actions += 1
            return _wrap(world, "execute_action", kwargs, {"ok": False, "reason": "unknown action_type"}, "FAILURE", f"Unknown action type {action_type}")
    except Exception as e:
        world.metrics.failed_actions += 1
        return _wrap(world, "execute_action", kwargs, {"ok": False, "reason": str(e)}, "FAILURE", f"Action execution failed: {e}")


def request_human_approval(world: MissionWorld, decision_id: str, summary: str, risk_level: RiskLevel) -> dict:
    approval = Approval(id=next_id("APR"), decision_id=decision_id, summary=summary, risk_level=risk_level)
    world.approvals.append(approval)
    world.metrics.human_escalations += 1
    result = {"approval_id": approval.id, "status": approval.status}
    return _wrap(world, "request_human_approval", {"decision_id": decision_id}, result, "DECISION", f"Human approval requested: {summary}", [decision_id])


def record_evidence(world: MissionWorld, type_: str, source: str, summary: str, related: list[str] | None = None) -> dict:
    ev = world.add_evidence(type_, source, summary, related)
    return {"tool": "record_evidence", "input": {"type": type_}, "result": {"evidence_id": ev.id}, "timestamp": ev.timestamp, "evidence_id": ev.id}

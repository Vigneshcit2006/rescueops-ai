"""Serialize live MissionWorld dataclasses into JSON-ready dicts per API_CONTRACT.md."""
from __future__ import annotations

from app.models.domain import MissionWorld


def serialize_zone(z):
    return {"id": z.id, "name": z.name, "lat": z.lat, "lng": z.lng}


def serialize_victim(v):
    return {
        "id": v.id, "location": v.location, "severity": v.severity.value, "people_count": v.people_count,
        "medical_requirement": v.medical_requirement, "destination_requirement": v.destination_requirement,
        "status": v.status, "assigned_resource": v.assigned_resource,
    }


def serialize_vehicle(veh):
    return {
        "id": veh.id, "type": veh.type, "location": veh.location, "capacity": veh.capacity,
        "status": veh.status, "current_assignment": veh.current_assignment, "capabilities": veh.capabilities,
    }


def serialize_hospital(h):
    return {"id": h.id, "location": h.location, "capacity": h.capacity, "occupancy": h.occupancy, "capabilities": h.capabilities}


def serialize_shelter(s):
    return {"id": s.id, "location": s.location, "capacity": s.capacity, "occupancy": s.occupancy}


def serialize_road(r):
    return {
        "id": r.id, "source": r.source, "destination": r.destination, "distance_km": r.distance_km,
        "base_travel_min": r.base_travel_min, "status": r.status.value, "risk": r.risk,
    }


def serialize_evidence(e):
    return {"id": e.id, "type": e.type, "source": e.source, "timestamp": e.timestamp, "summary": e.summary,
            "related_entities": e.related_entities, "data": e.data}


def serialize_trace(t):
    return {"id": t.id, "timestamp": t.timestamp, "event": t.event, "detail": t.detail, "kind": t.kind}


def serialize_decision(d):
    return {
        "id": d.id, "timestamp": d.timestamp, "selected_action": d.selected_action, "reason": d.reason,
        "alternatives": [{"action": a.action, "eta_min": a.eta_min, "impact_score": a.impact_score, "reason": a.reason} for a in d.alternatives],
        "expected_impact": d.expected_impact, "risk_level": d.risk_level.value, "confidence": d.confidence,
        "mission_impact_score": d.mission_impact_score, "requires_human_approval": d.requires_human_approval,
        "evidence_ids": d.evidence_ids,
    }


def serialize_approval(a):
    return {"id": a.id, "decision_id": a.decision_id, "summary": a.summary, "risk_level": a.risk_level.value, "status": a.status}


def serialize_world(world: MissionWorld) -> dict:
    from app.simulation import scoring, goal_engine
    impact_score, impact_factors = scoring.mission_impact_score(world)
    prog = goal_engine.evaluate_progress(world)
    m = world.mission
    return {
        "mission": {
            "id": m.id, "name": m.name, "status": m.status.value, "agent_state": m.agent_state.value,
            "created_at": m.created_at, "elapsed_min": m.elapsed_min, "progress_pct": m.progress_pct,
            "estimated_completion_min": m.estimated_completion_min, "iterations": m.iterations,
            "deadline_minutes": world.goal.deadline_minutes, "mission_impact_score": impact_score,
            "mission_impact_factors": impact_factors,
            "deadline_met": prog["deadline_met"],
            "success_conditions_met": prog["success_conditions_met"],
        },
        "goal": {
            "goal_id": world.goal.goal_id, "objective": world.goal.objective, "deadline_minutes": world.goal.deadline_minutes,
            "priority": world.goal.priority, "constraints": world.goal.constraints, "success_conditions": world.goal.success_conditions,
        },
        "zones": [serialize_zone(z) for z in world.zones.values()],
        "victims": [serialize_victim(v) for v in world.victims.values()],
        "vehicles": [serialize_vehicle(v) for v in world.vehicles.values()],
        "hospitals": [serialize_hospital(h) for h in world.hospitals.values()],
        "shelters": [serialize_shelter(s) for s in world.shelters.values()],
        "roads": [serialize_road(r) for r in world.roads.values()],
        # Live plan geometry so the map can draw active routes and show them change.
        "assignments": [
            {
                "victim_id": vid, "resource_id": a.get("resource_id"), "dest_kind": a.get("dest_kind"),
                "dest_id": a.get("dest_id"), "road_ids": a.get("road_ids", []), "eta_min": a.get("eta_min"),
            }
            for vid, a in world.current_plan.items()
        ],
        "decisions": [serialize_decision(d) for d in world.decisions[-50:]],
        "evidence": [serialize_evidence(e) for e in world.evidence[-200:]],
        "trace": [serialize_trace(t) for t in world.trace[-200:]],
        "approvals": [serialize_approval(a) for a in world.approvals],
        "metrics": {
            "victims_evacuated": world.metrics.victims_evacuated, "critical_evacuated": world.metrics.critical_evacuated,
            "critical_total": sum(1 for v in world.victims.values() if v.severity.value == "CRITICAL"),
            "replans": world.metrics.replans, "failed_actions": world.metrics.failed_actions,
            "successful_actions": world.metrics.successful_actions, "route_changes": world.metrics.route_changes,
            "human_escalations": world.metrics.human_escalations,
        },
    }

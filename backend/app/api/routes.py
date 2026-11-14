from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import store, serializer
from app.simulation import environment
from app.agents import orchestrator

router = APIRouter(prefix="/api")


def _world_or_404(mission_id: str):
    world = store.get_mission(mission_id)
    if not world:
        raise HTTPException(status_code=404, detail="mission not found")
    return world


class CreateMissionBody(BaseModel):
    scenario: str = "flood_default"


@router.post("/missions")
def create_mission(body: CreateMissionBody):
    world = store.create_mission(body.scenario)
    return serializer.serialize_world(world)


@router.get("/missions/{mission_id}")
def get_mission(mission_id: str):
    world = _world_or_404(mission_id)
    return serializer.serialize_world(world)


@router.get("/missions/{mission_id}/state")
def get_mission_state(mission_id: str):
    world = _world_or_404(mission_id)
    return serializer.serialize_world(world)


@router.post("/missions/{mission_id}/start")
def start_mission(mission_id: str):
    world = _world_or_404(mission_id)
    world.mission.paused = False
    results = orchestrator.run_until_blocked(world)
    return {"steps": results, "state": serializer.serialize_world(world)}


@router.post("/missions/{mission_id}/pause")
def pause_mission(mission_id: str):
    world = _world_or_404(mission_id)
    world.mission.paused = True
    world.add_trace("MISSION PAUSED", kind="INFO")
    return serializer.serialize_world(world)


@router.post("/missions/{mission_id}/resume")
def resume_mission(mission_id: str):
    world = _world_or_404(mission_id)
    world.mission.paused = False
    world.add_trace("MISSION RESUMED", kind="INFO")
    results = orchestrator.run_until_blocked(world)
    return {"steps": results, "state": serializer.serialize_world(world)}


class MissionIdBody(BaseModel):
    mission_id: str


@router.post("/agent/step")
def agent_step(body: MissionIdBody):
    world = _world_or_404(body.mission_id)
    result = orchestrator.step(world)
    return {"result": result, "state": serializer.serialize_world(world)}


@router.post("/agent/replan")
def agent_replan(body: MissionIdBody):
    world = _world_or_404(body.mission_id)
    from app.tools import tools as T
    T.detect_plan_failure(world)  # forces re-check + evidence
    result = orchestrator.step(world)
    return {"result": result, "state": serializer.serialize_world(world)}


@router.get("/missions/{mission_id}/decisions")
def get_decisions(mission_id: str):
    world = _world_or_404(mission_id)
    return [serializer.serialize_decision(d) for d in world.decisions]


@router.get("/missions/{mission_id}/evidence")
def get_evidence(mission_id: str):
    world = _world_or_404(mission_id)
    return [serializer.serialize_evidence(e) for e in world.evidence]


@router.get("/missions/{mission_id}/trace")
def get_trace(mission_id: str):
    world = _world_or_404(mission_id)
    return [serializer.serialize_trace(t) for t in world.trace]


class SimulationEventBody(BaseModel):
    mission_id: str
    event: str
    params: dict = {}


@router.post("/simulation/events")
def simulation_event(body: SimulationEventBody):
    world = _world_or_404(body.mission_id)
    result = environment.apply_event(world, body.event, body.params)
    # Let the agent immediately observe the change.
    step_result = orchestrator.step(world)
    return {"event_result": result, "step_result": step_result, "state": serializer.serialize_world(world)}


class MissionOnlyBody(BaseModel):
    mission_id: str


@router.post("/simulation/reset")
def simulation_reset(body: MissionOnlyBody):
    world = store.reset_mission(body.mission_id)
    if not world:
        raise HTTPException(status_code=404, detail="mission not found")
    return serializer.serialize_world(world)


@router.post("/approvals/{approval_id}/approve")
def approve(approval_id: str, body: MissionOnlyBody):
    world = _world_or_404(body.mission_id)
    approval = next((a for a in world.approvals if a.id == approval_id), None)
    if not approval:
        raise HTTPException(status_code=404, detail="approval not found")
    orchestrator.execute_pending_approval(world, approve=True)
    results = orchestrator.run_until_blocked(world)
    return {"steps": results, "state": serializer.serialize_world(world)}


@router.post("/approvals/{approval_id}/reject")
def reject(approval_id: str, body: MissionOnlyBody):
    world = _world_or_404(body.mission_id)
    approval = next((a for a in world.approvals if a.id == approval_id), None)
    if not approval:
        raise HTTPException(status_code=404, detail="approval not found")
    orchestrator.execute_pending_approval(world, approve=False)
    return serializer.serialize_world(world)


@router.get("/analytics/{mission_id}")
def analytics(mission_id: str):
    world = _world_or_404(mission_id)
    from app.simulation import scoring
    score, factors = scoring.mission_impact_score(world)
    return {
        "mission_id": mission_id,
        "total_victims": len(world.victims),
        "critical_victims": sum(1 for v in world.victims.values() if v.severity.value == "CRITICAL"),
        "victims_evacuated": world.metrics.victims_evacuated,
        "critical_evacuated": world.metrics.critical_evacuated,
        "resource_utilization": round(
            sum(1 for v in world.vehicles.values() if v.status != "AVAILABLE") / max(len(world.vehicles), 1) * 100, 1
        ),
        "successful_actions": world.metrics.successful_actions,
        "failed_actions": world.metrics.failed_actions,
        "replanning_count": world.metrics.replans,
        "route_changes": world.metrics.route_changes,
        "human_escalations": world.metrics.human_escalations,
        "mission_impact_score": score,
        "mission_impact_factors": factors,
        "elapsed_min": world.mission.elapsed_min,
        "deadline_min": world.goal.deadline_minutes,
        "status": world.mission.status.value,
    }


@router.post("/demo/run")
def run_demo(body: MissionOnlyBody):
    """Scripted end-to-end demo: initial plan -> road failure -> replan -> verify."""
    world = _world_or_404(body.mission_id)
    log = []
    # Run just enough steps to produce an initial plan that depends on R12
    # (Ambulance A -> Zone A victim -> Hospital H1) while the victim is still
    # in transit, so the upcoming road block genuinely invalidates a live assignment.
    log += orchestrator.run_until_blocked(world, max_steps=1)
    log.append({"status": "INJECT_EVENT", "event": "ROAD_BLOCKED"})
    from app.simulation import environment as env
    env.apply_event(world, "ROAD_BLOCKED", {"road_id": "R12"})
    log += orchestrator.run_until_blocked(world, max_steps=40)
    return {"log": log, "state": serializer.serialize_world(world)}


@router.get("/health")
def health():
    from app.agents.llm_provider import get_model_provider
    return {"ok": True, "llm_provider": get_model_provider().name}

"""Agent behavior: adaptation, capacity constraints, prioritization, escalation."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.simulation.scenario import create_flood_scenario
from app.simulation import goal_engine, resource_engine, route_engine
from app.simulation.environment import apply_event
from app.agents import orchestrator
from app.tools import tools as T
from app.models.domain import Severity, RiskLevel


def _first_step(world):
    return orchestrator.step(world)


def test_critical_victims_are_prioritized_first():
    world = create_flood_scenario()
    _first_step(world)
    assigned = [v for v in world.victims.values() if v.status in ("ASSIGNED", "IN_TRANSIT")]
    assert assigned, "agent should dispatch on the first step"
    assert all(v.severity == Severity.CRITICAL for v in assigned), \
        "the first dispatch wave must go to CRITICAL victims"


def test_hospital_capacity_is_never_exceeded():
    world = create_flood_scenario()
    orchestrator.run_until_blocked(world, max_steps=40)
    for h in world.hospitals.values():
        assert h.occupancy <= h.capacity, f"{h.id} over capacity: {h.occupancy}/{h.capacity}"
    for s in world.shelters.values():
        assert s.occupancy <= s.capacity


def test_blocked_road_never_appears_in_a_new_route():
    world = create_flood_scenario()
    _first_step(world)
    apply_event(world, "ROAD_BLOCKED", {"road_id": "R12"})
    orchestrator.step(world)
    for victim_id, assignment in world.current_plan.items():
        assert "R12" not in assignment["road_ids"], \
            f"{victim_id} still routed over blocked R12"


def test_road_block_triggers_replan_and_recovery():
    world = create_flood_scenario()
    _first_step(world)
    plans_before = {v: dict(a) for v, a in world.current_plan.items()}
    assert any("R12" in a["road_ids"] for a in plans_before.values()), \
        "scenario should initially route someone over R12"

    apply_event(world, "ROAD_BLOCKED", {"road_id": "R12"})
    orchestrator.step(world)

    assert world.metrics.replans >= 1
    assert any(d.selected_action.startswith("Reassign") for d in world.decisions)


def test_replan_releases_the_stranded_vehicle_and_bed():
    """A broken assignment must return its vehicle and reserved bed to the pool."""
    world = create_flood_scenario()
    _first_step(world)
    victim_id = next(v for v, a in world.current_plan.items() if "R12" in a["road_ids"])
    assignment = world.current_plan[victim_id]
    hospital_id = assignment["dest_id"]
    occ_before = world.hospitals[hospital_id].occupancy if hospital_id in world.hospitals else None

    apply_event(world, "ROAD_BLOCKED", {"road_id": "R12"})
    orchestrator.step(world)

    stranded = [v for v in world.vehicles.values()
                if v.status == "ASSIGNED" and v.current_assignment not in world.current_plan]
    assert not stranded, f"vehicles stranded after replan: {[v.id for v in stranded]}"
    if occ_before is not None:
        assert world.hospitals[hospital_id].occupancy <= world.hospitals[hospital_id].capacity


def test_vehicle_failure_triggers_reassignment():
    world = create_flood_scenario()
    _first_step(world)
    busy = [v for v in world.vehicles.values() if v.status in ("ASSIGNED", "EN_ROUTE")]
    assert busy
    victim_id = busy[0].current_assignment
    apply_event(world, "VEHICLE_UNAVAILABLE", {"vehicle_id": busy[0].id})
    orchestrator.step(world)
    victim = world.victims[victim_id]
    assert victim.assigned_resource != busy[0].id or victim.status == "PENDING"


def test_new_critical_victim_is_picked_up_by_the_agent():
    world = create_flood_scenario()
    orchestrator.run_until_blocked(world, max_steps=3)
    before = len(world.victims)
    res = apply_event(world, "NEW_VICTIM", {})
    new_id = res["victim_id"]
    assert len(world.victims) == before + 1
    orchestrator.run_until_blocked(world, max_steps=20)
    assert world.victims[new_id].status != "PENDING", "agent ignored the new critical victim"


def test_high_risk_replan_requires_human_approval():
    world = create_flood_scenario()
    _first_step(world)
    apply_event(world, "ROAD_BLOCKED", {"road_id": "R12"})
    orchestrator.step(world)
    escalated = [d for d in world.decisions if d.requires_human_approval]
    assert escalated, "a critical-victim destination change should escalate to a human"
    assert world.pending_action is not None
    assert any(a.status == "PENDING" for a in world.approvals)


def test_agent_halts_until_approval_is_granted():
    world = create_flood_scenario()
    _first_step(world)
    apply_event(world, "ROAD_BLOCKED", {"road_id": "R12"})
    orchestrator.step(world)
    assert world.pending_action is not None
    blocked = orchestrator.step(world)
    assert blocked["status"] == "WAITING_APPROVAL", "agent must not act while awaiting approval"

    orchestrator.execute_pending_approval(world, approve=True)
    assert world.pending_action is None
    assert any(a.status == "APPROVED" for a in world.approvals)


def test_rejected_approval_does_not_execute_the_action():
    world = create_flood_scenario()
    _first_step(world)
    apply_event(world, "ROAD_BLOCKED", {"road_id": "R12"})
    orchestrator.step(world)
    pending = dict(world.pending_action)
    orchestrator.execute_pending_approval(world, approve=False)
    victim = world.victims[pending["victim_id"]]
    assert victim.assigned_resource != pending["vehicle_id"] or victim.status == "PENDING"
    assert any(a.status == "REJECTED" for a in world.approvals)


def test_impossible_mission_is_detected_not_faked():
    """With every vehicle disabled, the agent must report AT_RISK + escalate."""
    world = create_flood_scenario()
    for vehicle in world.vehicles.values():
        vehicle.status = "UNAVAILABLE"
    impossible, reason = goal_engine.is_mission_impossible(world)
    assert impossible is True
    assert reason and "transport" in reason.lower()

    orchestrator.step(world)
    assert world.mission.status.value in ("AT_RISK", "FAILED")
    assert world.metrics.human_escalations >= 1
    assert any(a.risk_level == RiskLevel.CRITICAL for a in world.approvals)


def test_unreachable_destinations_are_detected():
    world = create_flood_scenario()
    for road in world.roads.values():
        road.status = road.status.__class__.BLOCKED
    impossible, reason = goal_engine.is_mission_impossible(world)
    assert impossible is True
    assert "route" in reason.lower()


def test_goal_verification_tracks_critical_victims():
    world = create_flood_scenario()
    orchestrator.run_until_blocked(world, max_steps=40)
    prog = goal_engine.evaluate_progress(world)
    if prog["goal_satisfied"]:
        assert prog["critical_evacuated"] == prog["critical_total"]
        assert world.mission.status.value == "COMPLETED"
    assert "deadline_met" in prog
    assert isinstance(prog["success_conditions_met"], dict)


def test_deadline_breach_is_reported_not_hidden():
    world = create_flood_scenario()
    world.mission.elapsed_min = 999
    prog = goal_engine.evaluate_progress(world)
    assert prog["deadline_met"] is False
    assert prog["success_conditions_met"]["completed_within_deadline"] is False


def test_every_decision_carries_evidence_and_alternatives():
    world = create_flood_scenario()
    orchestrator.run_until_blocked(world, max_steps=10)
    assert world.decisions
    for d in world.decisions:
        assert d.evidence_ids, f"{d.id} has no evidence"
        assert d.alternatives, f"{d.id} has no alternatives considered"
        assert 0 <= d.confidence <= 1
        assert 0 <= d.mission_impact_score <= 100


def test_tool_results_are_structured_with_evidence():
    world = create_flood_scenario()
    result = T.get_road_status(world, "R12")
    for key in ("tool", "input", "result", "timestamp", "evidence_id"):
        assert key in result
    assert any(e.id == result["evidence_id"] for e in world.evidence)


def test_alternative_routes_are_genuinely_distinct():
    world = create_flood_scenario()
    alts = route_engine.k_alternative_routes(world, "A", "H1", k=3)
    assert len(alts) >= 2
    paths = [tuple(a["path"]) for a in alts]
    assert len(set(paths)) == len(paths), "alternatives must be distinct routes"
    etas = [a["eta_min"] for a in alts]
    assert etas == sorted(etas), "alternatives should be ranked cheapest-first"

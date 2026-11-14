"""RescueOps Orchestrator — the self-healing mission loop.

    observe -> decide -> act -> observe result -> evaluate ->
    detect failure/change -> replan -> act again -> verify goal

Deterministic engines (app/simulation/*) do all math. The LLM provider
(app/agents/llm_provider.py) is used only to produce human-readable
explanations — never to compute routes, capacity, or scores.
"""
from __future__ import annotations

from app.models.domain import (
    MissionWorld, Severity, RiskLevel, Decision, DecisionAlternative, next_id, now_iso,
    AgentState, MissionStatus,
)
from app.simulation import goal_engine, scoring, resource_engine
from app.tools import tools as T
from app.agents.llm_provider import get_model_provider

TIME_STEP_MIN = 1.5  # simulated minutes advanced per loop iteration
MAX_ITERATIONS = 60

_provider = get_model_provider()


def _severity_rank(v) -> int:
    order = {Severity.CRITICAL: 0, Severity.HIGH: 1, Severity.MEDIUM: 2, Severity.LOW: 3}
    return order[v.severity]


def _record_decision(world: MissionWorld, selected_action: str, reason: str, alternatives: list[dict],
                      expected_impact: str, risk: RiskLevel, confidence: float, impact_score: float,
                      requires_approval: bool, evidence_ids: list[str]) -> Decision:
    decision = Decision(
        id=next_id("DEC"), timestamp=now_iso(), selected_action=selected_action, reason=reason,
        alternatives=[DecisionAlternative(a.get("label", a.get("vehicle_id", "")), a.get("eta_min"), a["impact_score"], a.get("reason", "")) for a in alternatives],
        expected_impact=expected_impact, risk_level=risk, confidence=confidence,
        mission_impact_score=impact_score, requires_human_approval=requires_approval, evidence_ids=evidence_ids,
    )
    world.decisions.append(decision)
    world.add_trace(f"DECISION: {selected_action}", reason, kind="DECISION")
    return decision


def _risk_for_assignment(world: MissionWorld, victim, is_replan: bool, alt_count: int, dest_changed: bool) -> RiskLevel:
    if not is_replan:
        return RiskLevel.LOW
    if victim.severity == Severity.CRITICAL and dest_changed:
        return RiskLevel.HIGH
    if is_replan:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW


def _release_assignment(world: MissionWorld, victim_id: str) -> None:
    """Return an invalidated assignment's vehicle and destination capacity to the pool.

    Without this, a broken plan silently strands its vehicle in ASSIGNED and leaves
    the reserved hospital/shelter bed occupied, starving every later replan.
    """
    assignment = world.current_plan.get(victim_id)
    if not assignment:
        return
    resource_id = assignment.get("resource_id")
    vehicle = world.vehicles.get(resource_id) if resource_id else None
    if vehicle and vehicle.current_assignment == victim_id and vehicle.status != "UNAVAILABLE":
        vehicle.status = "AVAILABLE"
        vehicle.current_assignment = None
    dest_kind, dest_id = assignment.get("dest_kind"), assignment.get("dest_id")
    if dest_kind == "HOSPITAL" and dest_id in world.hospitals:
        world.hospitals[dest_id].occupancy = max(0, world.hospitals[dest_id].occupancy - 1)
    elif dest_kind == "SHELTER" and dest_id in world.shelters:
        world.shelters[dest_id].occupancy = max(0, world.shelters[dest_id].occupancy - 1)


def _plan_and_assign(world: MissionWorld, victim, is_replan: bool, prev_dest: str | None = None) -> Decision | None:
    gen = T.generate_alternative_plans(world, victim.id)
    alts = gen["result"]["alternatives"]
    if not alts:
        # Distinguish a transient wait (no vehicle free this tick — will retry) from a
        # genuinely infeasible mission, which is surfaced separately by is_mission_impossible().
        world.add_trace(f"Waiting to plan {victim.id}", "no resource currently available — will retry", kind="WARNING")
        return None

    cmp_res = T.compare_plans(world, alts)
    best = cmp_res["result"]["best"]
    dest_changed = is_replan and prev_dest is not None and prev_dest != best["dest_id"]

    risk = _risk_for_assignment(world, victim, is_replan, len(alts), dest_changed)
    explanation = _provider.explain_decision({
        "selected_action": f"Assign {best['vehicle_id']} to {victim.id} -> {best['dest_kind']} {best['dest_id']}",
        "alternatives": alts,
        "is_replan": is_replan,
    })

    alt_labels = []
    for a in alts:
        alt_labels.append({**a, "label": f"{a['vehicle_id']} -> {a['dest_kind']} {a['dest_id']}"})

    action_label = f"{'Reassign' if is_replan else 'Assign'} {best['vehicle_id']} to {victim.id} -> {best['dest_kind']} {best['dest_id']}"
    evidence_ids = [gen["evidence_id"], cmp_res["evidence_id"]]

    decision = _record_decision(
        world, action_label, explanation["reason"], alt_labels,
        expected_impact=f"ETA {best['eta_min']} min, risk {best['risk']}",
        risk=risk, confidence=round(min(0.99, 0.6 + best["impact_score"] / 250), 2),
        impact_score=best["impact_score"], requires_approval=(risk in (RiskLevel.HIGH, RiskLevel.CRITICAL)),
        evidence_ids=evidence_ids,
    )

    if decision.requires_human_approval:
        approval = T.request_human_approval(
            world, decision.id,
            f"{action_label}. Reason: {decision.reason}",
            risk,
        )
        world.pending_action = {  # type: ignore[attr-defined]
            "approval_id": approval["result"]["approval_id"],
            "victim_id": victim.id, "vehicle_id": best["vehicle_id"], "dest_kind": best["dest_kind"],
            "dest_id": best["dest_id"], "road_ids": best["road_ids"], "eta_min": best["eta_min"],
            "is_replan": is_replan,
        }
        world.mission.agent_state = AgentState.WAITING_APPROVAL
        world.add_trace("Human approval required", decision.reason, kind="WARNING")
        return decision

    T.assign_resource(world, victim.id, best["vehicle_id"], best["dest_kind"], best["dest_id"], best["road_ids"], best["eta_min"])
    world.metrics.successful_actions += 1
    if is_replan:
        world.metrics.route_changes += 1
    return decision


def execute_pending_approval(world: MissionWorld, approve: bool) -> dict:
    pending = getattr(world, "pending_action", None)
    if not pending:
        return {"ok": False, "reason": "no pending action"}
    approval = next((a for a in world.approvals if a.id == pending["approval_id"]), None)
    if approval:
        approval.status = "APPROVED" if approve else "REJECTED"
    if approve:
        T.assign_resource(world, pending["victim_id"], pending["vehicle_id"], pending["dest_kind"],
                           pending["dest_id"], pending["road_ids"], pending["eta_min"])
        world.metrics.successful_actions += 1
        if pending.get("is_replan"):
            world.metrics.route_changes += 1
        world.add_trace("Human approved action", f"executing plan for {pending['victim_id']}", kind="SUCCESS")
    else:
        world.add_trace("Human rejected action", f"plan for {pending['victim_id']} discarded", kind="FAILURE")
        world.metrics.failed_actions += 1
    world.pending_action = None  # type: ignore[attr-defined]
    world.mission.agent_state = AgentState.EVALUATING
    return {"ok": True}


def _advance_transit(world: MissionWorld) -> None:
    for victim in world.victims.values():
        if victim.status == "ASSIGNED":
            T.simulate_action(world, "TRANSIT", victim.id)
        elif victim.status == "IN_TRANSIT":
            assignment = world.current_plan.get(victim.id)
            eta = assignment["eta_min"] if assignment else 5.0
            if world.mission.elapsed_min - world.current_plan.get(victim.id, {}).get("_start", 0) >= max(eta * 0.5, TIME_STEP_MIN):
                T.simulate_action(world, "COMPLETE", victim.id)


def step(world: MissionWorld) -> dict:
    """Run exactly one iteration of the self-healing loop. Returns a summary dict."""
    if getattr(world, "pending_action", None):
        return {"status": "WAITING_APPROVAL", "message": "Awaiting human approval before continuing"}

    if world.mission.status == MissionStatus.COMPLETED:
        world.mission.agent_state = AgentState.COMPLETED
        return {"status": "COMPLETED"}

    world.mission.iterations += 1
    if world.mission.iterations > world.mission.max_iterations:
        world.mission.agent_state = AgentState.FAILED
        world.add_trace("Max iterations reached", "stopping to avoid infinite loop", kind="FAILURE")
        return {"status": "MAX_ITERATIONS"}

    # 1. OBSERVE
    world.mission.agent_state = AgentState.OBSERVING
    T.get_incident_state(world)
    fail_check = T.detect_plan_failure(world)
    plan_broken = not fail_check["result"]["valid"]

    decision = None
    if plan_broken:
        # 2a. DIAGNOSE + REPLAN
        world.mission.agent_state = AgentState.REPLANNING
        world.metrics.replans += 1
        analysis = _provider.analyze_failure(fail_check["result"])
        world.add_trace("Plan failure detected", analysis["summary"], kind="FAILURE")
        affected_ids = {b["victim_id"] for b in fail_check["result"]["broken_assignments"]}

        # Invalidate every broken assignment first, so no victim is left holding a
        # route over a blocked road while the agent waits on an approval below.
        prev_dests: dict[str, str | None] = {}
        for vid in affected_ids:
            victim = world.victims.get(vid)
            if not victim:
                continue
            prev_dests[vid] = world.current_plan.get(vid, {}).get("dest_id")
            _release_assignment(world, vid)
            victim.status = "PENDING"
            victim.assigned_resource = None
            world.current_plan.pop(vid, None)

        for vid in sorted(prev_dests, key=lambda v: _severity_rank(world.victims[v])):
            decision = _plan_and_assign(world, world.victims[vid], is_replan=True, prev_dest=prev_dests[vid])
            if getattr(world, "pending_action", None):
                break  # wait for human approval before continuing this tick
    else:
        # 2b. SELECT NEXT ACTION
        world.mission.agent_state = AgentState.PLANNING
        pending_victims = sorted(
            [v for v in world.victims.values() if v.status == "PENDING"],
            key=_severity_rank,
        )
        if pending_victims:
            world.mission.agent_state = AgentState.EXECUTING
            # Dispatch every currently-free resource this tick, highest severity first —
            # a coordinator commits all idle vehicles at once rather than one per minute.
            for victim in pending_victims:
                if not resource_engine.available_vehicles(world):
                    break
                result = _plan_and_assign(world, victim, is_replan=False)
                if result:
                    decision = result
                if getattr(world, "pending_action", None):
                    break

    # 3. ADVANCE SIMULATED TIME / TRANSIT
    world.mission.elapsed_min = round(world.mission.elapsed_min + TIME_STEP_MIN, 1)
    _advance_transit(world)

    # 4. EVALUATE GOAL PROGRESS
    world.mission.agent_state = AgentState.EVALUATING
    prog = goal_engine.evaluate_progress(world)
    world.mission.progress_pct = prog["progress_pct"]
    world.mission.estimated_completion_min = prog["estimated_completion_min"]
    world.mission.status = prog["status"]

    impossible, reason = goal_engine.is_mission_impossible(world)
    if impossible:
        world.mission.status = MissionStatus.AT_RISK
        world.add_trace("MISSION AT RISK", reason, kind="FAILURE")
        approval = T.request_human_approval(world, "IMPOSSIBLE", f"Mission at risk: {reason}. Recommend requesting additional resources.", RiskLevel.CRITICAL)
        world.mission.agent_state = AgentState.WAITING_APPROVAL

    if prog["goal_satisfied"]:
        world.mission.status = MissionStatus.COMPLETED
        world.mission.agent_state = AgentState.COMPLETED
        remaining = prog["remaining_non_critical"]
        tail = f" {remaining} non-critical victim group(s) still pending." if remaining else ""
        if prog["deadline_met"]:
            world.add_trace("GOAL VERIFIED", f"All {prog['critical_total']} critical victim groups evacuated in "
                                             f"{world.mission.elapsed_min} min (deadline {prog['deadline_minutes']} min).{tail}",
                            kind="SUCCESS")
        else:
            world.add_trace("GOAL MET — DEADLINE EXCEEDED",
                            f"All critical victims evacuated, but at {world.mission.elapsed_min} min the "
                            f"{prog['deadline_minutes']}-minute deadline was exceeded.{tail}", kind="WARNING")

    return {
        "status": "STEP_COMPLETE",
        "plan_broken": plan_broken,
        "decision_id": decision.id if decision else None,
        "agent_state": world.mission.agent_state.value,
        "mission_status": world.mission.status.value,
        "progress_pct": world.mission.progress_pct,
    }


def run_until_blocked(world: MissionWorld, max_steps: int = 40) -> list[dict]:
    results = []
    for _ in range(max_steps):
        result = step(world)
        results.append(result)
        if result["status"] in ("COMPLETED", "MAX_ITERATIONS", "WAITING_APPROVAL"):
            break
        if world.mission.status in (MissionStatus.COMPLETED,):
            break
    return results

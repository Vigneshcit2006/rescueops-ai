"""Goal progress evaluation (deterministic)."""
from __future__ import annotations

from app.models.domain import MissionWorld, MissionStatus, Severity
from app.simulation.route_engine import calculate_eta


def evaluate_progress(world: MissionWorld) -> dict:
    victims = list(world.victims.values())
    total = len(victims)
    evacuated = [v for v in victims if v.status == "EVACUATED"]
    critical = [v for v in victims if v.severity == Severity.CRITICAL]
    critical_evac = [v for v in critical if v.status == "EVACUATED"]
    pending = [v for v in victims if v.status == "PENDING"]

    progress_pct = (len(evacuated) / total * 100) if total else 100.0

    # Estimate remaining completion time: max ETA among unresolved assignments/pending victims
    remaining_etas = []
    for v in victims:
        if v.status == "EVACUATED":
            continue
        assignment = world.current_plan.get(v.id)
        if assignment and assignment.get("eta_min") is not None:
            remaining_etas.append(assignment["eta_min"])
        else:
            remaining_etas.append(8.0)  # unassigned victim heuristic estimate
    est_completion = max(remaining_etas) + world.mission.elapsed_min if remaining_etas else world.mission.elapsed_min

    deadline = world.goal.deadline_minutes
    all_critical_assigned = all(v.status != "PENDING" for v in critical)
    unresolved_critical = [v for v in critical if v.status not in ("EVACUATED",)]

    # The mission goal is defined over CRITICAL victims ("evacuate all critical
    # victims within N minutes"), so goal verification tracks those. Lower-severity
    # victims are reported separately and are not treated as goal failures.
    goal_satisfied = len(critical) > 0 and len(critical_evac) == len(critical)

    if goal_satisfied:
        status = MissionStatus.COMPLETED
    elif est_completion > deadline and unresolved_critical:
        status = MissionStatus.AT_RISK if est_completion <= deadline * 1.5 else MissionStatus.FAILED
    elif est_completion > deadline:
        status = MissionStatus.AT_RISK
    else:
        status = MissionStatus.ON_TRACK

    deadline_met = world.mission.elapsed_min <= deadline
    return {
        "progress_pct": round(progress_pct, 1),
        "estimated_completion_min": round(est_completion, 1),
        "status": status,
        "total_victims": total,
        "evacuated": len(evacuated),
        "critical_total": len(critical),
        "critical_evacuated": len(critical_evac),
        "pending": len(pending),
        "goal_satisfied": goal_satisfied,
        "all_victims_evacuated": len(evacuated) == total and total > 0,
        "remaining_non_critical": len([v for v in victims if v.severity != Severity.CRITICAL and v.status != "EVACUATED"]),
        "deadline_met": deadline_met,
        "deadline_minutes": deadline,
        "all_critical_assigned": all_critical_assigned,
        # Success conditions are reported individually so the UI never claims a
        # clean success for a run that finished past its deadline.
        "success_conditions_met": {
            "all_critical_victims_assigned": all_critical_assigned,
            "safe_destination_available": all(
                world.current_plan.get(v.id, {}).get("dest_id") is not None
                for v in critical if v.status not in ("PENDING", "EVACUATED")
            ),
            "completed_within_deadline": deadline_met,
        },
    }


def is_mission_impossible(world: MissionWorld) -> tuple[bool, str] | tuple[bool, None]:
    """Detects structurally infeasible missions (e.g. no transport capacity)."""
    critical_pending = [v for v in world.victims.values() if v.severity == Severity.CRITICAL and v.status == "PENDING"]
    if not critical_pending:
        return False, None
    from app.simulation.resource_engine import available_vehicles
    if not available_vehicles(world):
        # check nothing en route either that could free up soon; simple heuristic
        any_active = any(v.status in ("ASSIGNED", "EN_ROUTE") for v in world.vehicles.values())
        if not any_active:
            return True, "No available or active transport capacity remains for critical victims."
    unreachable = 0
    for v in critical_pending:
        reachable = False
        for h in world.hospitals.values():
            if calculate_eta(world, v.location, h.location) is not None:
                reachable = True
                break
        if not reachable:
            for s in world.shelters.values():
                if calculate_eta(world, v.location, s.location) is not None:
                    reachable = True
                    break
        if not reachable:
            unreachable += 1
    if unreachable == len(critical_pending) and critical_pending:
        return True, "No feasible route exists from critical victim locations to any hospital or shelter."
    return False, None

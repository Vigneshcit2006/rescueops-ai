"""Transparent 'Simulation Decision Score' (Mission Impact Score).

NOT a scientifically validated emergency metric — a deterministic,
explainable heuristic used to compare candidate actions/plans.
"""
from __future__ import annotations

from app.models.domain import MissionWorld, Severity

SEVERITY_WEIGHT = {
    Severity.CRITICAL: 40,
    Severity.HIGH: 25,
    Severity.MEDIUM: 12,
    Severity.LOW: 5,
}


def score_route_option(world: MissionWorld, eta_min: float, risk: float, severity: Severity, deadline_min: float, elapsed_min: float) -> tuple[float, dict]:
    """Score a single victim-assignment route option in [0,100]."""
    factors = {}

    remaining = max(deadline_min - elapsed_min, 0.1)
    time_score = max(0.0, 100 * (1 - eta_min / max(remaining, eta_min, 1)))
    factors["deadline_compliance"] = round(time_score, 1)

    urgency = SEVERITY_WEIGHT[severity] / SEVERITY_WEIGHT[Severity.CRITICAL] * 100
    factors["victim_priority"] = round(urgency, 1)

    risk_score = max(0.0, 100 * (1 - risk))
    factors["risk"] = round(risk_score, 1)

    speed_score = max(0.0, 100 - eta_min * 3)
    factors["response_time"] = round(speed_score, 1)

    weighted = (
        factors["deadline_compliance"] * 0.30
        + factors["victim_priority"] * 0.30
        + factors["risk"] * 0.20
        + factors["response_time"] * 0.20
    )
    return round(weighted, 1), factors


def mission_impact_score(world: MissionWorld) -> tuple[float, dict]:
    """Overall mission health score from current world state."""
    total_victims = len(world.victims) or 1
    evacuated = sum(1 for v in world.victims.values() if v.status == "EVACUATED")
    critical_total = sum(1 for v in world.victims.values() if v.severity == Severity.CRITICAL) or 1
    critical_evac = sum(1 for v in world.victims.values() if v.severity == Severity.CRITICAL and v.status == "EVACUATED")

    progress = evacuated / total_victims * 100
    critical_progress = critical_evac / critical_total * 100

    deadline = world.goal.deadline_minutes
    elapsed = world.mission.elapsed_min
    time_health = max(0.0, 100 * (1 - elapsed / max(deadline, 1))) if evacuated < total_victims else 100.0

    blocked_roads = sum(1 for r in world.roads.values() if r.status.value == "BLOCKED")
    infra_penalty = max(0, 100 - blocked_roads * 10)

    failed = world.metrics.failed_actions
    successful = max(world.metrics.successful_actions, 1)
    reliability = max(0.0, 100 * (1 - failed / (failed + successful)))

    factors = {
        "overall_progress": round(progress, 1),
        "critical_priority_progress": round(critical_progress, 1),
        "time_health": round(time_health, 1),
        "infrastructure_health": round(infra_penalty, 1),
        "execution_reliability": round(reliability, 1),
    }
    score = (
        factors["overall_progress"] * 0.25
        + factors["critical_priority_progress"] * 0.35
        + factors["time_health"] * 0.20
        + factors["infrastructure_health"] * 0.10
        + factors["execution_reliability"] * 0.10
    )
    return round(score, 1), factors

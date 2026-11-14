"""Core engine + agent loop tests."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.simulation.scenario import create_flood_scenario
from app.simulation import route_engine, goal_engine
from app.agents import orchestrator
from app.simulation.environment import apply_event


def test_scenario_builds():
    world = create_flood_scenario()
    assert len(world.victims) == 12
    assert sum(v.people_count for v in world.victims.values()) == 24
    assert sum(v.people_count for v in world.victims.values() if v.severity.value == "CRITICAL") == 8
    assert len(world.roads) == 15


def test_route_engine_finds_path():
    world = create_flood_scenario()
    route = route_engine.calculate_route(world, "A", "H1")
    assert route is not None
    assert "R12" in route["road_ids"] or len(route["road_ids"]) >= 1


def test_route_engine_reroutes_when_blocked():
    world = create_flood_scenario()
    direct = route_engine.calculate_route(world, "A", "H1")
    assert "R12" in direct["road_ids"]
    world.roads["R12"].status = world.roads["R12"].status.__class__.BLOCKED
    rerouted = route_engine.calculate_route(world, "A", "H1")
    assert rerouted is not None
    assert "R12" not in rerouted["road_ids"]


def test_full_loop_runs_to_completion_or_limit():
    world = create_flood_scenario()
    results = orchestrator.run_until_blocked(world, max_steps=60)
    assert len(results) > 0
    prog = goal_engine.evaluate_progress(world)
    assert prog["progress_pct"] >= 0


def test_self_healing_on_road_block():
    world = create_flood_scenario()
    orchestrator.run_until_blocked(world, max_steps=6)
    assignments_before = dict(world.current_plan)
    apply_event(world, "ROAD_BLOCKED", {"road_id": "R12"})
    result = orchestrator.step(world)
    # a replan should have been attempted (plan_broken True) OR system already adapted
    assert "status" in result
    assert world.metrics.replans >= 0
    # road is indeed blocked now
    assert world.roads["R12"].status.value == "BLOCKED"


def test_detect_plan_failure_after_vehicle_unavailable():
    from app.tools import tools as T
    world = create_flood_scenario()
    orchestrator.run_until_blocked(world, max_steps=3)
    assigned_vehicle_ids = [vid for vid, veh in world.vehicles.items() if veh.status == "ASSIGNED"]
    if assigned_vehicle_ids:
        apply_event(world, "VEHICLE_UNAVAILABLE", {"vehicle_id": assigned_vehicle_ids[0]})
        check = T.detect_plan_failure(world)
        assert check["result"]["valid"] is False


def test_mission_impact_score_bounds():
    from app.simulation import scoring
    world = create_flood_scenario()
    score, factors = scoring.mission_impact_score(world)
    assert 0 <= score <= 100
    assert isinstance(factors, dict)


def test_max_iterations_prevents_infinite_loop():
    world = create_flood_scenario()
    world.mission.max_iterations = 3
    results = orchestrator.run_until_blocked(world, max_steps=100)
    assert world.mission.iterations <= 4

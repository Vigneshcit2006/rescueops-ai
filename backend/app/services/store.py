"""In-process mission registry. A hackathon-scale single-worker store —
good enough for a live demo; swap for Redis/DB-backed state to scale out."""
from __future__ import annotations

from app.models.domain import MissionWorld
from app.simulation.scenario import create_flood_scenario

_MISSIONS: dict[str, MissionWorld] = {}


def create_mission(scenario: str = "flood_default") -> MissionWorld:
    world = create_flood_scenario()
    world.add_trace("MISSION CREATED", world.goal.objective, kind="INFO")
    world.add_evidence("INCIDENT", "system", f"Mission {world.mission.id} created from scenario '{scenario}'", [world.mission.id])
    _MISSIONS[world.mission.id] = world
    return world


def get_mission(mission_id: str) -> MissionWorld | None:
    return _MISSIONS.get(mission_id)


def reset_mission(mission_id: str) -> MissionWorld | None:
    if mission_id not in _MISSIONS:
        return None
    world = create_flood_scenario()
    world.mission.id = mission_id
    world.add_trace("MISSION RESET", "simulation state reinitialized", kind="INFO")
    _MISSIONS[mission_id] = world
    return world


def all_missions() -> list[MissionWorld]:
    return list(_MISSIONS.values())

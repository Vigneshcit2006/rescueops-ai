"""Resource allocation and capacity constraint checks (deterministic)."""
from __future__ import annotations

from app.models.domain import MissionWorld, Vehicle, Hospital, Shelter


def available_vehicles(world: MissionWorld, vtype: str | None = None) -> list[Vehicle]:
    return [
        v for v in world.vehicles.values()
        if v.status == "AVAILABLE" and (vtype is None or v.type == vtype)
    ]


def nearest_available_vehicle(world: MissionWorld, at_zone: str, vtype: str | None = None) -> Vehicle | None:
    from app.simulation.route_engine import calculate_eta
    candidates = available_vehicles(world, vtype)
    best, best_eta = None, float("inf")
    for v in candidates:
        eta = calculate_eta(world, v.location, at_zone)
        if eta is None:
            continue
        if eta < best_eta:
            best, best_eta = v, eta
    return best


def hospital_has_capacity(hospital: Hospital, additional: int = 1) -> bool:
    return hospital.occupancy + additional <= hospital.capacity


def shelter_has_capacity(shelter: Shelter, additional: int = 1) -> bool:
    return shelter.occupancy + additional <= shelter.capacity


def best_destination(world: MissionWorld, need_hospital: bool, from_zone: str, capability: str | None = None) -> tuple[str, str] | None:
    """Returns (kind, id) of best feasible destination with capacity, closest first."""
    from app.simulation.route_engine import calculate_eta
    if need_hospital:
        pool = [
            h for h in world.hospitals.values()
            if hospital_has_capacity(h) and (capability is None or capability in h.capabilities)
        ]
        key = lambda h: (calculate_eta(world, from_zone, h.location) or 1e9)
        pool.sort(key=key)
        if pool:
            return ("HOSPITAL", pool[0].id)
        return None
    pool = [s for s in world.shelters.values() if shelter_has_capacity(s)]
    key = lambda s: (calculate_eta(world, from_zone, s.location) or 1e9)
    pool.sort(key=key)
    if pool:
        return ("SHELTER", pool[0].id)
    return None

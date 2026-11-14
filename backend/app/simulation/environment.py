"""Environment simulator: injects unexpected events into a running mission."""
from __future__ import annotations

from app.models.domain import MissionWorld, RoadStatus, Severity, next_id


def inject_road_blocked(world: MissionWorld, road_id: str | None = None, **_ignored) -> dict:
    road = None
    if road_id and road_id in world.roads:
        road = world.roads[road_id]
    else:
        # default to the primary demo road if present, else first open road
        road = world.roads.get("R12") or next((r for r in world.roads.values() if r.status == RoadStatus.OPEN), None)
    if road is None:
        return {"ok": False, "reason": "no road available to block"}
    road.status = RoadStatus.BLOCKED
    world.add_evidence("ROAD", "environment_simulator", f"Road {road.id} ({road.source}->{road.destination}) is now BLOCKED", [road.id])
    world.add_trace(f"WARNING: Road {road.id} blocked", f"{road.source} -> {road.destination}", kind="WARNING")
    return {"ok": True, "road_id": road.id}


def inject_vehicle_unavailable(world: MissionWorld, vehicle_id: str | None = None, **_ignored) -> dict:
    vehicle = None
    if vehicle_id and vehicle_id in world.vehicles:
        vehicle = world.vehicles[vehicle_id]
    else:
        vehicle = next((v for v in world.vehicles.values() if v.status in ("AVAILABLE", "ASSIGNED", "EN_ROUTE")), None)
    if vehicle is None:
        return {"ok": False, "reason": "no vehicle available to disable"}
    prev_assignment = vehicle.current_assignment
    vehicle.status = "UNAVAILABLE"
    vehicle.current_assignment = None
    world.add_evidence("RESOURCE", "environment_simulator", f"Vehicle {vehicle.id} became UNAVAILABLE", [vehicle.id])
    world.add_trace(f"WARNING: Vehicle {vehicle.id} unavailable", f"was serving {prev_assignment}", kind="WARNING")
    return {"ok": True, "vehicle_id": vehicle.id, "displaced_victim": prev_assignment}


def inject_hospital_full(world: MissionWorld, hospital_id: str | None = None, **_ignored) -> dict:
    hospital = None
    if hospital_id and hospital_id in world.hospitals:
        hospital = world.hospitals[hospital_id]
    else:
        hospital = next(iter(world.hospitals.values()), None)
    if hospital is None:
        return {"ok": False, "reason": "no hospital found"}
    hospital.occupancy = hospital.capacity
    world.add_evidence("HOSPITAL", "environment_simulator", f"Hospital {hospital.id} reached full capacity", [hospital.id])
    world.add_trace(f"WARNING: Hospital {hospital.id} at capacity", "no further admissions possible", kind="WARNING")
    return {"ok": True, "hospital_id": hospital.id}


def inject_new_critical_victim(world: MissionWorld, zone: str | None = None, **_ignored) -> dict:
    zone_id = zone if zone in world.zones else next(iter([z for z in world.zones if z not in ("H1", "H2", "S1", "S2")]), "A")
    vid = next_id("V")
    from app.models.domain import Victim
    v = Victim(id=vid, location=zone_id, severity=Severity.CRITICAL, people_count=1, medical_requirement="trauma", destination_requirement="HOSPITAL")
    world.victims[vid] = v
    world.add_evidence("VICTIM", "environment_simulator", f"New CRITICAL victim {vid} reported at {zone_id}", [vid])
    world.add_trace(f"WARNING: New critical victim {vid}", f"location {zone_id}", kind="WARNING")
    return {"ok": True, "victim_id": vid, "zone": zone_id}


EVENT_HANDLERS = {
    "ROAD_BLOCKED": inject_road_blocked,
    "VEHICLE_UNAVAILABLE": inject_vehicle_unavailable,
    "HOSPITAL_FULL": inject_hospital_full,
    "NEW_VICTIM": inject_new_critical_victim,
}


def apply_event(world: MissionWorld, event: str, params: dict | None = None) -> dict:
    handler = EVENT_HANDLERS.get(event)
    if not handler:
        return {"ok": False, "reason": f"unknown event {event}"}
    params = params or {}
    return handler(world, **params)

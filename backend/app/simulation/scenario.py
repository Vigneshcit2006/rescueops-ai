"""Default demo scenario: flood emergency across Zones A/B/C."""
from __future__ import annotations

from app.models.domain import (
    MissionWorld, Mission, MissionGoal, Zone, Victim, Vehicle, Hospital, Shelter, Road,
    Severity, RoadStatus, next_id,
)

# Roughly centered near Bhubaneswar for a plausible map demo.
ZONES = [
    Zone("A", "Zone A", 20.3100, 85.8000),
    Zone("B", "Zone B", 20.2950, 85.8300),
    Zone("C", "Zone C", 20.2750, 85.8100),
    Zone("H1", "Hospital H1", 20.3050, 85.8450),
    Zone("H2", "Hospital H2", 20.2650, 85.8350),
    Zone("S1", "Shelter S1", 20.2850, 85.7900),
    Zone("S2", "Shelter S2", 20.2600, 85.8000),
]

ROADS = [
    ("R1", "A", "B", 4.0, 6),
    ("R2", "B", "C", 3.5, 5),
    ("R3", "A", "S1", 5.0, 7),
    ("R4", "B", "S1", 4.5, 6),
    ("R5", "C", "S1", 3.0, 5),
    ("R6", "B", "S2", 6.0, 8),
    ("R7", "C", "S2", 4.0, 6),
    ("R8", "A", "C", 7.0, 10),
    ("R9", "B", "H2", 3.5, 5),
    ("R10", "C", "H2", 2.5, 4),
    ("R11", "A", "B", 5.5, 8),   # secondary A-B connector (slightly slower)
    ("R12", "A", "H1", 3.0, 5),  # primary route for Ambulance A -> H1 (gets blocked in demo)
    ("R13", "B", "H1", 3.8, 6),
    ("R14", "C", "H1", 6.5, 9),
    ("R15", "A", "S2", 8.0, 11),
]


def create_flood_scenario() -> MissionWorld:
    zones = {z.id: z for z in ZONES}
    roads = {
        rid: Road(id=rid, source=s, destination=d, distance_km=dist, base_travel_min=t, status=RoadStatus.OPEN, risk=0.1)
        for rid, s, d, dist, t in ROADS
    }

    victims_spec = [
        ("A", Severity.CRITICAL, 2, "trauma"),
        ("A", Severity.CRITICAL, 1, "respiratory"),
        ("A", Severity.HIGH, 3, "general"),
        ("A", Severity.MEDIUM, 2, "general"),
        ("B", Severity.CRITICAL, 2, "trauma"),
        ("B", Severity.CRITICAL, 1, "cardiac"),
        ("B", Severity.HIGH, 2, "general"),
        ("B", Severity.MEDIUM, 3, "general"),
        ("C", Severity.CRITICAL, 1, "trauma"),
        ("C", Severity.CRITICAL, 1, "respiratory"),
        ("C", Severity.HIGH, 2, "general"),
        ("C", Severity.LOW, 4, "general"),
    ]
    victims = {}
    for zone, sev, count, med in victims_spec:
        vid = next_id("V")
        dest_req = "HOSPITAL" if sev in (Severity.CRITICAL, Severity.HIGH) else "SHELTER"
        victims[vid] = Victim(
            id=vid, location=zone, severity=sev, people_count=count,
            medical_requirement=med, destination_requirement=dest_req,
        )

    vehicles = {
        "AMB-A": Vehicle(id="AMB-A", type="AMBULANCE", location="A", capacity=2, capabilities=["trauma", "respiratory", "cardiac"]),
        "AMB-B": Vehicle(id="AMB-B", type="AMBULANCE", location="B", capacity=2, capabilities=["trauma", "respiratory", "cardiac"]),
        "RESCUE-1": Vehicle(id="RESCUE-1", type="RESCUE_TEAM", location="B", capacity=4, capabilities=["general", "trauma"]),
        "MED-1": Vehicle(id="MED-1", type="MEDICAL_TEAM", location="C", capacity=3, capabilities=["general", "cardiac"]),
    }

    hospitals = {
        "H1": Hospital(id="H1", location="H1", capacity=10, occupancy=6, capabilities=["TRAUMA", "CRITICAL_CARE", "RESPIRATORY", "CARDIAC"]),
        "H2": Hospital(id="H2", location="H2", capacity=12, occupancy=3, capabilities=["GENERAL", "CRITICAL_CARE", "TRAUMA", "CARDIAC"]),
    }
    shelters = {
        "S1": Shelter(id="S1", location="S1", capacity=20, occupancy=5),
        "S2": Shelter(id="S2", location="S2", capacity=15, occupancy=2),
    }

    goal = MissionGoal(
        goal_id="MISSION-001",
        objective="Evacuate all critical victims within 20 minutes while minimizing response time and avoiding unsafe routes",
        deadline_minutes=20,
        priority="CRITICAL",
        constraints=["avoid blocked roads", "respect vehicle capacity", "respect hospital capacity"],
        success_conditions=["all critical victims assigned", "safe destination available", "estimated completion <= deadline"],
    )

    mission = Mission(id=next_id("MISSION"), name="Flood Response — Zones A/B/C")

    return MissionWorld(
        mission=mission, goal=goal, zones=zones, victims=victims, vehicles=vehicles,
        hospitals=hospitals, shelters=shelters, roads=roads,
    )

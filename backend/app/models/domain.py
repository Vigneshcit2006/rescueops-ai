"""Core domain models for RescueOps AI.

These are plain dataclasses used as the live, mutable simulation state.
Pydantic schemas in app/schemas mirror these for API (de)serialization.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
import itertools

_counter = itertools.count(1)


def next_id(prefix: str) -> str:
    return f"{prefix}-{next(_counter):04d}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RoadStatus(str, Enum):
    OPEN = "OPEN"
    CONGESTED = "CONGESTED"
    BLOCKED = "BLOCKED"


class MissionStatus(str, Enum):
    PLANNING = "PLANNING"
    ON_TRACK = "ON_TRACK"
    AT_RISK = "AT_RISK"
    FAILED = "FAILED"
    COMPLETED = "COMPLETED"


class AgentState(str, Enum):
    IDLE = "IDLE"
    OBSERVING = "OBSERVING"
    PLANNING = "PLANNING"
    EXECUTING = "EXECUTING"
    EVALUATING = "EVALUATING"
    REPLANNING = "REPLANNING"
    WAITING_APPROVAL = "WAITING_APPROVAL"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


@dataclass
class Zone:
    id: str
    name: str
    lat: float
    lng: float


@dataclass
class Victim:
    id: str
    location: str  # zone id
    severity: Severity
    people_count: int
    medical_requirement: str
    destination_requirement: str  # HOSPITAL | SHELTER
    status: str = "PENDING"  # PENDING, ASSIGNED, IN_TRANSIT, EVACUATED
    assigned_resource: Optional[str] = None


@dataclass
class Vehicle:
    id: str
    type: str  # AMBULANCE, RESCUE_TEAM, MEDICAL_TEAM, TRANSPORT
    location: str  # zone id
    capacity: int
    status: str = "AVAILABLE"  # AVAILABLE, ASSIGNED, EN_ROUTE, UNAVAILABLE
    current_assignment: Optional[str] = None
    capabilities: list[str] = field(default_factory=list)


@dataclass
class Hospital:
    id: str
    location: str
    capacity: int
    occupancy: int = 0
    capabilities: list[str] = field(default_factory=list)


@dataclass
class Shelter:
    id: str
    location: str
    capacity: int
    occupancy: int = 0


@dataclass
class Road:
    id: str
    source: str
    destination: str
    distance_km: float
    base_travel_min: float
    status: RoadStatus = RoadStatus.OPEN
    risk: float = 0.1


@dataclass
class Evidence:
    id: str
    type: str
    source: str
    timestamp: str
    summary: str
    related_entities: list[str] = field(default_factory=list)
    data: dict = field(default_factory=dict)


@dataclass
class TraceEvent:
    id: str
    timestamp: str
    event: str
    detail: str = ""
    kind: str = "INFO"  # INFO, WARNING, DECISION, FAILURE, SUCCESS


@dataclass
class DecisionAlternative:
    action: str
    eta_min: Optional[float]
    impact_score: float
    reason: str = ""


@dataclass
class Decision:
    id: str
    timestamp: str
    selected_action: str
    reason: str
    alternatives: list[DecisionAlternative]
    expected_impact: str
    risk_level: RiskLevel
    confidence: float
    mission_impact_score: float
    requires_human_approval: bool
    evidence_ids: list[str] = field(default_factory=list)


@dataclass
class Approval:
    id: str
    decision_id: str
    summary: str
    risk_level: RiskLevel
    status: str = "PENDING"  # PENDING, APPROVED, REJECTED


@dataclass
class MissionGoal:
    goal_id: str
    objective: str
    deadline_minutes: int
    priority: str
    constraints: list[str]
    success_conditions: list[str]


@dataclass
class Metrics:
    victims_evacuated: int = 0
    critical_evacuated: int = 0
    critical_total: int = 0
    replans: int = 0
    failed_actions: int = 0
    successful_actions: int = 0
    route_changes: int = 0
    human_escalations: int = 0


@dataclass
class Mission:
    id: str
    name: str
    status: MissionStatus = MissionStatus.PLANNING
    agent_state: AgentState = AgentState.IDLE
    created_at: str = field(default_factory=now_iso)
    started_at: Optional[str] = None
    elapsed_min: float = 0.0
    progress_pct: float = 0.0
    estimated_completion_min: Optional[float] = None
    iterations: int = 0
    max_iterations: int = 60
    paused: bool = False


@dataclass
class MissionWorld:
    """The entire live simulation state for one mission."""
    mission: Mission
    goal: MissionGoal
    zones: dict[str, Zone]
    victims: dict[str, Victim]
    vehicles: dict[str, Vehicle]
    hospitals: dict[str, Hospital]
    shelters: dict[str, Shelter]
    roads: dict[str, Road]
    evidence: list[Evidence] = field(default_factory=list)
    trace: list[TraceEvent] = field(default_factory=list)
    decisions: list[Decision] = field(default_factory=list)
    approvals: list[Approval] = field(default_factory=list)
    metrics: Metrics = field(default_factory=Metrics)
    current_plan: dict = field(default_factory=dict)  # victim_id -> {resource_id, route, hospital/shelter}
    pending_events: list[dict] = field(default_factory=list)
    pending_action: Optional[dict] = None  # action awaiting human approval

    def add_evidence(self, type_: str, source: str, summary: str, related: list[str] | None = None, data: dict | None = None) -> Evidence:
        ev = Evidence(
            id=next_id("EV"), type=type_, source=source, timestamp=now_iso(),
            summary=summary, related_entities=related or [], data=data or {},
        )
        self.evidence.append(ev)
        return ev

    def add_trace(self, event: str, detail: str = "", kind: str = "INFO") -> TraceEvent:
        te = TraceEvent(id=next_id("TR"), timestamp=now_iso(), event=event, detail=detail, kind=kind)
        self.trace.append(te)
        return te

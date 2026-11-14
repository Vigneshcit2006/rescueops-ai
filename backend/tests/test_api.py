"""API contract tests using FastAPI's TestClient (no running server needed)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture
def mission_id():
    r = client.post("/api/missions", json={"scenario": "flood_default"})
    assert r.status_code == 200
    return r.json()["mission"]["id"]


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert r.json()["llm_provider"] in ("local-fallback", "anthropic")


def test_create_mission_returns_full_state(mission_id):
    r = client.get(f"/api/missions/{mission_id}")
    body = r.json()
    for key in ("mission", "goal", "zones", "victims", "vehicles", "hospitals",
                "shelters", "roads", "decisions", "evidence", "trace", "approvals", "metrics"):
        assert key in body, f"missing {key} in mission state"
    assert body["goal"]["deadline_minutes"] == 20
    assert len(body["victims"]) == 12
    assert len(body["roads"]) == 15


def test_unknown_mission_returns_404():
    r = client.get("/api/missions/NOPE-9999")
    assert r.status_code == 404


def test_invalid_body_is_rejected():
    r = client.post("/api/agent/step", json={})
    assert r.status_code == 422


def test_unknown_simulation_event_is_handled(mission_id):
    r = client.post("/api/simulation/events",
                    json={"mission_id": mission_id, "event": "NOT_A_REAL_EVENT"})
    assert r.status_code == 200
    assert r.json()["event_result"]["ok"] is False


def test_agent_step_makes_a_decision(mission_id):
    r = client.post("/api/agent/step", json={"mission_id": mission_id})
    assert r.status_code == 200
    state = r.json()["state"]
    assert len(state["decisions"]) >= 1
    assert state["mission"]["agent_state"] in (
        "OBSERVING", "PLANNING", "EXECUTING", "EVALUATING", "REPLANNING",
        "WAITING_APPROVAL", "COMPLETED", "FAILED",
    )


def test_road_block_event_changes_state_and_triggers_replan(mission_id):
    client.post("/api/agent/step", json={"mission_id": mission_id})
    r = client.post("/api/simulation/events",
                    json={"mission_id": mission_id, "event": "ROAD_BLOCKED", "params": {"road_id": "R12"}})
    state = r.json()["state"]
    r12 = next(rd for rd in state["roads"] if rd["id"] == "R12")
    assert r12["status"] == "BLOCKED"
    assert state["metrics"]["replans"] >= 1


def test_approval_flow(mission_id):
    client.post("/api/agent/step", json={"mission_id": mission_id})
    r = client.post("/api/simulation/events",
                    json={"mission_id": mission_id, "event": "ROAD_BLOCKED", "params": {"road_id": "R12"}})
    state = r.json()["state"]
    pending = [a for a in state["approvals"] if a["status"] == "PENDING"]
    assert pending, "high-risk replan should escalate"
    aid = pending[0]["id"]
    r = client.post(f"/api/approvals/{aid}/approve", json={"mission_id": mission_id})
    assert r.status_code == 200
    approvals = r.json()["state"]["approvals"]
    assert any(a["id"] == aid and a["status"] == "APPROVED" for a in approvals)


def test_approval_reject_flow(mission_id):
    client.post("/api/agent/step", json={"mission_id": mission_id})
    r = client.post("/api/simulation/events",
                    json={"mission_id": mission_id, "event": "ROAD_BLOCKED", "params": {"road_id": "R12"}})
    pending = [a for a in r.json()["state"]["approvals"] if a["status"] == "PENDING"]
    aid = pending[0]["id"]
    r = client.post(f"/api/approvals/{aid}/reject", json={"mission_id": mission_id})
    assert r.status_code == 200
    assert any(a["id"] == aid and a["status"] == "REJECTED" for a in r.json()["approvals"])


def test_unknown_approval_returns_404(mission_id):
    r = client.post("/api/approvals/APR-DOESNOTEXIST/approve", json={"mission_id": mission_id})
    assert r.status_code == 404


def test_reset_restores_initial_state(mission_id):
    client.post(f"/api/missions/{mission_id}/start")
    r = client.post("/api/simulation/reset", json={"mission_id": mission_id})
    state = r.json()
    assert state["mission"]["progress_pct"] == 0
    assert state["metrics"]["victims_evacuated"] == 0
    assert all(rd["status"] == "OPEN" for rd in state["roads"])


def test_analytics_uses_real_simulation_numbers(mission_id):
    client.post(f"/api/missions/{mission_id}/start")
    r = client.get(f"/api/analytics/{mission_id}")
    body = r.json()
    assert body["total_victims"] == 12
    assert body["victims_evacuated"] >= 0
    assert 0 <= body["mission_impact_score"] <= 100
    assert 0 <= body["resource_utilization"] <= 100
    state = client.get(f"/api/missions/{mission_id}/state").json()
    assert body["victims_evacuated"] == state["metrics"]["victims_evacuated"]


def test_demo_run_produces_a_real_failure_and_recovery(mission_id):
    r = client.post("/api/demo/run", json={"mission_id": mission_id})
    assert r.status_code == 200
    state = r.json()["state"]
    assert state["metrics"]["replans"] >= 1
    assert next(rd for rd in state["roads"] if rd["id"] == "R12")["status"] == "BLOCKED"
    assert any(t["kind"] == "FAILURE" for t in state["trace"])
    assert any(d["selected_action"].startswith("Reassign") for d in state["decisions"])


def test_decisions_evidence_trace_endpoints(mission_id):
    client.post(f"/api/missions/{mission_id}/start")
    assert isinstance(client.get(f"/api/missions/{mission_id}/decisions").json(), list)
    assert isinstance(client.get(f"/api/missions/{mission_id}/evidence").json(), list)
    assert isinstance(client.get(f"/api/missions/{mission_id}/trace").json(), list)


def test_pause_and_resume(mission_id):
    assert client.post(f"/api/missions/{mission_id}/pause").status_code == 200
    assert client.post(f"/api/missions/{mission_id}/resume").status_code == 200

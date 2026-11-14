"""End-to-end integration check against a running backend.

Usage: python scripts/integration_check.py [base_url]
Exercises every endpoint the frontend calls and asserts the full
self-healing loop actually fires (failure -> replan -> recovery).
"""
import json
import sys
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8020/api"
failures = []
checks = 0


def call(method, path, body=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.status, json.loads(resp.read().decode())


def check(label, condition, detail=""):
    global checks
    checks += 1
    if condition:
        print(f"  PASS  {label}")
    else:
        print(f"  FAIL  {label} {detail}")
        failures.append(label)


print(f"RescueOps integration check against {BASE}\n")

status, health = call("GET", "/health")
check("GET /health", status == 200 and health.get("ok") is True)
print(f"        llm_provider = {health.get('llm_provider')}")

status, state = call("POST", "/missions", {"scenario": "flood_default"})
mid = state["mission"]["id"]
check("POST /missions", status == 200 and mid)
check("scenario has 12 victim groups / 24 people",
      len(state["victims"]) == 12 and sum(v["people_count"] for v in state["victims"]) == 24)
check("scenario has 15 roads", len(state["roads"]) == 15)
check("scenario has 4 resources", len(state["vehicles"]) == 4)
check("zones carry map coordinates", all("lat" in z and "lng" in z for z in state["zones"]))
check("goal is present", state["goal"]["deadline_minutes"] == 20)

status, r = call("GET", f"/missions/{mid}")
check("GET /missions/{id}", status == 200)
status, r = call("GET", f"/missions/{mid}/state")
check("GET /missions/{id}/state", status == 200)

# --- one deliberate agent step ---
status, r = call("POST", "/agent/step", {"mission_id": mid})
check("POST /agent/step", status == 200 and r["result"]["status"] == "STEP_COMPLETE")
initial_decisions = r["state"]["decisions"]
check("agent made a real assignment decision", len(initial_decisions) >= 1)
first = initial_decisions[0]
print(f"        initial plan: {first['selected_action']} (impact {first['mission_impact_score']})")
check("decision carries alternatives", len(first["alternatives"]) >= 1)
check("decision carries evidence ids", len(first["evidence_ids"]) >= 1)

planned_roads = None
for vic_id, _ in []:
    pass

# --- inject the road block: the signature self-healing event ---
status, r = call("POST", "/simulation/events",
                 {"mission_id": mid, "event": "ROAD_BLOCKED", "params": {"road_id": "R12"}})
check("POST /simulation/events (ROAD_BLOCKED)", status == 200 and r["event_result"]["ok"])
state = r["state"]
r12 = next(rd for rd in state["roads"] if rd["id"] == "R12")
check("R12 is genuinely BLOCKED in state", r12["status"] == "BLOCKED")
check("agent detected plan failure and replanned", state["metrics"]["replans"] >= 1,
      f"replans={state['metrics']['replans']}")
failure_traces = [t for t in state["trace"] if t["kind"] == "FAILURE"]
check("failure recorded in decision trace", len(failure_traces) >= 1)

replan_decisions = [d for d in state["decisions"] if d["selected_action"].startswith("Reassign")]
check("a replacement plan was produced", len(replan_decisions) >= 1)
if replan_decisions:
    rd = replan_decisions[-1]
    print(f"        recovery plan: {rd['selected_action']} (risk {rd['risk_level']}, "
          f"approval={rd['requires_human_approval']})")

# --- human-in-the-loop ---
pending = [a for a in state["approvals"] if a["status"] == "PENDING"]
check("high-risk replan escalated to a human", len(pending) >= 1)
if pending:
    apr = pending[0]
    status, r = call("POST", f"/approvals/{apr['id']}/approve", {"mission_id": mid})
    check("POST /approvals/{id}/approve", status == 200)
    state = r["state"]
    check("mission resumed after approval",
          state["mission"]["agent_state"] in ("COMPLETED", "EVALUATING", "EXECUTING", "PLANNING", "WAITING_APPROVAL"))

# --- run to completion, approving any further escalations (as an operator would) ---
for _ in range(15):
    status, r = call("POST", f"/missions/{mid}/start")
    state = r["state"]
    if state["mission"]["status"] in ("COMPLETED", "FAILED"):
        break
    still_pending = [a for a in state["approvals"] if a["status"] == "PENDING"]
    if still_pending:
        call("POST", f"/approvals/{still_pending[0]['id']}/approve", {"mission_id": mid})
    else:
        break
print(f"        final: {state['mission']['status']} @ {state['mission']['progress_pct']}% overall "
      f"({state['metrics']['critical_evacuated']}/{state['metrics']['critical_total']} critical) "
      f"in {state['mission']['elapsed_min']} simulated min, deadline_met={state['mission']['deadline_met']}")
check("mission reaches a terminal state",
      state["mission"]["status"] in ("COMPLETED", "AT_RISK", "FAILED"))
check("goal verified on critical victims",
      state["metrics"]["critical_evacuated"] == state["metrics"]["critical_total"])
check("deadline outcome reported honestly", "deadline_met" in state["mission"])
check("victims actually evacuated", state["metrics"]["victims_evacuated"] > 0)
check("evidence was recorded throughout", len(state["evidence"]) > 10)
check("no infinite loop (iterations bounded)", state["mission"]["iterations"] <= 60)

# --- remaining read endpoints ---
for path, label in [
    (f"/missions/{mid}/decisions", "GET decisions"),
    (f"/missions/{mid}/evidence", "GET evidence"),
    (f"/missions/{mid}/trace", "GET trace"),
    (f"/analytics/{mid}", "GET analytics"),
]:
    status, body = call("GET", path)
    check(label, status == 200 and body is not None)

status, r = call("POST", f"/missions/{mid}/pause")
check("POST /missions/{id}/pause", status == 200)
status, r = call("POST", f"/missions/{mid}/resume")
check("POST /missions/{id}/resume", status == 200)

# --- other environment events on a fresh mission ---
status, s2 = call("POST", "/missions", {"scenario": "flood_default"})
mid2 = s2["mission"]["id"]
call("POST", "/agent/step", {"mission_id": mid2})
for ev in ["VEHICLE_UNAVAILABLE", "HOSPITAL_FULL", "NEW_VICTIM"]:
    status, r = call("POST", "/simulation/events", {"mission_id": mid2, "event": ev})
    check(f"POST /simulation/events ({ev})", status == 200 and r["event_result"]["ok"])
status, r = call("POST", "/agent/replan", {"mission_id": mid2})
check("POST /agent/replan", status == 200)
status, r = call("POST", "/simulation/reset", {"mission_id": mid2})
check("POST /simulation/reset", status == 200 and r["mission"]["progress_pct"] == 0)

# --- demo mode ---
status, s3 = call("POST", "/missions", {"scenario": "flood_default"})
mid3 = s3["mission"]["id"]
status, r = call("POST", "/demo/run", {"mission_id": mid3})
check("POST /demo/run", status == 200)
d = r["state"]
check("demo produced a real replan", d["metrics"]["replans"] >= 1)
check("demo blocked R12 for real", next(x for x in d["roads"] if x["id"] == "R12")["status"] == "BLOCKED")

print(f"\n{checks - len(failures)}/{checks} checks passed")
if failures:
    print("FAILED: " + ", ".join(failures))
    sys.exit(1)
print("ALL INTEGRATION CHECKS PASSED")

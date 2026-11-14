# RescueOps AI — Self-Healing Mission Agent

**"An AI agent that doesn't just plan a response — it observes, acts, evaluates, adapts, and recovers when the mission changes."**

Built for the Agentic AI Hackathon — Tech Zephyr 4.0, IIT Bhubaneswar.

> ⚠️ **This is a simulation and decision-support prototype. It is not an autonomous emergency
> dispatch system.** It does not connect to real emergency infrastructure, does not make
> real-world dispatch decisions, and its scoring is a transparent heuristic — not a validated
> emergency metric.

---

## 1. Problem

Emergency response coordinators decide while the ground truth keeps moving: roads flood and
close, vehicles break down or get retasked, hospitals hit capacity, victim severity changes,
and new calls arrive mid-response. The plan that was optimal at minute 0 is frequently invalid
by minute 4.

## 2. Why static systems are insufficient

Conventional tooling is excellent at *showing* state — maps, resource tables, incident lists —
and at computing a plan once. But the loop closes on a human: a person must notice the change,
work out what it invalidated, generate alternatives, compare them, and re-dispatch, under time
pressure. Software that stops at `PLAN → EXECUTE` hands the hardest part back to the operator
at the worst possible moment.

## 3. Solution

RescueOps closes that loop. It holds an explicit mission goal, plans against live state, acts
through real tools, watches for the world changing underneath it, diagnoses what broke,
generates and scores alternatives, recovers — and escalates to a human when the stakes justify
it.

```
Traditional:   PLAN → EXECUTE
RescueOps:     PLAN → ACT → OBSERVE → EVALUATE → ADAPT → VERIFY
```

**Nothing in the demo is scripted.** The road block genuinely mutates simulation state, the
route engine genuinely recomputes over a graph that no longer contains that edge, and the
agent's recovery is whatever the scoring actually ranks highest at that moment.

## 4. Agentic architecture

A single **RescueOps Orchestrator** runs the loop, exercising ten capabilities: situation
analysis, mission planning, resource allocation, route planning, risk analysis, action
execution, environment observation, plan evaluation, recovery/replanning, and human escalation.

The design decision that matters most:

| Used for | Handled by |
|---|---|
| Routing, ETA, capacity, prioritization, scoring, goal progress, failure detection | **Deterministic engines** (NetworkX + explicit code) |
| Explaining decisions, summarizing failures, interpreting the goal | **LLM** (`ModelProvider`) |

An LLM outage degrades explanations, never correctness. See
[`docs/architecture.md`](docs/architecture.md) for full diagrams.

## 5. Self-healing mission loop

```python
while not mission_verified and iterations < max_iterations:
    observe_state()                     # get_incident_state, detect_plan_failure
    if plan_is_valid:
        select_next_action()            # severity-ordered, dispatch every free resource
        execute_action()
    else:
        diagnose_failure()              # what broke, and why
        invalidate_broken_assignments() # release vehicle + reserved bed
        generate_alternatives()         # vehicle × destination × route
        evaluate_and_compare()          # simulation decision score
        select_best_feasible_plan()
    evaluate_goal_progress()
    if risk is HIGH or CRITICAL:
        request_human_approval()        # loop halts here
    if goal_satisfied:
        finish_mission()
```

## 6. Tool architecture

20 tools; every call returns a structured result and writes an evidence record:

```json
{ "tool": "get_road_status", "input": {"road_id": "R12"},
  "result": {"status": "BLOCKED", "risk": 0.1},
  "timestamp": "2026-08-31T15:23:15Z", "evidence_id": "EV-0104" }
```

`get_incident_state` · `get_victims` · `get_available_resources` · `get_hospital_capacity` ·
`get_shelter_capacity` · `get_road_status` · `calculate_route` · `calculate_eta` ·
`assign_resource` · `reserve_resource` · `update_resource` · `simulate_action` ·
`get_weather_condition` · `evaluate_mission` · `detect_plan_failure` ·
`generate_alternative_plans` · `compare_plans` · `execute_action` · `request_human_approval` ·
`record_evidence`

## 7. State management

`MissionWorld` is the single source of truth: victims, vehicles, hospitals, shelters, roads
and status, current plan, decisions, evidence, trace, approvals, and metrics. The agent
re-reads it every iteration, so an external change is picked up on the very next step.

## 8. Simulation engine

- **Road network:** directed NetworkX graph, 7 nodes / 15 roads, weighted by travel time,
  congestion multiplier and risk. Blocked roads are *removed from the graph*, so they cannot
  be routed over by construction.
- **Environment simulator:** four injectable events that genuinely mutate state —
  `ROAD_BLOCKED`, `VEHICLE_UNAVAILABLE`, `HOSPITAL_FULL`, `NEW_VICTIM`.
- **Default scenario:** flood across Zones A/B/C — 12 victim groups (24 people, 8 critical),
  2 ambulances + 1 rescue team + 1 medical team, hospitals H1/H2, shelters S1/S2, roads R1–R15.

## 9. Failure recovery

| Change class | Event | Recovery |
|---|---|---|
| Infrastructure | Road blocked | Reroute over a graph without that edge |
| Resource | Vehicle unavailable | Reassign to another feasible vehicle |
| Demand | New critical victim | Prioritized into the next dispatch wave |
| Destination | Hospital at capacity | Redirect to a hospital with real capacity |

Each recovery reports OLD PLAN → CHANGE → IMPACT → ALTERNATIVES → NEW PLAN → RESULT in the
decision trace.

## 10. Human-in-the-loop

| Risk | Trigger | Behaviour |
|---|---|---|
| LOW | Fresh assignment | Auto-executes |
| MEDIUM | Replan, same destination | Executes with recorded reasoning |
| HIGH | Replan changing a **critical** victim's destination | **Halts for approval** |
| CRITICAL | Mission infeasible | Escalates, recommends more resources |

While an approval is pending the agent takes no further action — `step()` returns
`WAITING_APPROVAL`.

**Impossible missions are reported, not faked.** With no transport capacity or no feasible
route, the mission is marked `AT_RISK` with the reason and a CRITICAL escalation. Likewise, a
run that finishes past its deadline reports `deadline_met: false` rather than claiming clean
success.

## 11. Technology stack

**Backend:** Python 3.11 · FastAPI · Pydantic · NetworkX · pytest
**Frontend:** React 19 · TypeScript · Vite · Tailwind CSS · React Router · Leaflet · Recharts · React Flow
**Infra:** Docker · docker-compose · nginx

## 12. Installation

```bash
# Backend
cd backend
python -m venv venv
venv/Scripts/activate        # Windows;  source venv/bin/activate on macOS/Linux
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

## 13. Environment variables

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | backend | *(unset)* | Enables LLM explanations. **Optional** — without it the agent uses a clearly-labelled local fallback and the full loop still runs offline. |
| `ANTHROPIC_MODEL` | backend | `claude-sonnet-5` | Model id |
| `VITE_API_BASE` | frontend | `http://localhost:8020/api` | Backend base URL |

Copy `backend/.env.example` → `backend/.env`. **Never commit a real key**; `.gitignore`
excludes `.env`.

## 14. Running locally

```bash
# Terminal 1 — backend
cd backend
venv/Scripts/python -m uvicorn app.main:app --port 8020 --reload

# Terminal 2 — frontend
cd frontend
npm run dev -- --port 5173
```

Open <http://localhost:5173>. API docs at <http://localhost:8020/docs>.

> Ports 8000/8010 were occupied on the development machine, so **8020** is the documented
> default. To use another port, change it in the uvicorn command and set `VITE_API_BASE` to match.

## 15. Docker

```bash
docker compose up --build
```

Frontend on <http://localhost:5173>, backend on <http://localhost:8000>. (The compose file
uses 8000 inside its own network; the host-run default above is 8020.)

## 16. Demo instructions

**One-click:** open the landing page → **Launch Mission Simulator** → on the dashboard press
**Run Live Demo** (or `POST /api/demo/run`), which executes the whole failure-and-recovery arc
server-side.

**Manual, for a live audience — the recommended 3-minute run:**

1. **Launch Mission Simulator** — flood scenario loads; 12 victim groups, 8 critical, 4 resources.
2. **Start Simulation** / **Step** — the agent dispatches every free vehicle, criticals first.
   Note the initial plan routes `AMB-A → V-0001 → Hospital H1` over **R12**.
3. **Inject Road Block** — R12 turns red on the map. This genuinely mutates state.
4. Watch the agent: *plan failure detected* → alternatives generated and scored → recovery plan
   selected → because it changes a critical victim's destination it is **HIGH risk**.
5. **Approve** the escalation — the loop resumes and executes the new route.
6. **Goal verified**: all critical victim groups evacuated, with the deadline outcome stated.
7. Open **Decisions** and **Evidence** to show every step is traceable to real tool results.

## 17. API

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/missions` | Create mission from a scenario |
| GET | `/api/missions/{id}` · `/state` | Full live mission state |
| POST | `/api/missions/{id}/start` · `/pause` · `/resume` | Mission control |
| POST | `/api/agent/step` | Run exactly one loop iteration |
| POST | `/api/agent/replan` | Force a replan cycle |
| GET | `/api/missions/{id}/decisions` · `/evidence` · `/trace` | Audit trail |
| POST | `/api/simulation/events` | Inject a real environment change |
| POST | `/api/simulation/reset` | Reset the scenario |
| POST | `/api/approvals/{id}/approve` · `/reject` | Human-in-the-loop gate |
| GET | `/api/analytics/{id}` | Metrics from actual simulation state |
| POST | `/api/demo/run` | Scripted end-to-end demo |
| GET | `/api/health` | Health + active LLM provider |

Interactive docs: <http://localhost:8020/docs>.

## 18. Testing

```bash
cd backend && venv/Scripts/python -m pytest tests/ -v     # 40 unit + API tests
python scripts/integration_check.py                       # 41 live end-to-end checks
cd frontend && npm run build                              # TypeScript build
```

Covered: scenario integrity, route calculation and rerouting, alternative-route distinctness,
capacity limits, victim prioritization, plan-failure detection, replanning and recovery,
vehicle-loss and new-victim adaptation, resource/bed release on replan, approval approve and
reject paths, impossible-mission detection, deadline honesty, decision/evidence completeness,
iteration bounds, and every REST endpoint including error paths.

## 19. Limitations

- **Simulation only.** No real map, traffic, hospital, or dispatch data; no connection to real
  emergency systems.
- **Mission state is in process memory** — restarting the backend clears missions, and the
  backend is single-worker by design. There is no database persistence yet.
- **Time is discrete**, advanced in fixed simulated steps, not continuous.
- **One victim group per vehicle trip**; capacity is enforced but not packed.
- **The "Simulation Decision Score" is a transparent heuristic** with hand-chosen weights. It is
  explainable, not validated.
- **No authentication.** The API is open and CORS-permissive for local demo use; it is not
  production-hardened.
- **The LLM is used only for narration.** With no API key it falls back to labelled templated
  text, so explanations are less fluent but every number and decision is identical.
- **Frontend verified by build and API integration**, not by an automated browser test suite.

## 20. Future work

- Persistent storage (PostgreSQL/SQLAlchemy) for multi-run experiments and cross-run comparison
- Multi-victim vehicle packing and continuous-time simulation
- Real road-network ingestion (OSM) and live traffic/weather feeds
- Authentication, per-role permissions, rate limiting, and audit-log export
- Automated browser end-to-end tests (Playwright) for the UI flows
- Agent benchmarking across randomized scenarios to measure recovery rate statistically

---

### Responsible use

RescueOps distinguishes clearly between **SIMULATION**, **AI DECISION**, **ACTUAL TOOL RESULT**,
and **HUMAN APPROVAL** throughout its interface and logs. It makes no claim of real-world
accuracy, disaster prediction, guaranteed safety, or emergency-authority integration.

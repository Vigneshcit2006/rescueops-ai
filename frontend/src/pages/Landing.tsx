import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiRequestError } from "../lib/api";
import { useMission } from "../context/MissionContext";

const traditionalSteps = ["PLAN", "EXECUTE"];
const rescueOpsSteps = ["PLAN", "ACT", "OBSERVE", "EVALUATE", "ADAPT", "VERIFY"];

function FlowRow({ steps, tone }: { steps: string[]; tone: "neutral" | "accent" }) {
  return (
    <div className="flex items-center flex-wrap gap-2">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={`px-4 py-2.5 rounded-md border text-sm font-semibold tracking-wide ${
              tone === "accent"
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-base-600 bg-base-800 text-slate-400"
            }`}
          >
            {step}
          </div>
          {i < steps.length - 1 && <span className="text-slate-600">&rarr;</span>}
        </div>
      ))}
    </div>
  );
}

export function Landing() {
  const navigate = useNavigate();
  const { setMissionId } = useMission();
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function launchMission() {
    setLaunching(true);
    setError(null);
    try {
      const state = await api.createMission("flood_default");
      setMissionId(state.mission.id);
      navigate(`/dashboard/${state.mission.id}`);
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? `${err.message}${err.detail ? ` — ${err.detail}` : ""}`
          : "Failed to launch mission. Is the backend running?"
      );
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="flex flex-col gap-16">
      <section className="flex flex-col items-center text-center gap-6 pt-16 pb-6">
        <span className="badge bg-accent/10 text-accent border border-accent/30">
          Self-Healing Mission Agent
        </span>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-50">
          RESCUEOPS <span className="text-accent">AI</span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl">
          Observe. Decide. Act. Evaluate. Adapt.
        </p>
        <p className="text-sm text-slate-500 max-w-xl">
          An agentic AI emergency-response coordinator that continuously replans evacuation
          strategy as roads close, vehicles fail, and conditions change on the ground.
        </p>

        <button className="btn-primary text-base px-6 py-3 mt-2" onClick={launchMission} disabled={launching}>
          {launching ? "Launching mission..." : "Launch Mission Simulator"}
        </button>
        {error && <p className="text-status-critical text-sm max-w-md">{error}</p>}

        <p className="text-xs text-slate-600 max-w-lg mt-4 border-t border-base-700 pt-4">
          This is a simulation and decision-support prototype. It is not an autonomous emergency
          dispatch system.
        </p>
      </section>

      <section className="panel p-6 md:p-8 flex flex-col gap-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Why a self-healing loop
        </h2>

        <div className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-wide text-slate-500">Traditional dispatch systems</span>
          <FlowRow steps={traditionalSteps} tone="neutral" />
          <p className="text-sm text-slate-500 max-w-2xl">
            A plan is built once and executed rigidly. When conditions on the ground change — a
            road floods, an ambulance breaks down, a hospital fills up — the plan doesn't adapt.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-wide text-accent">RescueOps AI</span>
          <FlowRow steps={rescueOpsSteps} tone="accent" />
          <p className="text-sm text-slate-500 max-w-2xl">
            The agent continuously observes the mission environment, acts on its current best
            plan, evaluates outcomes against the mission goal, adapts by replanning around
            failures, and verifies the result — closing the loop instead of executing blind.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: "Autonomous decision loop",
            body: "Every action is logged with its reasoning, alternatives considered, confidence, and risk level.",
          },
          {
            title: "Human-in-the-loop approval",
            body: "High-risk decisions pause for explicit human approval before execution.",
          },
          {
            title: "Live simulation controls",
            body: "Inject road blocks, disable vehicles, or fill hospitals to see the agent adapt in real time.",
          },
        ].map((card) => (
          <div key={card.title} className="panel p-5">
            <h3 className="font-semibold text-slate-200 mb-1.5">{card.title}</h3>
            <p className="text-sm text-slate-500">{card.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

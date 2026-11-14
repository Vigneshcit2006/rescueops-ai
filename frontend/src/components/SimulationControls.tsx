import { useState } from "react";
import { api, ApiRequestError } from "../lib/api";
import type { SimulationEventType } from "../types";

interface SimulationControlsProps {
  missionId: string;
  onChanged?: () => void;
  onLog?: (message: string, ok: boolean) => void;
}

type ActionKey =
  | "start"
  | "pause"
  | "resume"
  | "step"
  | "demo"
  | "road_block"
  | "disable_vehicle"
  | "fill_hospital"
  | "add_victim"
  | "reset";

export function SimulationControls({ missionId, onChanged, onLog }: SimulationControlsProps) {
  const [pending, setPending] = useState<ActionKey | null>(null);

  async function run(key: ActionKey, fn: () => Promise<unknown>, label: string) {
    setPending(key);
    try {
      await fn();
      onLog?.(`${label} succeeded`, true);
      onChanged?.();
    } catch (err) {
      const message =
        err instanceof ApiRequestError
          ? `${err.message}${err.detail ? ` — ${err.detail}` : ""}`
          : "Request failed";
      onLog?.(`${label} failed: ${message}`, false);
    } finally {
      setPending(null);
    }
  }

  const simEvent = (event: SimulationEventType, params?: Record<string, unknown>) =>
    api.triggerSimulationEvent(missionId, event, params);

  const buttons: { key: ActionKey; label: string; cls: string; action: () => Promise<unknown> }[] = [
    { key: "start", label: "Start Simulation", cls: "btn-primary", action: () => api.startMission(missionId) },
    { key: "pause", label: "Pause", cls: "btn-secondary", action: () => api.pauseMission(missionId) },
    { key: "resume", label: "Resume", cls: "btn-secondary", action: () => api.resumeMission(missionId) },
    { key: "step", label: "Step Once", cls: "btn-secondary", action: () => api.agentStep(missionId) },
    {
      key: "demo",
      label: "Run Live Demo",
      cls: "btn-primary",
      action: () => api.runDemo(missionId),
    },
    {
      key: "road_block",
      label: "Inject Road Block",
      cls: "btn-secondary",
      action: () => simEvent("ROAD_BLOCKED"),
    },
    {
      key: "disable_vehicle",
      label: "Disable Ambulance",
      cls: "btn-secondary",
      action: () => simEvent("VEHICLE_UNAVAILABLE"),
    },
    {
      key: "fill_hospital",
      label: "Fill Hospital",
      cls: "btn-secondary",
      action: () => simEvent("HOSPITAL_FULL"),
    },
    {
      key: "add_victim",
      label: "Add Critical Victim",
      cls: "btn-secondary",
      action: () => simEvent("NEW_VICTIM", { severity: "CRITICAL" }),
    },
    { key: "reset", label: "Reset", cls: "btn-danger", action: () => api.resetSimulation(missionId) },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {buttons.map((b) => (
        <button
          key={b.key}
          className={b.cls}
          disabled={pending !== null}
          onClick={() =>
            run(b.key, b.action, b.label)
          }
        >
          {pending === b.key ? "Working..." : b.label}
        </button>
      ))}
    </div>
  );
}

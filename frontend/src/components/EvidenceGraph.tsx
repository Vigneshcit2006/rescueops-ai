import { useMemo } from "react";
import ReactFlow, { Background, Controls, MarkerType, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";
import type { Decision, Evidence, MissionState } from "../types";

const STAGE_ORDER = [
  "MISSION",
  "VICTIM PRIORITY",
  "RESOURCE",
  "ROUTE",
  "EVENT",
  "PLAN FAILURE",
  "ALTERNATIVES",
  "NEW ROUTE",
  "ACTION",
  "OUTCOME",
];

function classifyEntity(id: string): "VICTIM PRIORITY" | "RESOURCE" | "ROUTE" | null {
  const lower = id.toLowerCase();
  if (lower.startsWith("v") && !lower.startsWith("veh")) return "VICTIM PRIORITY";
  if (lower.startsWith("amb") || lower.startsWith("rt") || lower.startsWith("mt") || lower.startsWith("veh"))
    return "RESOURCE";
  if (lower.startsWith("r") || lower.startsWith("road")) return "ROUTE";
  if (lower.startsWith("h") || lower.startsWith("s")) return "RESOURCE";
  return null;
}

function classifyEvidence(ev: Evidence): (typeof STAGE_ORDER)[number] {
  const type = ev.type.toUpperCase();
  if (type.includes("FAILURE") || type.includes("BLOCK")) return "PLAN FAILURE";
  if (type.includes("ROUTE") || type.includes("ROAD")) return "ROUTE";
  if (type.includes("VICTIM")) return "VICTIM PRIORITY";
  if (type.includes("RESOURCE") || type.includes("VEHICLE") || type.includes("HOSPITAL")) return "RESOURCE";
  return "EVENT";
}

const stageColor: Record<string, string> = {
  MISSION: "#3b82f6",
  "VICTIM PRIORITY": "#ef4444",
  RESOURCE: "#22c55e",
  ROUTE: "#38bdf8",
  EVENT: "#94a3b8",
  "PLAN FAILURE": "#f59e0b",
  ALTERNATIVES: "#a855f7",
  "NEW ROUTE": "#38bdf8",
  ACTION: "#3b82f6",
  OUTCOME: "#22c55e",
};

function buildGraph(state: MissionState): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const stageX: Record<string, number> = {};
  STAGE_ORDER.forEach((s, i) => (stageX[s] = i * 220));
  const stageY: Record<string, number> = {};

  function nextY(stage: string) {
    const y = stageY[stage] ?? 0;
    stageY[stage] = y + 90;
    return y;
  }

  function addNode(id: string, label: string, stage: string, sub?: string) {
    if (nodes.find((n) => n.id === id)) return;
    nodes.push({
      id,
      position: { x: stageX[stage] ?? 0, y: nextY(stage) },
      data: { label: (
        <div className="flex flex-col">
          <span className="font-semibold text-[11px]">{label}</span>
          {sub && <span className="text-[10px] opacity-70">{sub}</span>}
        </div>
      ) },
      style: {
        background: "#0e131b",
        border: `1px solid ${stageColor[stage] ?? "#3a4759"}`,
        borderRadius: 6,
        color: "#e2e8f0",
        fontSize: 11,
        padding: 8,
        width: 190,
      },
    });
  }

  function addEdge(source: string, target: string) {
    const id = `${source}->${target}`;
    if (edges.find((e) => e.id === id)) return;
    edges.push({
      id,
      source,
      target,
      animated: false,
      style: { stroke: "#3a4759" },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#3a4759" },
    });
  }

  addNode("mission", state.mission.name || "MISSION", "MISSION", state.mission.status);

  const evidenceSorted = [...state.evidence].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const evidenceStageNode: Record<string, string> = {};

  evidenceSorted.forEach((ev) => {
    const stage = classifyEvidence(ev);
    const nodeId = `ev-${ev.id}`;
    addNode(nodeId, ev.type, stage, ev.summary.slice(0, 40));
    evidenceStageNode[ev.id] = nodeId;
    addEdge("mission", nodeId);

    ev.related_entities.forEach((entity) => {
      const entityStage = classifyEntity(entity);
      if (entityStage && entityStage !== stage) {
        const entityNodeId = `entity-${entityStage}`;
        addNode(entityNodeId, entityStage, entityStage);
        addEdge(entityNodeId, nodeId);
        addEdge("mission", entityNodeId);
      }
    });
  });

  const decisionsSorted: Decision[] = [...state.decisions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  decisionsSorted.forEach((decision) => {
    if (decision.alternatives.length > 0) {
      const altId = `alt-${decision.id}`;
      addNode(
        altId,
        "ALTERNATIVES",
        "ALTERNATIVES",
        `${decision.alternatives.length} option(s) considered`
      );
      decision.evidence_ids.forEach((evId) => {
        const src = evidenceStageNode[evId];
        if (src) addEdge(src, altId);
      });

      const looksLikeRoute = decision.alternatives.some((a) => /route|road|reroute/i.test(a.action));
      if (looksLikeRoute) {
        const routeId = `newroute-${decision.id}`;
        addNode(routeId, "NEW ROUTE", "NEW ROUTE", decision.selected_action.slice(0, 40));
        addEdge(altId, routeId);
        const actionId = `action-${decision.id}`;
        addNode(actionId, "ACTION", "ACTION", decision.selected_action.slice(0, 40));
        addEdge(routeId, actionId);
        const outcomeId = `outcome-${decision.id}`;
        addNode(outcomeId, "OUTCOME", "OUTCOME", decision.expected_impact.slice(0, 40));
        addEdge(actionId, outcomeId);
      } else {
        const actionId = `action-${decision.id}`;
        addNode(actionId, "ACTION", "ACTION", decision.selected_action.slice(0, 40));
        addEdge(altId, actionId);
        const outcomeId = `outcome-${decision.id}`;
        addNode(outcomeId, "OUTCOME", "OUTCOME", decision.expected_impact.slice(0, 40));
        addEdge(actionId, outcomeId);
      }
    } else {
      const actionId = `action-${decision.id}`;
      addNode(actionId, "ACTION", "ACTION", decision.selected_action.slice(0, 40));
      decision.evidence_ids.forEach((evId) => {
        const src = evidenceStageNode[evId];
        if (src) addEdge(src, actionId);
      });
      const outcomeId = `outcome-${decision.id}`;
      addNode(outcomeId, "OUTCOME", "OUTCOME", decision.expected_impact.slice(0, 40));
      addEdge(actionId, outcomeId);
    }
  });

  return { nodes, edges };
}

export function EvidenceGraph({ state }: { state: MissionState }) {
  const { nodes, edges } = useMemo(() => buildGraph(state), [state]);

  if (state.evidence.length === 0) {
    return (
      <div className="h-[420px] flex items-center justify-center text-slate-500 text-sm border border-base-700 rounded-md">
        No evidence recorded yet — the graph will populate as the agent gathers observations.
      </div>
    );
  }

  return (
    <div className="h-[520px] border border-base-700 rounded-md overflow-hidden bg-base-900">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
      >
        <Background color="#1b2430" gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

"""Graph-based road network and route calculation (deterministic)."""
from __future__ import annotations

import networkx as nx

from app.models.domain import MissionWorld, RoadStatus


def build_graph(world: MissionWorld) -> nx.DiGraph:
    g = nx.DiGraph()
    for z in world.zones.values():
        g.add_node(z.id)
    for road in world.roads.values():
        if road.status == RoadStatus.BLOCKED:
            continue  # blocked roads are simply not traversable
        weight = road.base_travel_min
        if road.status == RoadStatus.CONGESTED:
            weight *= 1.6
        weight *= (1 + road.risk)
        g.add_edge(road.source, road.destination, weight=weight, road_id=road.id, risk=road.risk)
        g.add_edge(road.destination, road.source, weight=weight, road_id=road.id, risk=road.risk)
    return g


def calculate_route(world: MissionWorld, source: str, destination: str) -> dict | None:
    """Returns {path: [zone...], road_ids: [...], eta_min: float, risk: float} or None if infeasible."""
    g = build_graph(world)
    if source not in g or destination not in g:
        return None
    try:
        path = nx.shortest_path(g, source, destination, weight="weight")
    except nx.NetworkXNoPath:
        return None
    eta = 0.0
    risk_total = 0.0
    road_ids = []
    for a, b in zip(path[:-1], path[1:]):
        edge = g[a][b]
        eta += edge["weight"]
        risk_total += edge["risk"]
        road_ids.append(edge["road_id"])
    avg_risk = risk_total / max(len(road_ids), 1)
    return {"path": path, "road_ids": road_ids, "eta_min": round(eta, 1), "risk": round(avg_risk, 2)}


def calculate_eta(world: MissionWorld, source: str, destination: str) -> float | None:
    route = calculate_route(world, source, destination)
    return route["eta_min"] if route else None


def k_alternative_routes(world: MissionWorld, source: str, destination: str, k: int = 3) -> list[dict]:
    """Generate up to k distinct simple-path alternatives, cheapest first."""
    g = build_graph(world)
    if source not in g or destination not in g:
        return []
    results = []
    try:
        gen = nx.shortest_simple_paths(g, source, destination, weight="weight")
        for i, path in enumerate(gen):
            if i >= k:
                break
            eta = 0.0
            risk_total = 0.0
            road_ids = []
            for a, b in zip(path[:-1], path[1:]):
                edge = g[a][b]
                eta += edge["weight"]
                risk_total += edge["risk"]
                road_ids.append(edge["road_id"])
            results.append({
                "path": path, "road_ids": road_ids, "eta_min": round(eta, 1),
                "risk": round(risk_total / max(len(road_ids), 1), 2),
            })
    except nx.NetworkXNoPath:
        return []
    return results

import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Hospital, MissionState, Road, Shelter, Vehicle, Victim } from "../types";
import { EmptyState } from "./Feedback";

// Default vite/leaflet asset resolution is broken without this; use CDN icons instead of bundling.
const iconFor = (color: string) =>
  new L.DivIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.85);box-shadow:0 0 6px ${color}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

const icons = {
  victimCritical: iconFor("#ef4444"),
  victimHigh: iconFor("#f59e0b"),
  victimOther: iconFor("#38bdf8"),
  vehicle: iconFor("#22c55e"),
  hospital: iconFor("#a855f7"),
  shelter: iconFor("#eab308"),
};

function roadColor(status: Road["status"]) {
  if (status === "BLOCKED") return "#ef4444";
  if (status === "CONGESTED") return "#f59e0b";
  return "#3a4759";
}

// Deterministic fallback layout: arranges entities on a synthetic circular
// grid keyed by id when the backend doesn't provide lat/lng, so the map
// never crashes and still conveys relative structure.
function synthCoords(id: string, center: [number, number], ring: number): [number, number] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const angle = (hash % 360) * (Math.PI / 180);
  const r = 0.01 + (ring % 5) * 0.006;
  return [center[0] + Math.cos(angle) * r, center[1] + Math.sin(angle) * r];
}

const FALLBACK_CENTER: [number, number] = [20.29, 85.82];

export function MapView({ state, height = 480 }: { state: MissionState | null; height?: number }) {
  if (!state) return <EmptyState title="No mission data" hint="Waiting for mission state" />;

  // Entities carry a zone id in `location`; the zone list carries the real coordinates.
  const zones = state.zones ?? [];
  const zoneCoords = new Map<string, [number, number]>(zones.map((z) => [z.id, [z.lat, z.lng]]));
  const zoneNames = new Map<string, string>(zones.map((z) => [z.id, z.name]));
  const anyRealCoords = zoneCoords.size > 0;

  const center: [number, number] = anyRealCoords
    ? [
        zones.reduce((sum, z) => sum + z.lat, 0) / zones.length,
        zones.reduce((sum, z) => sum + z.lng, 0) / zones.length,
      ]
    : FALLBACK_CENTER;

  // Spread co-located entities slightly so overlapping markers in one zone stay clickable.
  const locate = (id: string, location: string, ring = 0): [number, number] => {
    const base = zoneCoords.get(location);
    if (!base) return synthCoords(id, center, ring);
    if (ring === 0) return base;
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    const angle = (hash % 360) * (Math.PI / 180);
    const r = 0.0012 * ring;
    return [base[0] + Math.cos(angle) * r, base[1] + Math.sin(angle) * r];
  };

  const locationByName = zoneCoords;
  const roadById = new Map(state.roads.map((r) => [r.id, r]));

  // Draw the agent's live plan: each assignment's road_ids become a highlighted path.
  // When the agent replans, these polylines change with the underlying state.
  const activeRoutes = (state.assignments ?? []).flatMap((assignment) => {
    const segments = assignment.road_ids
      .map((rid) => roadById.get(rid))
      .filter((r): r is Road => Boolean(r))
      .map((r) => {
        const from = zoneCoords.get(r.source);
        const to = zoneCoords.get(r.destination);
        return from && to ? ([from, to] as [[number, number], [number, number]]) : null;
      })
      .filter((s): s is [[number, number], [number, number]] => Boolean(s));
    return segments.length ? [{ assignment, segments }] : [];
  });

  return (
    <div style={{ height }} className="rounded-md overflow-hidden border border-base-700">
      {!anyRealCoords && (
        <div className="bg-status-info/10 text-status-info text-[11px] px-3 py-1 border-b border-base-700">
          No zone coordinates provided by backend — showing an abstract relative layout.
        </div>
      )}
      <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {state.roads.map((road) => {
          const from = locationByName.get(road.source);
          const to = locationByName.get(road.destination);
          if (!from || !to) return null;
          return (
            <Polyline
              key={road.id}
              positions={[from, to]}
              pathOptions={{ color: roadColor(road.status), weight: road.status === "BLOCKED" ? 4 : 2, dashArray: road.status === "BLOCKED" ? "6 6" : undefined }}
            >
              <Tooltip>
                {road.source} to {road.destination} — {road.status} ({road.distance_km}km, risk {road.risk})
              </Tooltip>
            </Polyline>
          );
        })}

        {/* The agent's live plan. Redrawn from state, so a replan visibly moves the route. */}
        {activeRoutes.map(({ assignment, segments }) =>
          segments.map((positions, i) => (
            <Polyline
              key={`route-${assignment.victim_id}-${i}`}
              positions={positions}
              pathOptions={{ color: "#22d3ee", weight: 5, opacity: 0.75 }}
            >
              <Tooltip>
                Active route — {assignment.victim_id} via {assignment.resource_id} to{" "}
                {assignment.dest_id} (ETA {assignment.eta_min} min)
              </Tooltip>
            </Polyline>
          )),
        )}

        {state.hospitals.map((h) => (
          <Marker key={h.id} position={locate(h.id, h.location, 0)} icon={icons.hospital}>
            <Popup>
              <b>{zoneNames.get(h.location) ?? h.location}</b> (Hospital {h.id})
              <br />
              Occupancy: {h.occupancy}/{h.capacity}
              <br />
              Capabilities: {h.capabilities.join(", ") || "—"}
            </Popup>
          </Marker>
        ))}

        {state.shelters.map((s) => (
          <Marker key={s.id} position={locate(s.id, s.location, 0)} icon={icons.shelter}>
            <Popup>
              <b>{zoneNames.get(s.location) ?? s.location}</b> (Shelter {s.id})
              <br />
              Occupancy: {s.occupancy}/{s.capacity}
            </Popup>
          </Marker>
        ))}

        {state.vehicles.map((v) => (
          <Marker key={v.id} position={locate(v.id, v.location, 1)} icon={icons.vehicle}>
            <Popup>
              <b>{v.id}</b> ({v.type})
              <br />
              Status: {v.status}
              <br />
              Location: {zoneNames.get(v.location) ?? v.location}
              {v.current_assignment && (
                <>
                  <br />
                  Assigned: {v.current_assignment}
                </>
              )}
            </Popup>
          </Marker>
        ))}

        {state.victims.map((v) => (
          <CircleMarker
            key={v.id}
            center={locate(v.id, v.location, 2)}
            radius={7}
            pathOptions={{
              color: "white",
              weight: 1,
              fillColor: v.severity === "CRITICAL" ? "#ef4444" : v.severity === "HIGH" ? "#f59e0b" : "#38bdf8",
              fillOpacity: 0.9,
            }}
          >
            <Popup>
              <b>{v.id}</b> — {v.severity}
              <br />
              {v.people_count} people at {zoneNames.get(v.location) ?? v.location}
              <br />
              Status: {v.status}
              {v.assigned_resource && (
                <>
                  <br />
                  Assigned: {v.assigned_resource}
                </>
              )}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

export function MapLegend() {
  const items: { label: string; color: string }[] = [
    { label: "Critical victim", color: "#ef4444" },
    { label: "High severity victim", color: "#f59e0b" },
    { label: "Other victim", color: "#38bdf8" },
    { label: "Vehicle", color: "#22c55e" },
    { label: "Hospital", color: "#a855f7" },
    { label: "Shelter", color: "#eab308" },
  ];
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-400">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export type { Hospital, Shelter, Vehicle, Victim };

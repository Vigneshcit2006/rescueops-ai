import { NavLink, Outlet } from "react-router-dom";
import { useMission } from "../context/MissionContext";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/map", label: "Map" },
  { to: "/agent", label: "Agent" },
  { to: "/decisions", label: "Decisions" },
  { to: "/evidence", label: "Evidence" },
  { to: "/resources", label: "Resources" },
  { to: "/simulation", label: "Simulation" },
  { to: "/analytics", label: "Analytics" },
  { to: "/settings", label: "Settings" },
];

export function Layout() {
  const { missionId } = useMission();

  return (
    <div className="min-h-screen flex flex-col bg-base-900">
      <header className="border-b border-base-700 bg-base-850/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 h-14 flex items-center gap-6">
          <NavLink to="/" className="flex items-center gap-2 shrink-0">
            <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_2px_rgba(59,130,246,0.6)]" />
            <span className="font-bold tracking-wide text-slate-50 text-sm">
              RESCUEOPS <span className="text-accent">AI</span>
            </span>
          </NavLink>

          {missionId ? (
            <nav className="flex items-center gap-1 overflow-x-auto text-sm">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to === "/dashboard" ? `/dashboard/${missionId}` : item.to}
                  className={({ isActive }) =>
                    `px-2.5 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                      isActive
                        ? "bg-accent/15 text-accent"
                        : "text-slate-400 hover:text-slate-200 hover:bg-base-700"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          ) : (
            <span className="text-xs text-slate-500">No active mission — launch one from the home page</span>
          )}

          <div className="ml-auto flex items-center gap-2 shrink-0">
            {missionId && (
              <span className="text-[11px] font-mono text-slate-500 bg-base-800 border border-base-700 rounded px-2 py-1">
                mission: {missionId.slice(0, 12)}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-base-700 py-3 text-center text-[11px] text-slate-600">
        Simulation and decision-support prototype — not an autonomous emergency dispatch system.
      </footer>
    </div>
  );
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "rescueops.missionId";

interface MissionContextValue {
  missionId: string | null;
  setMissionId: (id: string | null) => void;
}

const MissionContext = createContext<MissionContextValue | undefined>(undefined);

export function MissionProvider({ children }: { children: ReactNode }) {
  const [missionId, setMissionIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const setMissionId = useCallback((id: string | null) => {
    setMissionIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage errors (private mode, etc.)
    }
  }, []);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setMissionIdState(e.newValue);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(() => ({ missionId, setMissionId }), [missionId, setMissionId]);

  return <MissionContext.Provider value={value}>{children}</MissionContext.Provider>;
}

export function useMission(): MissionContextValue {
  const ctx = useContext(MissionContext);
  if (!ctx) throw new Error("useMission must be used within a MissionProvider");
  return ctx;
}

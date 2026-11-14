import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiRequestError } from "../lib/api";
import type { MissionState } from "../types";

interface UseMissionStateResult {
  state: MissionState | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Polls GET /api/missions/:id/state every `intervalMs` while `active` is true.
 * Always hits the real API; callers may fall back to a mock fixture on error
 * for local dev preview (see src/lib/mockState.ts).
 */
export function useMissionState(
  missionId: string | null | undefined,
  intervalMs: number = 2000,
  active: boolean = true
): UseMissionStateResult {
  const [state, setState] = useState<MissionState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!missionId) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.getMissionState(missionId);
      setState(data);
      setError(null);
    } catch (err) {
      const message =
        err instanceof ApiRequestError
          ? `${err.message}${err.detail ? ` — ${err.detail}` : ""}`
          : err instanceof Error
          ? err.message
          : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [missionId]);

  useEffect(() => {
    setLoading(true);
    fetchOnce();
    if (!active || !missionId) return;
    timerRef.current = setInterval(fetchOnce, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchOnce, intervalMs, active, missionId]);

  return { state, loading, error, refresh: fetchOnce };
}

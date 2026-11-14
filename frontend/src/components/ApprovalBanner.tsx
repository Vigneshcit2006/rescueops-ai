import { useState } from "react";
import { api, ApiRequestError } from "../lib/api";
import type { Approval } from "../types";
import { RiskBadge } from "./StatusBadge";

export function ApprovalBanner({
  approvals,
  missionId,
  onChanged,
}: {
  approvals: Approval[];
  missionId: string;
  onChanged?: () => void;
}) {
  const pending = approvals.filter((a) => a.status === "PENDING");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (pending.length === 0) return null;

  async function handle(approval: Approval, action: "approve" | "reject") {
    setBusyId(approval.id);
    setError(null);
    try {
      if (action === "approve") await api.approve(approval.id, missionId);
      else await api.reject(approval.id, missionId);
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {pending.map((approval) => (
        <div
          key={approval.id}
          className="rounded-md border border-status-risk/40 bg-status-risk/10 px-4 py-3 flex flex-col md:flex-row md:items-center gap-3"
        >
          <div className="flex items-center gap-2">
            <span className="badge bg-status-risk/20 text-status-risk border border-status-risk/40">
              Approval pending
            </span>
            <RiskBadge risk={approval.risk_level} />
          </div>
          <p className="text-sm text-slate-200 flex-1">{approval.summary}</p>
          <div className="flex gap-2 shrink-0">
            <button
              className="btn-primary"
              disabled={busyId === approval.id}
              onClick={() => handle(approval, "approve")}
            >
              {busyId === approval.id ? "..." : "Approve"}
            </button>
            <button
              className="btn-danger"
              disabled={busyId === approval.id}
              onClick={() => handle(approval, "reject")}
            >
              {busyId === approval.id ? "..." : "Reject"}
            </button>
          </div>
        </div>
      ))}
      {error && <p className="text-status-critical text-xs">{error}</p>}
    </div>
  );
}

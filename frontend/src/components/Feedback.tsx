export function LoadingBlock({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-slate-500 text-sm gap-2">
      <span className="h-3 w-3 rounded-full bg-accent animate-pulse" />
      {label}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-status-critical/30 bg-status-critical/10 text-status-critical text-sm px-4 py-3">
      <span className="font-semibold">API error: </span>
      {message}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-1">
      <span className="text-slate-300 font-medium">{title}</span>
      {hint && <span className="text-slate-500 text-sm">{hint}</span>}
    </div>
  );
}

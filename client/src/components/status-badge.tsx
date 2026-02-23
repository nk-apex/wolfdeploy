import type { DeploymentStatus } from "@shared/schema";

const STATUS_CONFIG: Record<DeploymentStatus, { label: string; color: string; dot: string }> = {
  queued: {
    label: "QUEUED",
    color: "text-yellow-400 bg-yellow-400/10 border-yellow-500/20",
    dot: "bg-yellow-400",
  },
  deploying: {
    label: "DEPLOYING",
    color: "text-blue-400 bg-blue-400/10 border-blue-500/20",
    dot: "bg-blue-400 animate-pulse",
  },
  running: {
    label: "RUNNING",
    color: "text-primary bg-primary/10 border-primary/20",
    dot: "bg-primary animate-pulse",
  },
  stopped: {
    label: "STOPPED",
    color: "text-gray-500 bg-gray-500/10 border-gray-500/20",
    dot: "bg-gray-500",
  },
  failed: {
    label: "FAILED",
    color: "text-red-400 bg-red-400/10 border-red-500/20",
    dot: "bg-red-400",
  },
};

export function StatusBadge({ status }: { status: DeploymentStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[9px] font-mono font-bold tracking-widest uppercase ${cfg.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} flex-shrink-0`} />
      {cfg.label}
    </span>
  );
}

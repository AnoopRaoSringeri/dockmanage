import { ContainerSummary } from "@dockmanage/types";

interface StatusBadgeProps {
  status: ContainerSummary["status"];
}

const statusClassMap: Record<ContainerSummary["status"], string> = {
  running: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  stopped: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  restarting: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  unknown: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
};

export const StatusBadge = ({ status }: StatusBadgeProps) => (
  <span className={`inline-flex rounded-md border px-2 py-1 text-xs capitalize ${statusClassMap[status]}`}>
    {status}
  </span>
);

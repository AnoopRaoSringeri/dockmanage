import { ContainerSummary } from "@dockmanage/types";
import { StatusBadge } from "./status-badge";

interface ContainersTableProps {
  containers: ContainerSummary[];
  busyId: string | null;
  onAction: (id: string, action: "start" | "stop" | "restart") => void;
}

export const ContainersTable = ({ containers, busyId, onAction }: ContainersTableProps) => {
  if (!containers.length) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-300">
        No containers found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-zinc-800 text-zinc-400">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Image</th>
            <th className="px-4 py-3 font-medium">State</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {containers.map((container) => {
            const isBusy = busyId === container.id;

            return (
              <tr key={container.id} className="border-b border-zinc-800/70 last:border-0">
                <td className="px-4 py-3 text-zinc-100">{container.name}</td>
                <td className="px-4 py-3 text-zinc-300">{container.image}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={container.status} />
                </td>
                <td className="px-4 py-3 text-zinc-400">{container.statusText}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onAction(container.id, "start")}
                      className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Start
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onAction(container.id, "stop")}
                      className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Stop
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onAction(container.id, "restart")}
                      className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Restart
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

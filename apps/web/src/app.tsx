import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ConfigEditor } from "./components/config-editor";
import { ContainersTable } from "./components/containers-table";
import { fetchContainers, runContainerAction } from "./lib/api-client";

type ContainerAction = "start" | "stop" | "restart";

export const App = () => {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const containersQuery = useQuery({
    queryKey: ["containers"],
    queryFn: fetchContainers,
    refetchInterval: 5000,
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: ContainerAction }) => runContainerAction(id, action),
    onMutate: ({ id, action }) => {
      setBusyId(id);
      setMessage(`Running "${action}"...`);
    },
    onSuccess: () => {
      setMessage("Action completed successfully.");
      void queryClient.invalidateQueries({ queryKey: ["containers"] });
    },
    onError: (error: Error) => {
      setMessage(error.message);
    },
    onSettled: () => {
      setBusyId(null);
    },
  });

  const lastUpdatedAt = useMemo(() => {
    if (!containersQuery.dataUpdatedAt) {
      return "Not synced yet";
    }

    return new Date(containersQuery.dataUpdatedAt).toLocaleTimeString();
  }, [containersQuery.dataUpdatedAt]);

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 p-6">
      <header className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">DockManage</h1>
          <p className="text-sm text-zinc-400">Lightweight Docker service manager</p>
        </div>
        <div className="text-sm text-zinc-400">Last sync: {lastUpdatedAt}</div>
      </header>

      {message ? (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">{message}</div>
      ) : null}

      {containersQuery.isLoading ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-300">Loading containers...</div>
      ) : null}

      {containersQuery.isError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-300">
          {(containersQuery.error as Error).message}
        </div>
      ) : null}

      {containersQuery.data ? (
        <ContainersTable
          containers={containersQuery.data}
          busyId={busyId}
          onAction={(id, action) => actionMutation.mutate({ id, action })}
        />
      ) : null}

      <ConfigEditor />
    </main>
  );
};

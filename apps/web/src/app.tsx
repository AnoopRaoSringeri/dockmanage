import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfigEditor } from "./components/config-editor";
import { ContainersTable } from "./components/containers-table";
import { checkForUpdate, fetchContainers, openContainerLogStream, performUpdate, runContainerAction } from "./lib/api-client";
import { UpdateResult, UpdateStatus } from "@dockmanage/types";

type ContainerAction = "start" | "stop" | "restart";

export const App = () => {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [selectedLogs, setSelectedLogs] = useState<string | null>(null);
  const [logSource, setLogSource] = useState<EventSource | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [releaseUrl, setReleaseUrl] = useState<string | null>(null);
  const [updateCheckError, setUpdateCheckError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateOutput, setUpdateOutput] = useState<string | null>(null);

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

  useEffect(() => {
    let didCancel = false;

    const loadUpdateInfo = async () => {
      try {
        const updateInfo = await checkForUpdate();
        if (didCancel) {
          return;
        }

        setUpdateAvailable(updateInfo.updateAvailable);
        setLatestVersion(updateInfo.latestVersion);
        setReleaseUrl(updateInfo.releaseUrl);
      } catch (error) {
        if (!didCancel) {
          setUpdateCheckError((error as Error).message);
        }
      }
    };

    void loadUpdateInfo();

    return () => {
      didCancel = true;
    };
  }, []);

  const handlePerformUpdate = async () => {
    setIsUpdating(true);
    setUpdateOutput(null);
    setUpdateCheckError(null);

    try {
      const result = await performUpdate();
      setUpdateAvailable(false);
      setLatestVersion(result.latestVersion);
      setReleaseUrl(result.releaseUrl);
      setUpdateOutput(result.output);
    } catch (error) {
      setUpdateCheckError((error as Error).message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleViewLogs = (id: string) => {
    setSelectedLogId(id);
    setSelectedLogs("");
    setLogsError(null);
    setLogsLoading(true);

    if (logSource) {
      logSource.close();
    }

    const source = openContainerLogStream(
      id,
      (line) => {
        setSelectedLogs((previous) => (previous ? `${previous}\n${line}` : line));
        setLogsLoading(false);
      },
      (errorMessage) => {
        setLogsError(errorMessage);
        setLogsLoading(false);
      },
    );

    source.onopen = () => {
      setLogsLoading(false);
    };

    setLogSource(source);
  };

  const closeLogs = () => {
    setSelectedLogId(null);
    setSelectedLogs(null);
    setLogsError(null);
    setLogsLoading(false);
    if (logSource) {
      logSource.close();
      setLogSource(null);
    }
  };

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

      {updateAvailable && latestVersion && releaseUrl ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              A new DockManage version is available: <strong>v{latestVersion}</strong>.
              <a href={releaseUrl} target="_blank" rel="noreferrer" className="ml-2 underline">
                View release
              </a>
            </div>
            <button
              type="button"
              onClick={handlePerformUpdate}
              disabled={isUpdating}
              className="rounded-md border border-emerald-500 px-3 py-1.5 text-emerald-100 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUpdating ? "Updating..." : "Update now"}
            </button>
          </div>
          {updateOutput ? (
            <pre className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-emerald-500/50 bg-emerald-950 p-3 text-xs text-emerald-100">
              {updateOutput}
            </pre>
          ) : null}
        </div>
      ) : null}

      {updateCheckError ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Update check failed: {updateCheckError}
        </div>
      ) : null}

      {containersQuery.isLoading ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-300">Loading containers...</div>
      ) : null}

      {containersQuery.data ? (
        <>
          <ContainersTable
            containers={containersQuery.data}
            busyId={busyId}
            onAction={(id, action) => actionMutation.mutate({ id, action })}
            onViewLogs={handleViewLogs}
          />

          {selectedLogId ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">Container logs</h2>
                  <p className="text-sm text-zinc-400">{selectedLogId}</p>
                </div>
                <button
                  type="button"
                  onClick={closeLogs}
                  className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800"
                >
                  Close
                </button>
              </div>

              {logsLoading ? (
                <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-6 text-sm text-zinc-300">Loading logs...</div>
              ) : logsError ? (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-300">{logsError}</div>
              ) : (
                <pre className="max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-200">
                  {selectedLogs ?? "No logs loaded."}
                </pre>
              )}
            </div>
          ) : null}
        </>
      ) : null}

      <ConfigEditor />
    </main>
  );
};

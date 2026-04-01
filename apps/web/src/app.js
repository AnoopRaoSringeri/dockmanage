import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfigEditor } from "./components/config-editor";
import { ContainersTable } from "./components/containers-table";
import { checkForUpdate, fetchContainerLogs, fetchContainers, openContainerLogStream, performUpdate, pruneStoppedContainers, pruneUnusedImages, runContainerAction, } from "./lib/api-client";
export const App = () => {
    const queryClient = useQueryClient();
    const [busyId, setBusyId] = useState(null);
    const [message, setMessage] = useState(null);
    const [selectedLogId, setSelectedLogId] = useState(null);
    const [selectedLogs, setSelectedLogs] = useState(null);
    const [logSource, setLogSource] = useState(null);
    const [logsLoading, setLogsLoading] = useState(false);
    const [logsError, setLogsError] = useState(null);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [latestVersion, setLatestVersion] = useState(null);
    const [releaseUrl, setReleaseUrl] = useState(null);
    const [updateCheckError, setUpdateCheckError] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateOutput, setUpdateOutput] = useState(null);
    const containersQuery = useQuery({
        queryKey: ["containers"],
        queryFn: fetchContainers,
        refetchInterval: 5000,
    });
    const actionMutation = useMutation({
        mutationFn: ({ id, action }) => runContainerAction(id, action),
        onMutate: ({ id, action }) => {
            setBusyId(id);
            setMessage(`Running "${action}"...`);
        },
        onSuccess: () => {
            setMessage("Action completed successfully.");
            void queryClient.invalidateQueries({ queryKey: ["containers"] });
        },
        onError: (error) => {
            setMessage(error.message);
        },
        onSettled: () => {
            setBusyId(null);
        },
    });
    const pruneImagesMutation = useMutation({
        mutationFn: () => pruneUnusedImages(),
        onMutate: () => {
            setMessage("Pruning unused images...");
        },
        onSuccess: (result) => {
            const deleted = result.ImagesDeleted?.length ?? 0;
            const reclaimed = result.SpaceReclaimed ?? 0;
            setMessage(`Pruned ${deleted} images and reclaimed ${reclaimed} bytes.`);
            void queryClient.invalidateQueries({ queryKey: ["containers"] });
        },
        onError: (error) => {
            setMessage(error.message);
        },
    });
    const pruneContainersMutation = useMutation({
        mutationFn: () => pruneStoppedContainers(),
        onMutate: () => {
            setMessage("Pruning stopped containers...");
        },
        onSuccess: (result) => {
            const deleted = result.ContainersDeleted?.length ?? 0;
            const reclaimed = result.SpaceReclaimed ?? 0;
            setMessage(`Removed ${deleted} stopped containers and reclaimed ${reclaimed} bytes.`);
            void queryClient.invalidateQueries({ queryKey: ["containers"] });
        },
        onError: (error) => {
            setMessage(error.message);
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
            }
            catch (error) {
                if (!didCancel) {
                    setUpdateCheckError(error.message);
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
        }
        catch (error) {
            setUpdateCheckError(error.message);
        }
        finally {
            setIsUpdating(false);
        }
    };
    const loadLogsSnapshot = async (id, fallbackMessage) => {
        if (fallbackMessage) {
            setLogsError(fallbackMessage);
        }
        setLogsLoading(true);
        setSelectedLogs("");
        try {
            const logs = await fetchContainerLogs(id);
            setSelectedLogs(logs || "No logs available.");
            setLogsError(null);
        }
        catch (error) {
            setLogsError(error.message);
        }
        finally {
            setLogsLoading(false);
        }
    };
    const handleViewLogs = (id) => {
        setSelectedLogId(id);
        setSelectedLogs("");
        setLogsError(null);
        setLogsLoading(true);
        if (logSource) {
            logSource.close();
        }
        let streamOpened = false;
        const fallbackTimer = window.setTimeout(() => {
            if (!streamOpened) {
                void loadLogsSnapshot(id, "Live log stream did not open, loading log snapshot...");
            }
        }, 2500);
        const source = openContainerLogStream(id, (line) => {
            streamOpened = true;
            clearTimeout(fallbackTimer);
            setSelectedLogs((previous) => (previous ? `${previous}\n${line}` : line));
            setLogsLoading(false);
        }, (errorMessage) => {
            clearTimeout(fallbackTimer);
            setLogsError(errorMessage);
            setLogsLoading(true);
            void loadLogsSnapshot(id, "Live log stream failed, loading log snapshot...");
        });
        source.onopen = () => {
            streamOpened = true;
            clearTimeout(fallbackTimer);
            setLogsLoading(false);
            setLogsError(null);
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
    return (_jsxs("main", { className: "mx-auto flex min-h-screen max-w-7xl flex-col gap-4 p-6", children: [_jsxs("header", { className: "flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold text-zinc-100", children: "DockManage" }), _jsx("p", { className: "text-sm text-zinc-400", children: "Lightweight Docker service manager" })] }), _jsxs("div", { className: "text-sm text-zinc-400", children: ["Last sync: ", lastUpdatedAt] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "button", onClick: () => pruneImagesMutation.mutate(), disabled: pruneImagesMutation.isPending, className: "rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60", children: pruneImagesMutation.isPending ? "Pruning images..." : "Prune unused images" }), _jsx("button", { type: "button", onClick: () => pruneContainersMutation.mutate(), disabled: pruneContainersMutation.isPending, className: "rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60", children: pruneContainersMutation.isPending ? "Pruning containers..." : "Prune stopped containers" })] })] }), message ? (_jsx("div", { className: "rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300", children: message })) : null, updateAvailable && latestVersion && releaseUrl ? (_jsxs("div", { className: "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100", children: [_jsxs("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { children: ["A new DockManage version is available: ", _jsxs("strong", { children: ["v", latestVersion] }), ".", _jsx("a", { href: releaseUrl, target: "_blank", rel: "noreferrer", className: "ml-2 underline", children: "View release" })] }), _jsx("button", { type: "button", onClick: handlePerformUpdate, disabled: isUpdating, className: "rounded-md border border-emerald-500 px-3 py-1.5 text-emerald-100 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60", children: isUpdating ? "Updating..." : "Update now" })] }), updateOutput ? (_jsx("pre", { className: "mt-3 max-h-48 overflow-y-auto rounded-xl border border-emerald-500/50 bg-emerald-950 p-3 text-xs text-emerald-100", children: updateOutput })) : null] })) : null, updateCheckError ? (_jsxs("div", { className: "rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100", children: ["Update check failed: ", updateCheckError] })) : null, containersQuery.isLoading ? (_jsx("div", { className: "rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-300", children: "Loading containers..." })) : null, containersQuery.data ? (_jsxs(_Fragment, { children: [_jsx(ContainersTable, { containers: containersQuery.data, busyId: busyId, onAction: (id, action) => actionMutation.mutate({ id, action }), onViewLogs: handleViewLogs }), selectedLogId ? (_jsxs("div", { className: "rounded-xl border border-zinc-800 bg-zinc-900 p-4", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-zinc-100", children: "Container logs" }), _jsx("p", { className: "text-sm text-zinc-400", children: selectedLogId })] }), _jsx("button", { type: "button", onClick: closeLogs, className: "rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800", children: "Close" })] }), logsLoading ? (_jsx("div", { className: "rounded-xl border border-zinc-700 bg-zinc-950 p-6 text-sm text-zinc-300", children: "Loading logs..." })) : logsError ? (_jsx("div", { className: "rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-300", children: logsError })) : (_jsx("pre", { className: "max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-200", children: selectedLogs ?? "No logs loaded." }))] })) : null] })) : null, _jsx(ConfigEditor, {})] }));
};

import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ConfigEditor } from "./components/config-editor";
import { ContainersTable } from "./components/containers-table";
import { fetchContainers, fetchContainerLogs, runContainerAction } from "./lib/api-client";
export const App = () => {
    const queryClient = useQueryClient();
    const [busyId, setBusyId] = useState(null);
    const [message, setMessage] = useState(null);
    const [selectedLogId, setSelectedLogId] = useState(null);
    const [selectedLogs, setSelectedLogs] = useState(null);
    const [logsLoading, setLogsLoading] = useState(false);
    const [logsError, setLogsError] = useState(null);
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
    const lastUpdatedAt = useMemo(() => {
        if (!containersQuery.dataUpdatedAt) {
            return "Not synced yet";
        }
        return new Date(containersQuery.dataUpdatedAt).toLocaleTimeString();
    }, [containersQuery.dataUpdatedAt]);
    const handleViewLogs = async (id) => {
        setSelectedLogId(id);
        setSelectedLogs(null);
        setLogsError(null);
        setLogsLoading(true);
        try {
            const logs = await fetchContainerLogs(id);
            setSelectedLogs(logs || "(no logs available)");
        }
        catch (error) {
            setLogsError(error.message);
        }
        finally {
            setLogsLoading(false);
        }
    };
    const closeLogs = () => {
        setSelectedLogId(null);
        setSelectedLogs(null);
        setLogsError(null);
        setLogsLoading(false);
    };
    return (_jsxs("main", { className: "mx-auto flex min-h-screen max-w-7xl flex-col gap-4 p-6", children: [_jsxs("header", { className: "flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold text-zinc-100", children: "DockManage" }), _jsx("p", { className: "text-sm text-zinc-400", children: "Lightweight Docker service manager" })] }), _jsxs("div", { className: "text-sm text-zinc-400", children: ["Last sync: ", lastUpdatedAt] })] }), message ? (_jsx("div", { className: "rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300", children: message })) : null, containersQuery.isLoading ? (_jsx("div", { className: "rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-300", children: "Loading containers..." })) : null, containersQuery.isError ? (_jsx("div", { className: "rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-300", children: containersQuery.error.message })) : null, containersQuery.data ? (_jsxs(_Fragment, { children: [_jsx(ContainersTable, { containers: containersQuery.data, busyId: busyId, onAction: (id, action) => actionMutation.mutate({ id, action }), onViewLogs: handleViewLogs }), selectedLogId ? (_jsxs("div", { className: "rounded-xl border border-zinc-800 bg-zinc-900 p-4", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-zinc-100", children: "Container logs" }), _jsx("p", { className: "text-sm text-zinc-400", children: selectedLogId })] }), _jsx("button", { type: "button", onClick: closeLogs, className: "rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800", children: "Close" })] }), logsLoading ? (_jsx("div", { className: "rounded-xl border border-zinc-700 bg-zinc-950 p-6 text-sm text-zinc-300", children: "Loading logs..." })) : logsError ? (_jsx("div", { className: "rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-300", children: logsError })) : (_jsx("pre", { className: "max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-200", children: selectedLogs ?? "No logs loaded." }))] })) : null] })) : null, _jsx(ConfigEditor, {})] }));
};

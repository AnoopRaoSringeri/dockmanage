import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ContainersTable } from "./components/containers-table";
import { fetchContainers, runContainerAction } from "./lib/api-client";
export const App = () => {
    const queryClient = useQueryClient();
    const [busyId, setBusyId] = useState(null);
    const [message, setMessage] = useState(null);
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
    return (_jsxs("main", { className: "mx-auto flex min-h-screen max-w-7xl flex-col gap-4 p-6", children: [_jsxs("header", { className: "flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold text-zinc-100", children: "DockManage" }), _jsx("p", { className: "text-sm text-zinc-400", children: "Lightweight Docker service manager" })] }), _jsxs("div", { className: "text-sm text-zinc-400", children: ["Last sync: ", lastUpdatedAt] })] }), message ? (_jsx("div", { className: "rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300", children: message })) : null, containersQuery.isLoading ? (_jsx("div", { className: "rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-300", children: "Loading containers..." })) : null, containersQuery.isError ? (_jsx("div", { className: "rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-300", children: containersQuery.error.message })) : null, containersQuery.data ? (_jsx(ContainersTable, { containers: containersQuery.data, busyId: busyId, onAction: (id, action) => actionMutation.mutate({ id, action }) })) : null] }));
};

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { deleteConfigFile, fetchConfigFileContent, fetchConfigFiles, saveConfigFileContent, } from "../lib/api-client";
const isValidConfigPath = (value) => /^[a-zA-Z0-9._/\-]+\.(yml|yaml)$/.test(value);
export const ConfigEditor = () => {
    const queryClient = useQueryClient();
    const [selectedPath, setSelectedPath] = useState("");
    const [draftPath, setDraftPath] = useState("");
    const [editorText, setEditorText] = useState("");
    const [message, setMessage] = useState(null);
    const filesQuery = useQuery({
        queryKey: ["config-files"],
        queryFn: fetchConfigFiles,
    });
    const contentQuery = useQuery({
        queryKey: ["config-file-content", selectedPath],
        queryFn: () => fetchConfigFileContent(selectedPath),
        enabled: Boolean(selectedPath),
    });
    useEffect(() => {
        if (!selectedPath && filesQuery.data?.length) {
            const first = filesQuery.data[0];
            setSelectedPath(first.path);
            setDraftPath(first.path);
        }
    }, [filesQuery.data, selectedPath]);
    useEffect(() => {
        if (contentQuery.data) {
            setEditorText(contentQuery.data.content);
            setDraftPath(contentQuery.data.path);
        }
    }, [contentQuery.data]);
    const saveMutation = useMutation({
        mutationFn: saveConfigFileContent,
        onSuccess: (result) => {
            setMessage(`Saved ${result.path}`);
            setSelectedPath(result.path);
            setDraftPath(result.path);
            void queryClient.invalidateQueries({ queryKey: ["config-files"] });
            void queryClient.invalidateQueries({ queryKey: ["config-file-content", result.path] });
        },
        onError: (error) => {
            setMessage(error.message);
        },
    });
    const deleteMutation = useMutation({
        mutationFn: deleteConfigFile,
        onSuccess: async () => {
            setMessage(`Deleted ${selectedPath}`);
            setSelectedPath("");
            setDraftPath("");
            setEditorText("");
            await queryClient.invalidateQueries({ queryKey: ["config-files"] });
            await queryClient.invalidateQueries({ queryKey: ["config-file-content", selectedPath] });
        },
        onError: (error) => {
            setMessage(error.message);
        },
    });
    const canSave = useMemo(() => isValidConfigPath(draftPath) && !saveMutation.isPending, [draftPath, saveMutation.isPending]);
    return (_jsxs("section", { className: "flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-semibold text-zinc-100", children: "YAML Config Editor" }), _jsx("button", { type: "button", onClick: () => void queryClient.invalidateQueries({ queryKey: ["config-files"] }), className: "rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800", children: "Refresh files" })] }), _jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm text-zinc-300", children: ["Existing config files", _jsxs("select", { value: selectedPath, onChange: (event) => {
                                    setSelectedPath(event.target.value);
                                    setDraftPath(event.target.value);
                                }, className: "rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100", children: [_jsx("option", { value: "", children: "Select a file" }), filesQuery.data?.map((file) => (_jsx("option", { value: file.path, children: file.path }, file.path)))] })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-zinc-300", children: ["File path to save", _jsx("input", { value: draftPath, onChange: (event) => setDraftPath(event.target.value.trim()), placeholder: "services/app-compose.yml", className: "rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100" })] })] }), _jsxs("label", { className: "flex flex-col gap-1 text-sm text-zinc-300", children: ["YAML content", _jsx("textarea", { value: editorText, onChange: (event) => setEditorText(event.target.value), rows: 20, spellCheck: false, className: "w-full rounded-md border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-100" })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx("button", { type: "button", disabled: !canSave, onClick: () => saveMutation.mutate({ path: draftPath, content: editorText }), className: "rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60", children: saveMutation.isPending ? "Saving..." : "Save YAML" }), _jsx("button", { type: "button", disabled: !selectedPath || deleteMutation.isPending, onClick: () => selectedPath && deleteMutation.mutate(selectedPath), className: "rounded-md border border-red-500 px-3 py-1.5 text-red-100 hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60", children: deleteMutation.isPending ? "Deleting..." : "Delete YAML" }), !isValidConfigPath(draftPath) ? (_jsx("span", { className: "text-xs text-amber-300", children: "Path must end with .yml or .yaml" })) : null] }), filesQuery.isLoading ? _jsx("p", { className: "text-sm text-zinc-400", children: "Loading config files..." }) : null, contentQuery.isFetching ? _jsx("p", { className: "text-sm text-zinc-400", children: "Loading file content..." }) : null, message ? _jsx("p", { className: "text-sm text-zinc-300", children: message }) : null] }));
};

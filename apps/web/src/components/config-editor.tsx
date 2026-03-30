import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  fetchConfigFileContent,
  fetchConfigFiles,
  saveConfigFileContent,
} from "../lib/api-client";

const isValidConfigPath = (value: string): boolean => /^[a-zA-Z0-9._/\-]+\.(yml|yaml)$/.test(value);

export const ConfigEditor = () => {
  const queryClient = useQueryClient();
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [draftPath, setDraftPath] = useState<string>("");
  const [editorText, setEditorText] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);

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
    onError: (error: Error) => {
      setMessage(error.message);
    },
  });

  const canSave = useMemo(
    () => isValidConfigPath(draftPath) && !saveMutation.isPending,
    [draftPath, saveMutation.isPending],
  );

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">YAML Config Editor</h2>
        <button
          type="button"
          onClick={() => void queryClient.invalidateQueries({ queryKey: ["config-files"] })}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          Refresh files
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-zinc-300">
          Existing config files
          <select
            value={selectedPath}
            onChange={(event) => {
              setSelectedPath(event.target.value);
              setDraftPath(event.target.value);
            }}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          >
            <option value="">Select a file</option>
            {filesQuery.data?.map((file) => (
              <option key={file.path} value={file.path}>
                {file.path}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-300">
          File path to save
          <input
            value={draftPath}
            onChange={(event) => setDraftPath(event.target.value.trim())}
            placeholder="services/app-compose.yml"
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm text-zinc-300">
        YAML content
        <textarea
          value={editorText}
          onChange={(event) => setEditorText(event.target.value)}
          rows={20}
          spellCheck={false}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-100"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!canSave}
          onClick={() => saveMutation.mutate({ path: draftPath, content: editorText })}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saveMutation.isPending ? "Saving..." : "Save YAML"}
        </button>
        {!isValidConfigPath(draftPath) ? (
          <span className="text-xs text-amber-300">Path must end with .yml or .yaml</span>
        ) : null}
      </div>

      {filesQuery.isLoading ? <p className="text-sm text-zinc-400">Loading config files...</p> : null}
      {contentQuery.isFetching ? <p className="text-sm text-zinc-400">Loading file content...</p> : null}
      {message ? <p className="text-sm text-zinc-300">{message}</p> : null}
    </section>
  );
};

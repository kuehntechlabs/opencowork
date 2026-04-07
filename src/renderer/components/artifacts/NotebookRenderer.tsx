import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "../chat/CodeBlock";

interface Props {
  filePath: string;
}

interface NotebookCell {
  cell_type: "code" | "markdown" | "raw";
  source: string[] | string;
  outputs?: CellOutput[];
  execution_count?: number | null;
}

interface CellOutput {
  output_type: "stream" | "execute_result" | "display_data" | "error";
  text?: string[] | string;
  data?: Record<string, string[] | string>;
  name?: string;
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

interface Notebook {
  cells: NotebookCell[];
  metadata?: {
    kernelspec?: { language?: string; display_name?: string };
    language_info?: { name?: string };
  };
}

function joinSource(src: string[] | string): string {
  return Array.isArray(src) ? src.join("") : src;
}

function joinText(txt: string[] | string | undefined): string {
  if (!txt) return "";
  return Array.isArray(txt) ? txt.join("") : txt;
}

function CellOutputDisplay({ output }: { output: CellOutput }) {
  if (output.output_type === "stream") {
    return (
      <pre className="overflow-auto rounded bg-surface-secondary p-2 font-mono text-[11px] text-text-secondary">
        {joinText(output.text)}
      </pre>
    );
  }

  if (output.output_type === "error") {
    const traceback = output.traceback?.join("\n") ?? output.evalue ?? "";
    // Strip ANSI escape codes
    const clean = traceback.replace(/\x1b\[[0-9;]*m/g, "");
    return (
      <pre className="overflow-auto rounded bg-red-500/10 p-2 font-mono text-[11px] text-red-400">
        {output.ename}: {output.evalue}
        {"\n"}
        {clean}
      </pre>
    );
  }

  if (
    output.output_type === "execute_result" ||
    output.output_type === "display_data"
  ) {
    const data = output.data;
    if (!data) return null;

    // Prefer image
    if (data["image/png"]) {
      const base64 = joinText(data["image/png"]);
      return (
        <img
          src={`data:image/png;base64,${base64}`}
          alt="Output"
          className="max-w-full rounded"
        />
      );
    }

    // HTML output in sandboxed iframe
    if (data["text/html"]) {
      const html = joinText(data["text/html"]);
      return (
        <iframe
          srcDoc={html}
          sandbox="allow-scripts"
          className="w-full rounded border border-border bg-white"
          style={{ minHeight: 100 }}
          title="Cell output"
        />
      );
    }

    // Plain text fallback
    if (data["text/plain"]) {
      return (
        <pre className="overflow-auto rounded bg-surface-secondary p-2 font-mono text-[11px] text-text-secondary">
          {joinText(data["text/plain"])}
        </pre>
      );
    }
  }

  return null;
}

export function NotebookRenderer({ filePath }: Props) {
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    window.api
      .readSkillFile(filePath)
      .then((result) => {
        if (cancelled) return;
        if (!result || result.type !== "text") {
          setError("Could not read notebook file");
          return;
        }
        try {
          const nb = JSON.parse(result.content) as Notebook;
          setNotebook(nb);
        } catch {
          setError("Invalid notebook JSON");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
        Loading notebook...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (!notebook) return null;

  const lang =
    notebook.metadata?.language_info?.name ??
    notebook.metadata?.kernelspec?.language ??
    "python";

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="space-y-3">
        {notebook.cells.map((cell, i) => (
          <div
            key={i}
            className="rounded-lg border border-border/60 bg-surface-secondary/30"
          >
            {cell.cell_type === "markdown" ? (
              <div className="p-3">
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {joinSource(cell.source)}
                  </ReactMarkdown>
                </div>
              </div>
            ) : cell.cell_type === "code" ? (
              <div>
                <div className="flex items-center gap-2 border-b border-border/30 px-3 py-1">
                  <span className="font-mono text-[10px] text-text-tertiary">
                    [{cell.execution_count ?? " "}]
                  </span>
                </div>
                <CodeBlock language={lang}>{joinSource(cell.source)}</CodeBlock>
                {cell.outputs && cell.outputs.length > 0 && (
                  <div className="space-y-2 border-t border-border/30 p-3">
                    {cell.outputs.map((out, j) => (
                      <CellOutputDisplay key={j} output={out} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <pre className="p-3 font-mono text-xs text-text-secondary">
                {joinSource(cell.source)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

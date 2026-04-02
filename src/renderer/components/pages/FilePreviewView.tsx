import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "../chat/CodeBlock";

const api = (
  window as unknown as { api: import("../../../preload/index").ElectronAPI }
).api;

interface Props {
  filePath: string;
  fileName: string;
  skillName: string;
  onBack: () => void;
}

const LANGUAGE_MAP: Record<string, string> = {
  py: "python",
  js: "javascript",
  ts: "typescript",
  tsx: "tsx",
  jsx: "jsx",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  css: "css",
  scss: "scss",
  html: "html",
  xml: "xml",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  sql: "sql",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  lua: "lua",
  r: "r",
  dockerfile: "dockerfile",
  makefile: "makefile",
};

function getExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : name.toLowerCase();
}

function getLanguage(name: string): string | null {
  return LANGUAGE_MAP[getExt(name)] ?? null;
}

function isMarkdown(name: string): boolean {
  const ext = getExt(name);
  return ext === "md" || ext === "mdx";
}

function isPlainText(name: string): boolean {
  const ext = getExt(name);
  return ["txt", "text", "log", "env", "gitignore", "editorconfig"].includes(
    ext,
  );
}

export function FilePreviewView({
  filePath,
  fileName,
  skillName,
  onBack,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [fileData, setFileData] = useState<{
    type: "text" | "image";
    content: string;
  } | null>(null);
  const [viewMode, setViewMode] = useState<"rendered" | "source">("rendered");

  useEffect(() => {
    setLoading(true);
    setViewMode("rendered");
    api
      .readSkillFile(filePath)
      .then(setFileData)
      .finally(() => setLoading(false));
  }, [filePath]);

  const md = isMarkdown(fileName);
  const lang = getLanguage(fileName);
  const showToggle = md && fileData?.type === "text";

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 pb-5">
        {/* Back + breadcrumb */}
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={onBack}
            className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <span className="text-sm text-text-tertiary">{skillName}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-text-tertiary"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <div className="flex min-w-0 items-center gap-2">
            <FileIcon name={fileName} />
            <span className="min-w-0 truncate text-lg font-semibold text-text">
              {fileName}
            </span>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap gap-x-8 gap-y-1 text-xs">
          <div>
            <span className="text-text-tertiary">Type</span>
            <div className="mt-0.5 text-text">
              {fileData?.type === "image"
                ? "Image"
                : lang
                  ? lang.charAt(0).toUpperCase() + lang.slice(1)
                  : md
                    ? "Markdown"
                    : "Text"}
            </div>
          </div>
          <div className="min-w-0">
            <span className="text-text-tertiary">Path</span>
            <div
              className="mt-0.5 max-w-[300px] truncate text-text"
              title={filePath}
            >
              {filePath}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pt-4 pb-8">
        {showToggle && (
          <div className="mb-3 flex justify-end">
            <div className="flex overflow-hidden rounded-md border border-border">
              <button
                onClick={() => setViewMode("rendered")}
                className={`flex items-center px-2.5 py-1 text-xs transition-colors ${
                  viewMode === "rendered"
                    ? "bg-surface-hover text-text"
                    : "text-text-tertiary hover:text-text"
                }`}
                title="Rendered"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("source")}
                className={`flex items-center border-l border-border px-2.5 py-1 text-xs transition-colors ${
                  viewMode === "source"
                    ? "bg-surface-hover text-text"
                    : "text-text-tertiary hover:text-text"
                }`}
                title="Source"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-border bg-surface-secondary p-5">
          {loading ? (
            <p className="text-sm text-text-tertiary">Loading...</p>
          ) : !fileData ? (
            <p className="text-sm text-text-tertiary">
              Unable to read this file.
            </p>
          ) : fileData.type === "image" ? (
            <div className="flex justify-center">
              <img
                src={fileData.content}
                alt={fileName}
                className="max-w-full rounded-md object-contain"
              />
            </div>
          ) : md && viewMode === "rendered" ? (
            <MarkdownContent content={fileData.content} />
          ) : lang && !isPlainText(fileName) ? (
            <CodeBlock language={lang}>{fileData.content}</CodeBlock>
          ) : (
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-text-secondary">
              {fileData.content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            if (!match) {
              return (
                <code
                  className="rounded bg-surface-tertiary px-1.5 py-0.5 font-mono text-xs text-accent"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <CodeBlock language={match[1] || ""}>
                {String(children).replace(/\n$/, "")}
              </CodeBlock>
            );
          },
          p: ({ children }) => (
            <p className="mb-3 text-sm leading-relaxed text-text-secondary">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm text-text-secondary">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-sm text-text-secondary">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-sm leading-relaxed">{children}</li>
          ),
          h1: ({ children }) => (
            <h1 className="mb-3 mt-6 text-xl font-bold text-text first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-5 text-lg font-semibold text-text first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-4 text-base font-semibold text-text first:mt-0">
              {children}
            </h3>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-accent underline"
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-accent/40 pl-4 text-sm italic text-text-tertiary">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-md border border-border">
              <table className="w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-surface-tertiary">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border-b border-border px-3 py-2 text-left text-xs font-semibold text-text">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border px-3 py-2 text-text-secondary">
              {children}
            </td>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-text">{children}</strong>
          ),
          hr: () => <hr className="my-4 border-border" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function FileIcon({ name }: { name: string }) {
  const ext = getExt(name);
  const isImage = [
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "svg",
    "ico",
    "bmp",
  ].includes(ext);

  if (isImage) {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="shrink-0 text-text-tertiary"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    );
  }

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="shrink-0 text-text-tertiary"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "../chat/CodeBlock";
import type { SkillInfo } from "../../api/client";

interface Props {
  skill: SkillInfo;
  onBack: () => void;
}

function getSkillScope(location: string): string {
  if (location.includes("/.claude/skills/")) return "Personal";
  if (location.includes("/.agents/")) return "Global";
  if (location.includes("/node_modules/")) return "Plugin";
  return "Project";
}

function getInvokedBy(content: string): string {
  if (content.includes("disable-model-invocation: true")) return "User only";
  if (content.includes("user-invocable: false")) return "Claude only";
  return "User or Claude";
}

function getSkillDir(location: string): string {
  const parts = location.replace(/\\/g, "/").split("/");
  parts.pop();
  return parts.join("/");
}

export function SkillDetailView({ skill, onBack }: Props) {
  const [viewMode, setViewMode] = useState<"rendered" | "source">("rendered");

  const scope = getSkillScope(skill.location);
  const invokedBy = getInvokedBy(skill.content);
  const dir = getSkillDir(skill.location);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 pb-5">
        <div className="mb-4 flex items-center gap-3">
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
          <h3 className="min-w-0 truncate text-lg font-semibold text-text">
            {skill.name}
          </h3>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs">
          <div>
            <span className="text-text-tertiary">Scope</span>
            <div className="mt-0.5 text-text">{scope}</div>
          </div>
          <div>
            <span className="text-text-tertiary">Invoked by</span>
            <div className="mt-0.5 text-text">{invokedBy}</div>
          </div>
          <div className="min-w-0">
            <span className="text-text-tertiary">Location</span>
            <div
              className="mt-0.5 max-w-[200px] truncate text-text"
              title={dir}
            >
              {dir}
            </div>
          </div>
        </div>

        {skill.description && (
          <div className="mt-4">
            <span className="text-xs text-text-tertiary">Description</span>
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">
              {skill.description}
            </p>
          </div>
        )}
      </div>

      {/* SKILL.md Content */}
      <div className="px-6 pt-4 pb-8">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-medium text-text-tertiary">
            SKILL.md Content
          </h4>
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
        <div className="overflow-x-auto rounded-lg border border-border bg-surface-secondary p-5">
          {viewMode === "rendered" ? (
            <SkillMarkdown content={skill.content} />
          ) : (
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-text-secondary">
              {skill.content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Markdown Renderer ────────────────────────────────────────── */

function SkillMarkdown({ content }: { content: string }) {
  if (!content.trim()) {
    return (
      <p className="text-sm italic text-text-tertiary">
        No content in SKILL.md body.
      </p>
    );
  }

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
          h4: ({ children }) => (
            <h4 className="mb-1 mt-3 text-sm font-semibold text-text">
              {children}
            </h4>
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
          hr: () => <hr className="my-4 border-border" />,
          strong: ({ children }) => (
            <strong className="font-semibold text-text">{children}</strong>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

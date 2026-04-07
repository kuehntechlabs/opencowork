import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";
import { useArtifactStore } from "../../stores/artifact-store";
import {
  extractArtifactTags,
  extractPartialArtifacts,
} from "../../utils/artifact-detection";

interface Props {
  text: string;
  isUser?: boolean;
  sessionId?: string;
}

const TYPE_ICONS: Record<string, string> = {
  html: "HTML",
  react: "React",
  notebook: "Notebook",
  browser: "Browser",
};

// Strip <artifact> tags from AI output — replaced by inline cards
// Also strips incomplete/streaming artifacts (opening tag without closing tag)
function stripArtifactTags(text: string): string {
  // First strip complete tags
  let result = text.replace(/<artifact\s+[^>]*?>[\s\S]*?<\/artifact>/g, "");
  // Then strip incomplete tags (opening tag + everything after it)
  result = result.replace(/<artifact\s+[^>]*?>[\s\S]*$/g, "");
  return result.trim();
}

/** Clickable artifact card shown inline in the chat */
function ArtifactCard({
  type,
  title,
  identifier,
  complete,
  sessionId,
}: {
  type: string;
  title: string;
  identifier: string;
  complete: boolean;
  sessionId: string;
}) {
  const setActiveArtifact = useArtifactStore((s) => s.setActiveArtifact);
  const artifacts = useArtifactStore((s) => s.artifacts);

  const handleClick = () => {
    const match = Object.values(artifacts).find(
      (a) => a.sessionId === sessionId && a.title === title && a.type === type,
    );
    if (match) {
      setActiveArtifact(match.id);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="my-2 flex w-full items-center gap-3 rounded-lg border border-border/60 bg-surface-tertiary/30 px-3 py-2.5 text-left transition-colors hover:border-accent/40 hover:bg-surface-tertiary/50"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
        {!complete ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            {type === "react" ? (
              <>
                <circle cx="12" cy="12" r="2" />
                <ellipse cx="12" cy="12" rx="10" ry="4" />
                <ellipse
                  cx="12"
                  cy="12"
                  rx="10"
                  ry="4"
                  transform="rotate(60 12 12)"
                />
                <ellipse
                  cx="12"
                  cy="12"
                  rx="10"
                  ry="4"
                  transform="rotate(120 12 12)"
                />
              </>
            ) : (
              <>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </>
            )}
          </svg>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-text">{title}</div>
        <div className="text-[10px] text-text-tertiary">
          {!complete
            ? "Generating..."
            : `${TYPE_ICONS[type] || type} — Click to open`}
        </div>
      </div>
      {complete && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="shrink-0 text-text-tertiary"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      )}
    </button>
  );
}

export function TextContent({ text, isUser, sessionId }: Props) {
  if (!text) return null;

  if (isUser) {
    // Strip injected artifact system prompt from display
    const userText = text.replace(
      /<artifacts_info>[\s\S]*?<\/artifacts_info>\s*/g,
      "",
    );
    return <p className="whitespace-pre-wrap text-sm">{userText}</p>;
  }

  // Extract artifact tags for inline cards (including streaming/incomplete)
  const artifactTags = extractPartialArtifacts(text);
  const displayText = stripArtifactTags(text);

  return (
    <div>
      {/* Render markdown text (if any) */}
      {displayText && (
        <div className="prose prose-sm prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                const isInline = !match;

                if (isInline) {
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
                  <CodeBlock language={match?.[1] || ""} sessionId={sessionId}>
                    {String(children).replace(/\n$/, "")}
                  </CodeBlock>
                );
              },
              p({ children }) {
                return (
                  <p className="mb-2 text-sm leading-relaxed last:mb-0">
                    {children}
                  </p>
                );
              },
              ul({ children }) {
                return (
                  <ul className="mb-2 list-disc space-y-1 pl-4 text-sm">
                    {children}
                  </ul>
                );
              },
              ol({ children }) {
                return (
                  <ol className="mb-2 list-decimal space-y-1 pl-4 text-sm">
                    {children}
                  </ol>
                );
              },
              li({ children }) {
                return <li className="text-sm">{children}</li>;
              },
              h1({ children }) {
                return (
                  <h1 className="mb-2 mt-4 text-lg font-bold">{children}</h1>
                );
              },
              h2({ children }) {
                return (
                  <h2 className="mb-2 mt-3 text-base font-bold">{children}</h2>
                );
              },
              h3({ children }) {
                return (
                  <h3 className="mb-1 mt-2 text-sm font-bold">{children}</h3>
                );
              },
              a({ href, children }) {
                return (
                  <a
                    href={href}
                    className="text-accent underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {children}
                  </a>
                );
              },
              blockquote({ children }) {
                return (
                  <blockquote className="my-2 border-l-2 border-accent/40 pl-3 text-sm italic text-text-secondary">
                    {children}
                  </blockquote>
                );
              },
              table({ children }) {
                return (
                  <div className="my-2 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      {children}
                    </table>
                  </div>
                );
              },
              th({ children }) {
                return (
                  <th className="border border-border px-3 py-1.5 text-left font-semibold">
                    {children}
                  </th>
                );
              },
              td({ children }) {
                return (
                  <td className="border border-border px-3 py-1.5">
                    {children}
                  </td>
                );
              },
            }}
          >
            {displayText}
          </ReactMarkdown>
        </div>
      )}

      {/* Inline artifact cards */}
      {artifactTags.map((tag) => (
        <ArtifactCard
          key={tag.identifier}
          type={tag.type}
          title={tag.title}
          identifier={tag.identifier}
          complete={tag.complete}
          sessionId={sessionId ?? ""}
        />
      ))}
    </div>
  );
}

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";

interface Props {
  text: string;
  isUser?: boolean;
  sessionId?: string;
}

// Strip <artifact> tags from AI output — they're rendered in the artifact panel
function stripArtifactTags(text: string): string {
  return text.replace(/<artifact\s+[^>]*?>[\s\S]*?<\/artifact>/g, "").trim();
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

  const displayText = stripArtifactTags(text);
  if (!displayText) return null;

  return (
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
            return <h1 className="mb-2 mt-4 text-lg font-bold">{children}</h1>;
          },
          h2({ children }) {
            return (
              <h2 className="mb-2 mt-3 text-base font-bold">{children}</h2>
            );
          },
          h3({ children }) {
            return <h3 className="mb-1 mt-2 text-sm font-bold">{children}</h3>;
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
              <td className="border border-border px-3 py-1.5">{children}</td>
            );
          },
        }}
      >
        {displayText}
      </ReactMarkdown>
    </div>
  );
}

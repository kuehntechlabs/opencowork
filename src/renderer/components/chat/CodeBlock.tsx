import { useState, useEffect } from "react";

interface Props {
  language?: string;
  children: string;
}

export function CodeBlock({ language, children }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-2 overflow-hidden rounded-lg border border-border">
      {/* Header */}
      <div className="flex items-center justify-between bg-surface-tertiary px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase text-text-tertiary">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="text-[10px] text-text-tertiary opacity-0 transition-opacity hover:text-text group-hover:opacity-100"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Code */}
      <pre className="overflow-x-auto bg-surface-secondary p-3">
        <code className="font-mono text-xs leading-relaxed text-text">
          {children}
        </code>
      </pre>
    </div>
  );
}

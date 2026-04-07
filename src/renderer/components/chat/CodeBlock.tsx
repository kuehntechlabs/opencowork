import { useState } from "react";
import { useArtifactStore } from "../../stores/artifact-store";
import {
  isArtifactLanguage,
  isReactLanguage,
} from "../../utils/artifact-detection";

interface Props {
  language?: string;
  children: string;
  sessionId?: string;
}

export function CodeBlock({ language, children, sessionId }: Props) {
  const [copied, setCopied] = useState(false);
  const addArtifact = useArtifactStore((s) => s.addArtifact);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canPreview = language ? isArtifactLanguage(language) : false;

  const handlePreview = () => {
    if (!language) return;
    const type = isReactLanguage(language) ? "react" : "html";
    addArtifact({
      type,
      title: type === "react" ? "React Component" : "HTML Preview",
      content: children,
      language,
      sessionId: sessionId ?? "",
    });
  };

  return (
    <div className="group relative my-2 overflow-hidden rounded-lg border border-border">
      {/* Header */}
      <div className="flex items-center justify-between bg-surface-tertiary px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase text-text-tertiary">
          {language || "code"}
        </span>
        <div className="flex items-center gap-2">
          {canPreview && (
            <button
              onClick={handlePreview}
              className="text-[10px] text-accent opacity-0 transition-opacity hover:text-accent-hover group-hover:opacity-100"
            >
              Preview
            </button>
          )}
          <button
            onClick={handleCopy}
            className="text-[10px] text-text-tertiary opacity-0 transition-opacity hover:text-text group-hover:opacity-100"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
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

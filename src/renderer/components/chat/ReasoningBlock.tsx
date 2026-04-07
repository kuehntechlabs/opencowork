import { useState } from "react";
import type { ReasoningPart } from "../../api/types";

interface Props {
  part: ReasoningPart;
}

export function ReasoningBlock({ part }: Props) {
  const isStreaming = !part.time?.end;
  const [expanded, setExpanded] = useState(false);

  const duration =
    part.time?.end && part.time?.start
      ? ((part.time.end - part.time.start) / 1000).toFixed(1)
      : null;

  return (
    <div className="my-0.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] text-text-tertiary transition-colors hover:bg-surface-tertiary/50 hover:text-text-secondary"
      >
        {isStreaming ? (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        ) : (
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${expanded ? "rotate-90" : ""}`}
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        )}
        {isStreaming ? "Thinking..." : "Thought"}
        {duration && <span className="opacity-50">{duration}s</span>}
      </button>

      {expanded && !isStreaming && (
        <div className="mt-1 max-h-48 overflow-y-auto rounded border border-border/30 bg-surface-tertiary/20 px-2.5 py-1.5">
          <p className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-text-tertiary">
            {part.text || "(empty)"}
          </p>
        </div>
      )}
    </div>
  );
}

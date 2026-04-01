import { useState } from "react";
import type { ReasoningPart } from "../../api/types";

interface Props {
  part: ReasoningPart;
}

export function ReasoningBlock({ part }: Props) {
  const [open, setOpen] = useState(false);
  const isStreaming = !part.time.end;

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs text-text-tertiary transition-colors hover:text-text-secondary"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${open ? "rotate-90" : ""}`}
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        <span className="flex items-center gap-1.5">
          {isStreaming && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          )}
          Thinking
          {part.time.end && (
            <span className="text-[10px] opacity-60">
              {((part.time.end - part.time.start) / 1000).toFixed(1)}s
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="mt-1.5 rounded-lg border border-border/50 bg-surface-tertiary/30 px-3 py-2">
          <p className="whitespace-pre-wrap font-mono text-xs text-text-tertiary leading-relaxed">
            {part.text}
          </p>
        </div>
      )}
    </div>
  );
}

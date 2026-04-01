import { useState } from "react";
import type { ToolPart } from "../../api/types";
import { Spinner } from "../common/Spinner";

interface Props {
  part: ToolPart;
}

export function ToolCallBlock({ part }: Props) {
  const { state, tool } = part;
  const [expanded, setExpanded] = useState(false);

  const statusIcon = () => {
    switch (state.status) {
      case "pending":
      case "running":
        return <Spinner size={14} />;
      case "completed":
        return (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className="text-green-400"
          >
            <path
              d="M20 6 9 17l-5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "error":
        return (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className="text-red-400"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="m15 9-6 6M9 9l6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        );
    }
  };

  const title =
    (state.status === "running" || state.status === "completed") && state.title
      ? state.title
      : tool;

  const hasInput = state.input && Object.keys(state.input).length > 0;
  const hasOutput =
    (state.status === "completed" && state.output) ||
    (state.status === "error" && state.error);

  return (
    <div className="my-1 rounded-lg border border-border/40 bg-surface-tertiary/20">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {statusIcon()}
        <span className="flex-1 truncate font-mono text-xs text-text-secondary">
          {title}
        </span>
        {state.status === "running" && (
          <span className="text-[10px] text-text-tertiary">running...</span>
        )}
        {state.status === "error" && (
          <span className="truncate text-[10px] text-red-400">
            {state.error}
          </span>
        )}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`shrink-0 text-text-tertiary transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-border/30 px-3 py-2">
          {hasInput && (
            <div className="mb-2">
              <span className="text-[10px] font-semibold uppercase text-text-tertiary">
                Input
              </span>
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-surface-secondary p-2 font-mono text-[11px] text-text-secondary">
                {JSON.stringify(state.input, null, 2)}
              </pre>
            </div>
          )}
          {state.status === "completed" && state.output && (
            <div>
              <span className="text-[10px] font-semibold uppercase text-text-tertiary">
                Output
              </span>
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-surface-secondary p-2 font-mono text-[11px] text-text-secondary">
                {state.output}
              </pre>
            </div>
          )}
          {state.status === "error" && state.error && (
            <div>
              <span className="text-[10px] font-semibold uppercase text-text-tertiary">
                Error
              </span>
              <pre className="mt-1 overflow-auto rounded bg-red-500/10 p-2 font-mono text-[11px] text-red-400">
                {state.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import type { ToolPart } from "../../api/types";
import { Spinner } from "../common/Spinner";

interface Props {
  part: ToolPart;
}

export function ToolCallBlock({ part }: Props) {
  const { state, tool } = part;

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

  return (
    <div className="my-1 flex items-center gap-2 rounded-lg border border-border/40 bg-surface-tertiary/20 px-3 py-2">
      {statusIcon()}
      <span className="font-mono text-xs text-text-secondary">{title}</span>
      {state.status === "running" && state.time && (
        <span className="ml-auto text-[10px] text-text-tertiary">
          running...
        </span>
      )}
      {state.status === "error" && (
        <span className="ml-auto truncate text-[10px] text-red-400">
          {state.error}
        </span>
      )}
    </div>
  );
}

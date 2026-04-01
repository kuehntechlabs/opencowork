import type { Session } from "../../api/types";
import { useSessionStore } from "../../stores/session-store";

interface Props {
  session: Session;
  isActive: boolean;
  isArchived?: boolean;
  onClick: () => void;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return date.toLocaleDateString();
}

export function ChatHistoryItem({
  session,
  isActive,
  isArchived,
  onClick,
}: Props) {
  const archiveSession = useSessionStore((s) => s.archiveSession);
  const unarchiveSession = useSessionStore((s) => s.unarchiveSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const sessionStatus = useSessionStore((s) => s.sessionStatus[session.id]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className={`group flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
        isActive
          ? "bg-surface-tertiary text-text"
          : "text-text-secondary hover:bg-surface-hover hover:text-text"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">
            {session.title || "New Chat"}
          </span>
          {sessionStatus?.type === "busy" && (
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" />
          )}
        </div>
        <span className="text-xs text-text-tertiary">
          {formatTime(session.time.updated)}
        </span>
      </div>

      {isArchived ? (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {/* Restore */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              unarchiveSession(session.id);
            }}
            className="rounded p-1 text-text-tertiary hover:bg-surface-tertiary hover:text-text"
            title="Restore chat"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
          {/* Delete permanently */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteSession(session.id);
            }}
            className="rounded p-1 text-text-tertiary hover:bg-surface-tertiary hover:text-red-400"
            title="Delete permanently"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            archiveSession(session.id);
          }}
          className="shrink-0 rounded p-1 text-text-tertiary opacity-0 transition-opacity hover:bg-surface-tertiary hover:text-text group-hover:opacity-100"
          title="Archive chat"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="21 8 21 21 3 21 3 8" />
            <rect x="1" y="3" width="22" height="5" />
            <line x1="10" y1="12" x2="14" y2="12" />
          </svg>
        </button>
      )}
    </div>
  );
}

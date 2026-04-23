import { useMemo, useState } from "react";
import { useSessionStore } from "../../stores/session-store";
import { SidebarCard } from "./SidebarCard";

interface Props {
  sessionId: string;
}

const COLLAPSE_AFTER = 5;

export function TodosPanel({ sessionId }: Props) {
  const todos = useSessionStore((s) => s.todos[sessionId]);
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(() => {
    if (!todos || todos.length === 0) return [];
    return [...todos].sort((a, b) => {
      const rank = (t: { status: string }) =>
        t.status === "in_progress" || t.status === "in-progress"
          ? 0
          : t.status === "completed"
            ? 2
            : 1;
      return rank(a) - rank(b);
    });
  }, [todos]);

  if (sorted.length === 0) return null;

  const visible =
    expanded || sorted.length <= COLLAPSE_AFTER
      ? sorted
      : sorted.slice(0, COLLAPSE_AFTER);

  return (
    <SidebarCard title="Todos">
      <ul className="space-y-1">
        {visible.map((t, i) => {
          const isDone = t.status === "completed";
          const isActive =
            t.status === "in_progress" || t.status === "in-progress";
          return (
            <li
              key={i}
              className={
                "flex items-start gap-2 text-xs leading-snug " +
                (isDone
                  ? "text-text-tertiary line-through"
                  : isActive
                    ? "text-text"
                    : "text-text-secondary")
              }
            >
              <StatusIcon
                status={isDone ? "done" : isActive ? "active" : "pending"}
              />
              <span className="flex-1 break-words">{t.content}</span>
            </li>
          );
        })}
      </ul>
      {sorted.length > COLLAPSE_AFTER && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-[11px] text-text-tertiary hover:text-text"
        >
          {expanded
            ? "Show less"
            : `Show all (${sorted.length - COLLAPSE_AFTER} more)`}
        </button>
      )}
    </SidebarCard>
  );
}

function StatusIcon({ status }: { status: "done" | "active" | "pending" }) {
  if (status === "done") {
    return (
      <svg
        className="mt-0.5 flex-shrink-0 text-green-500"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (status === "active") {
    return (
      <span className="mt-1 flex h-2 w-2 flex-shrink-0 rounded-full bg-accent" />
    );
  }
  return (
    <span className="mt-1 flex h-2 w-2 flex-shrink-0 rounded-full border border-text-tertiary/60" />
  );
}

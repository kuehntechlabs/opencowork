import { useMemo, useState } from "react";
import { useSessionStore } from "../../stores/session-store";

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
        t.status === "completed" ? 2 : t.status === "in-progress" ? 0 : 1;
      return rank(a) - rank(b);
    });
  }, [todos]);

  if (sorted.length === 0) return null;

  const visible =
    expanded || sorted.length <= COLLAPSE_AFTER
      ? sorted
      : sorted.slice(0, COLLAPSE_AFTER);

  return (
    <div className="border-b border-border/40 px-3 py-2">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-text-tertiary">
        Todos
      </div>
      <ul className="space-y-1">
        {visible.map((t, i) => (
          <li
            key={i}
            className={
              "flex items-start gap-1.5 text-xs " +
              (t.status === "completed"
                ? "text-text-tertiary line-through"
                : "text-text-secondary")
            }
          >
            <span className="mt-0.5 flex-shrink-0">
              {t.status === "completed"
                ? "✓"
                : t.status === "in-progress"
                  ? "•"
                  : "○"}
            </span>
            <span className="flex-1">{t.content}</span>
          </li>
        ))}
      </ul>
      {sorted.length > COLLAPSE_AFTER && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[11px] text-text-tertiary hover:text-text"
        >
          {expanded
            ? "Show less"
            : `Show all (${sorted.length - COLLAPSE_AFTER} more)`}
        </button>
      )}
    </div>
  );
}

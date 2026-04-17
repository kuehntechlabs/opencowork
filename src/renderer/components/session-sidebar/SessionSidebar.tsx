import { useEffect } from "react";
import { useSessionStore } from "../../stores/session-store";
import { ContextPanel } from "./ContextPanel";
import { TodosPanel } from "./TodosPanel";
import { FilesPanel } from "./FilesPanel";

interface Props {
  sessionId: string;
}

export function SessionSidebar({ sessionId }: Props) {
  const loadSessionDiff = useSessionStore((s) => s.loadSessionDiff);
  const hasTodos = useSessionStore(
    (s) => (s.todos[sessionId]?.length ?? 0) > 0,
  );
  const hasDiff = useSessionStore(
    (s) => (s.sessionDiffs[sessionId]?.length ?? 0) > 0,
  );
  const hasAssistant = useSessionStore((s) =>
    (s.messages[sessionId] ?? []).some((m) => m.role === "assistant"),
  );

  useEffect(() => {
    loadSessionDiff(sessionId);
  }, [sessionId, loadSessionDiff]);

  if (!hasAssistant && !hasTodos && !hasDiff) {
    return (
      <aside className="flex h-full w-80 flex-col border-l border-border bg-surface-secondary">
        <div className="px-3 py-4 text-xs text-text-tertiary">
          Session info will appear here once the assistant has replied.
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-80 flex-col overflow-y-auto border-l border-border bg-surface-secondary">
      <ContextPanel sessionId={sessionId} />
      <TodosPanel sessionId={sessionId} />
      <FilesPanel sessionId={sessionId} />
    </aside>
  );
}

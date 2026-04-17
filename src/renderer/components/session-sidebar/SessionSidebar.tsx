import { useEffect } from "react";
import { useSessionStore } from "../../stores/session-store";
import { ContextPanel } from "./ContextPanel";
import { TodosPanel } from "./TodosPanel";
import { FilesPanel } from "./FilesPanel";
import { McpPanel } from "./McpPanel";
import { LspPanel } from "./LspPanel";
import { ProjectPanel } from "./ProjectPanel";

interface Props {
  sessionId: string;
}

export function SessionSidebar({ sessionId }: Props) {
  const loadSessionDiff = useSessionStore((s) => s.loadSessionDiff);
  const loadTodos = useSessionStore((s) => s.loadTodos);
  const loadLspStatus = useSessionStore((s) => s.loadLspStatus);

  useEffect(() => {
    loadSessionDiff(sessionId);
    loadTodos(sessionId);
    loadLspStatus();

    // opencode emits `todo.updated` over SSE, but: (a) the publish Effect is
    // fire-and-forget, (b) subagent `task` tool calls mutate todos on a child
    // session our panel isn't watching. Poll as a cheap safety net so todos
    // always surface within ~2s.
    const poll = setInterval(() => {
      if (document.visibilityState !== "hidden") {
        loadTodos(sessionId);
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [sessionId, loadSessionDiff, loadTodos, loadLspStatus]);

  return (
    <aside className="flex h-full w-80 flex-col overflow-y-auto border-l border-border bg-surface-secondary p-3">
      <div className="space-y-2">
        <ContextPanel sessionId={sessionId} />
        <TodosPanel sessionId={sessionId} />
        <FilesPanel sessionId={sessionId} />
        <McpPanel />
        <LspPanel />
        <ProjectPanel sessionId={sessionId} />
      </div>
    </aside>
  );
}

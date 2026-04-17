import { useEffect } from "react";
import { useSessionStore } from "../../stores/session-store";
import { ContextPanel } from "./ContextPanel";
import { TodosPanel } from "./TodosPanel";
import { FilesPanel } from "./FilesPanel";
import { McpPanel } from "./McpPanel";
import { ProjectPanel } from "./ProjectPanel";

interface Props {
  sessionId: string;
}

export function SessionSidebar({ sessionId }: Props) {
  const loadSessionDiff = useSessionStore((s) => s.loadSessionDiff);

  useEffect(() => {
    loadSessionDiff(sessionId);
  }, [sessionId, loadSessionDiff]);

  return (
    <aside className="flex h-full w-80 flex-col overflow-y-auto border-l border-border bg-surface-secondary p-3">
      <div className="space-y-2">
        <ContextPanel sessionId={sessionId} />
        <TodosPanel sessionId={sessionId} />
        <FilesPanel sessionId={sessionId} />
        <McpPanel />
        <ProjectPanel sessionId={sessionId} />
      </div>
    </aside>
  );
}

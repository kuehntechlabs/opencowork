import { useSessionStore } from "../../stores/session-store";
import { HomeView } from "../home/HomeView";
import { ChatView } from "../chat/ChatView";

export function RightPanel() {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);

  return (
    <main className="flex h-full flex-1 flex-col bg-surface">
      {/* Drag region for macOS */}
      <div className="drag-region h-12 w-full shrink-0" />
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeSessionId ? (
          <ChatView sessionId={activeSessionId} />
        ) : (
          <HomeView />
        )}
      </div>
    </main>
  );
}

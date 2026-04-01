import { useSessionStore } from "../../stores/session-store";
import { useSettingsStore } from "../../stores/settings-store";
import { HomeView } from "../home/HomeView";
import { ChatView } from "../chat/ChatView";

export function RightPanel() {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const sidebarOpen = useSettingsStore((s) => s.sidebarOpen);
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);

  return (
    <main className="flex h-full flex-1 flex-col bg-surface">
      {/* Drag region for macOS */}
      <div className="drag-region flex h-12 w-full shrink-0 items-center px-4">
        {!sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="no-drag rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
            title="Show sidebar"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18" />
            </svg>
          </button>
        )}
      </div>
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

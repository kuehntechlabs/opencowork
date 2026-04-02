import { useSessionStore } from "../../stores/session-store";
import { useSettingsStore } from "../../stores/settings-store";
import { HomeView } from "../home/HomeView";
import { ChatView } from "../chat/ChatView";
import { ProjectsPage } from "../pages/ProjectsPage";
import { CustomizePage } from "../pages/CustomizePage";

export function RightPanel() {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const sidebarOpen = useSettingsStore((s) => s.sidebarOpen);
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);
  const rightPanelPage = useSettingsStore((s) => s.rightPanelPage);
  const setRightPanelPage = useSettingsStore((s) => s.setRightPanelPage);

  const renderContent = () => {
    if (rightPanelPage === "customize") {
      return (
        <div className="flex flex-1 flex-col overflow-hidden bg-white dark:bg-[#1a1a1a]">
          <CustomizePage />
        </div>
      );
    }
    if (rightPanelPage === "projects") {
      return (
        <div className="flex flex-1 flex-col overflow-hidden bg-white dark:bg-[#1a1a1a]">
          {/* Close button */}
          <div className="flex shrink-0 justify-end px-4 pt-2">
            <button
              onClick={() => setRightPanelPage(null)}
              className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
              title="Close"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ProjectsPage />
          </div>
        </div>
      );
    }
    if (activeSessionId) {
      return <ChatView sessionId={activeSessionId} />;
    }
    return <HomeView />;
  };

  const isFullHeight = rightPanelPage === "customize";

  return (
    <main className="relative flex h-full flex-1 flex-col bg-surface">
      {/* Drag region for macOS — hidden when page needs full height */}
      {!isFullHeight && (
        <div className="drag-region flex h-12 w-full shrink-0 items-center px-4" />
      )}
      <div className="flex flex-1 flex-col overflow-hidden">
        {renderContent()}
      </div>

      {/* Sidebar re-open button at bottom-left */}
      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="no-drag absolute bottom-3 left-3 rounded-md border border-border bg-surface-secondary p-1.5 text-text-tertiary shadow-sm transition-colors hover:bg-surface-hover hover:text-text"
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
    </main>
  );
}

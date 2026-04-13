import { useEffect, useRef } from "react";
import { useSessionStore } from "../../stores/session-store";
import { useSettingsStore } from "../../stores/settings-store";
import { useArtifactStore } from "../../stores/artifact-store";
import { HomeView } from "../home/HomeView";
import { ChatView } from "../chat/ChatView";
import { ProjectsPage } from "../pages/ProjectsPage";
import { CustomizePage } from "../pages/CustomizePage";
import { DirectoryPage } from "../pages/DirectoryPage";
import { ArtifactPanel } from "../artifacts/ArtifactPanel";
import { useDirectoryInstall } from "../../hooks/useDirectoryInstall";
// Preload skills cache so directory opens fast
import "../../data/marketplace-fetch";

const SIDEBAR_WIDTH = 280;
const MIN_PANEL_WIDTH = 400; // minimum width for each panel in split view

export function RightPanel() {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const sidebarOpen = useSettingsStore((s) => s.sidebarOpen);
  const setSidebarOpen = useSettingsStore((s) => s.setSidebarOpen);
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);
  const rightPanelPage = useSettingsStore((s) => s.rightPanelPage);
  const setRightPanelPage = useSettingsStore((s) => s.setRightPanelPage);
  const directoryCategory = useSettingsStore((s) => s.directoryCategory);
  const artifactPanelOpen = useArtifactStore((s) => s.panelOpen);
  const activeArtifactId = useArtifactStore((s) => s.activeArtifactId);
  const sidebarWasOpen = useRef(sidebarOpen);

  const { installedNames, handleInstall } = useDirectoryInstall();

  // Auto-collapse sidebar when artifact panel opens if viewport is too narrow
  useEffect(() => {
    const showingArtifact = artifactPanelOpen && activeArtifactId;
    if (showingArtifact && sidebarOpen) {
      const available = window.innerWidth - SIDEBAR_WIDTH;
      if (available < MIN_PANEL_WIDTH * 2) {
        sidebarWasOpen.current = true;
        setSidebarOpen(false);
      }
    }
    // Restore sidebar when artifact panel closes (if we collapsed it)
    if (!showingArtifact && sidebarWasOpen.current && !sidebarOpen) {
      sidebarWasOpen.current = false;
      setSidebarOpen(true);
    }
  }, [artifactPanelOpen, activeArtifactId, sidebarOpen, setSidebarOpen]);

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
      if (artifactPanelOpen && activeArtifactId) {
        return (
          <div className="flex flex-1 overflow-hidden">
            <div className="flex flex-1 flex-col overflow-hidden">
              <ChatView sessionId={activeSessionId} />
            </div>
            <ArtifactPanel />
          </div>
        );
      }
      return <ChatView sessionId={activeSessionId} />;
    }
    return <HomeView />;
  };

  return (
    <main className="relative flex h-full flex-1 flex-col bg-surface">
      <div className="flex flex-1 flex-col overflow-hidden">
        {renderContent()}
      </div>
    </main>
  );
}

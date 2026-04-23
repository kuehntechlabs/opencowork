import { useEffect, useRef, useState, useCallback } from "react";
import { useSessionStore } from "../../stores/session-store";
import { useSettingsStore } from "../../stores/settings-store";
import { useArtifactStore } from "../../stores/artifact-store";
import { HomeView } from "../home/HomeView";
import { ChatView } from "../chat/ChatView";
import { ProjectsPage } from "../pages/ProjectsPage";
import { CustomizePage } from "../pages/CustomizePage";
import { DirectoryPage } from "../pages/DirectoryPage";
import { ArtifactPanel } from "../artifacts/ArtifactPanel";
import { SessionSidebar } from "../session-sidebar/SessionSidebar";
import { useDirectoryInstall } from "../../hooks/useDirectoryInstall";
// Preload skills cache so directory opens fast
import "../../data/marketplace-fetch";

const SIDEBAR_OPEN_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 48;
const MIN_PANEL_WIDTH = 250; // minimum width for each panel in split view
const MIN_SPLIT_PERCENT = 20; // minimum % for either side
const MAX_SPLIT_PERCENT = 80;

export function RightPanel() {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const sidebarOpen = useSettingsStore((s) => s.sidebarOpen);
  const setSidebarOpen = useSettingsStore((s) => s.setSidebarOpen);
  const rightPanelPage = useSettingsStore((s) => s.rightPanelPage);
  const setRightPanelPage = useSettingsStore((s) => s.setRightPanelPage);
  const directoryCategory = useSettingsStore((s) => s.directoryCategory);
  const artifactPanelOpen = useArtifactStore((s) => s.panelOpen);
  const activeArtifactId = useArtifactStore((s) => s.activeArtifactId);
  const sidebarWasOpen = useRef(sidebarOpen);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const [splitPercent, setSplitPercent] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const { installedNames, handleInstall } = useDirectoryInstall();

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  // Global mousemove/mouseup while dragging — attached to document so
  // iframes can't swallow events (the overlay blocks pointer events on them).
  useEffect(() => {
    if (!isDragging) return;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplitPercent(
        Math.min(MAX_SPLIT_PERCENT, Math.max(MIN_SPLIT_PERCENT, pct)),
      );
    };

    const onUp = () => {
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  // Auto-collapse sidebar when artifact panel opens if viewport is too narrow
  useEffect(() => {
    const showingArtifact = artifactPanelOpen && activeArtifactId;
    if (showingArtifact && sidebarOpen) {
      const sidebarW = sidebarOpen
        ? SIDEBAR_OPEN_WIDTH
        : SIDEBAR_COLLAPSED_WIDTH;
      const available = window.innerWidth - sidebarW;
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
          <div
            ref={splitContainerRef}
            className="relative flex h-full w-full overflow-hidden"
          >
            {/* Transparent overlay while dragging — prevents iframes from stealing events */}
            {isDragging && (
              <div className="absolute inset-0 z-20 cursor-col-resize" />
            )}
            <div
              className="flex min-w-0 flex-col overflow-hidden"
              style={{ width: `${splitPercent}%` }}
            >
              <ChatView sessionId={activeSessionId} />
            </div>
            {/* Drag handle */}
            <div
              onMouseDown={handleDragStart}
              className="group relative z-10 flex w-1 shrink-0 cursor-col-resize items-center justify-center hover:bg-accent/20"
            >
              <div className="h-8 w-0.5 rounded-full bg-border transition-colors group-hover:bg-accent" />
            </div>
            <div
              className="flex min-w-0 flex-col overflow-hidden"
              style={{ width: `${100 - splitPercent}%` }}
            >
              <ArtifactPanel />
            </div>
          </div>
        );
      }
      return (
        <div className="flex h-full w-full overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <ChatView sessionId={activeSessionId} />
          </div>
          <SessionSidebar sessionId={activeSessionId} />
        </div>
      );
    }
    return <HomeView />;
  };

  return (
    <main className="relative flex h-full flex-1 flex-col overflow-hidden bg-surface">
      <div className="flex flex-1 overflow-hidden">{renderContent()}</div>
    </main>
  );
}

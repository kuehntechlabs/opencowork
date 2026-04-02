import { SidebarSearch } from "../sidebar/SidebarSearch";
import { SidebarSettings } from "../sidebar/SidebarSettings";
import { ChatHistoryList } from "../sidebar/ChatHistoryList";
import { useSessionStore } from "../../stores/session-store";
import { useServerStore } from "../../stores/server-store";
import { useSettingsStore } from "../../stores/settings-store";
import { useState } from "react";

export function Sidebar() {
  const [searchQuery, setSearchQuery] = useState("");
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const setRightPanelPage = useSettingsStore((s) => s.setRightPanelPage);
  const directory = useServerStore((s) => s.directory);

  const handleNewChat = () => {
    setActiveSession(null);
    setRightPanelPage(null);
  };

  return (
    <aside className="flex h-full w-[280px] min-w-[280px] flex-col border-r border-border bg-surface-secondary">
      {/* Title bar drag region on macOS */}
      <div className="drag-region flex h-12 items-center justify-between pr-4 pl-20">
        <span className="no-drag text-sm font-semibold text-text">
          OpenCowork
        </span>
        <button
          onClick={handleNewChat}
          className="no-drag rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text"
          title="New chat"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <SidebarSearch value={searchQuery} onChange={setSearchQuery} />
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto">
        <ChatHistoryList searchQuery={searchQuery} />
      </div>

      {/* Settings */}
      <SidebarSettings />
    </aside>
  );
}

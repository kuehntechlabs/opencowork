import { SidebarSearch } from "../sidebar/SidebarSearch";
import { SidebarSettings } from "../sidebar/SidebarSettings";
import { ChatHistoryList } from "../sidebar/ChatHistoryList";
import { useState } from "react";

export function Sidebar() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <aside className="flex h-full w-[280px] min-w-[280px] flex-col border-r border-border bg-surface-secondary">
      {/* Search */}
      <div className="px-3 pt-2 pb-2">
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

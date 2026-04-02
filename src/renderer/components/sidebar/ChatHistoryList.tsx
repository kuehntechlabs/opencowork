import { useMemo, useState } from "react";
import { useSessionStore } from "../../stores/session-store";
import { useSettingsStore } from "../../stores/settings-store";
import { ChatHistoryItem } from "./ChatHistoryItem";
import type { Session } from "../../api/types";

interface Props {
  searchQuery: string;
}

function getFolderName(directory: string): string {
  const parts = directory.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || directory;
}

function groupByFolder(
  sessions: Session[],
): { folder: string; sessions: Session[] }[] {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const folder = getFolderName(s.directory);
    const list = map.get(folder) || [];
    list.push(s);
    map.set(folder, list);
  }
  const groups = Array.from(map.entries()).map(([folder, sessions]) => ({
    folder,
    sessions: sessions.sort((a, b) => b.time.updated - a.time.updated),
  }));
  // Sort groups by most recent session
  groups.sort(
    (a, b) => b.sessions[0].time.updated - a.sessions[0].time.updated,
  );
  return groups;
}

export function ChatHistoryList({ searchQuery }: Props) {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);

  const [showArchive, setShowArchive] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(
    new Set(),
  );

  const { activeSessions, archivedSessions } = useMemo(() => {
    const list = Object.values(sessions);
    const filtered = searchQuery
      ? list.filter((s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : list;
    return {
      activeSessions: filtered.filter((s) => !s.time.archived),
      archivedSessions: filtered.filter((s) => !!s.time.archived),
    };
  }, [sessions, searchQuery]);

  const activeGroups = useMemo(
    () => groupByFolder(activeSessions),
    [activeSessions],
  );
  const archivedGroups = useMemo(
    () => groupByFolder(archivedSessions),
    [archivedSessions],
  );

  const toggleFolder = (folder: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  };

  const rightPanelPage = useSettingsStore((s) => s.rightPanelPage);
  const setRightPanelPage = useSettingsStore((s) => s.setRightPanelPage);

  const hasSingleFolder = activeGroups.length === 1 && !showArchive;

  return (
    <div className="flex flex-col gap-0.5 px-2">
      {/* Projects button */}
      <button
        onClick={() =>
          setRightPanelPage(rightPanelPage === "projects" ? null : "projects")
        }
        className={`mb-0.5 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${
          rightPanelPage === "projects"
            ? "bg-surface-hover text-text"
            : "text-text hover:bg-surface-hover"
        }`}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        Projects
      </button>

      {/* Customize button */}
      <button
        onClick={() =>
          setRightPanelPage(rightPanelPage === "customize" ? null : "customize")
        }
        className={`mb-0.5 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${
          rightPanelPage === "customize"
            ? "bg-surface-hover text-text"
            : "text-text hover:bg-surface-hover"
        }`}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        Customize
      </button>

      {/* Divider */}
      <div className="my-1.5 mx-3 border-t border-border" />

      {/* Archive toggle */}
      {archivedSessions.length > 0 && (
        <button
          onClick={() => setShowArchive((v) => !v)}
          className="mb-1 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="21 8 21 21 3 21 3 8" />
            <rect x="1" y="3" width="22" height="5" />
            <line x1="10" y1="12" x2="14" y2="12" />
          </svg>
          Archive
          <span className="rounded-full bg-surface-tertiary px-1.5 text-[10px]">
            {archivedSessions.length}
          </span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${showArchive ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* Archived chats */}
      {showArchive && (
        <div className="mb-2">
          {archivedGroups.map((group) => (
            <FolderGroup
              key={`archived-${group.folder}`}
              folder={group.folder}
              sessions={group.sessions}
              activeSessionId={activeSessionId}
              collapsed={collapsedFolders.has(`archived-${group.folder}`)}
              onToggle={() => toggleFolder(`archived-${group.folder}`)}
              onSelect={setActiveSession}
              isArchived
              showFolderHeader={archivedGroups.length > 1}
            />
          ))}
        </div>
      )}

      {/* Active chats */}
      {activeGroups.length === 0 && !showArchive ? (
        <div className="px-4 py-8 text-center text-sm text-text-tertiary">
          {searchQuery ? "No matching chats" : "No chats yet"}
        </div>
      ) : (
        activeGroups.map((group) => (
          <FolderGroup
            key={group.folder}
            folder={group.folder}
            sessions={group.sessions}
            activeSessionId={activeSessionId}
            collapsed={collapsedFolders.has(group.folder)}
            onToggle={() => toggleFolder(group.folder)}
            onSelect={setActiveSession}
            showFolderHeader={!hasSingleFolder}
          />
        ))
      )}
    </div>
  );
}

function FolderGroup({
  folder,
  sessions,
  activeSessionId,
  collapsed,
  onToggle,
  onSelect,
  isArchived,
  showFolderHeader,
}: {
  folder: string;
  sessions: Session[];
  activeSessionId: string | null;
  collapsed: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  isArchived?: boolean;
  showFolderHeader?: boolean;
}) {
  return (
    <div>
      {showFolderHeader && (
        <button
          onClick={onToggle}
          className="flex w-full items-center gap-1.5 px-3 py-1 text-left"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`shrink-0 text-text-tertiary transition-transform ${collapsed ? "-rotate-90" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <span className="truncate text-xs font-medium text-text-tertiary">
            {folder}
          </span>
        </button>
      )}
      {!collapsed &&
        sessions.map((session) => (
          <ChatHistoryItem
            key={session.id}
            session={session}
            isActive={session.id === activeSessionId}
            isArchived={isArchived}
            onClick={() => onSelect(session.id)}
          />
        ))}
    </div>
  );
}

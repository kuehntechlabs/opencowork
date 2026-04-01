import { useMemo } from "react";
import { useSessionStore } from "../../stores/session-store";
import { ChatHistoryItem } from "./ChatHistoryItem";

interface Props {
  searchQuery: string;
}

export function ChatHistoryList({ searchQuery }: Props) {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);

  const sortedSessions = useMemo(() => {
    const list = Object.values(sessions);
    const filtered = searchQuery
      ? list.filter((s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : list;
    return filtered.sort((a, b) => b.time.updated - a.time.updated);
  }, [sessions, searchQuery]);

  if (sortedSessions.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-text-tertiary">
        {searchQuery ? "No matching chats" : "No chats yet"}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 px-2">
      {sortedSessions.map((session) => (
        <ChatHistoryItem
          key={session.id}
          session={session}
          isActive={session.id === activeSessionId}
          onClick={() => setActiveSession(session.id)}
        />
      ))}
    </div>
  );
}

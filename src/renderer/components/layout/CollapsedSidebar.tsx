import { useSessionStore } from "../../stores/session-store";
import { useSettingsStore } from "../../stores/settings-store";

export function CollapsedSidebar() {
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const rightPanelPage = useSettingsStore((s) => s.rightPanelPage);
  const setRightPanelPage = useSettingsStore((s) => s.setRightPanelPage);
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);
  const setSettingsModalOpen = useSettingsStore((s) => s.setSettingsModalOpen);

  const handleNewChat = () => {
    setActiveSession(null);
    setRightPanelPage(null);
  };

  return (
    <aside className="flex h-full w-12 min-w-12 flex-col items-center border-r border-border bg-surface-secondary pt-2">
      {/* New Chat */}
      <button
        onClick={handleNewChat}
        className="rounded-md p-2 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text"
        title="New Chat"
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

      {/* Projects */}
      <button
        onClick={() =>
          setRightPanelPage(rightPanelPage === "projects" ? null : "projects")
        }
        className={`rounded-md p-2 transition-colors ${
          rightPanelPage === "projects"
            ? "bg-surface-hover text-text"
            : "text-text-secondary hover:bg-surface-hover hover:text-text"
        }`}
        title="Projects"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {/* Customize */}
      <button
        onClick={() =>
          setRightPanelPage(rightPanelPage === "customize" ? null : "customize")
        }
        className={`rounded-md p-2 transition-colors ${
          rightPanelPage === "customize"
            ? "bg-surface-hover text-text"
            : "text-text-secondary hover:bg-surface-hover hover:text-text"
        }`}
        title="Customize"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 2a10 10 0 0 0 0 20 2 2 0 0 0 2-2v-.09a2 2 0 0 1 1.18-1.82 2 2 0 0 1 2.18.44l.07.07a2 2 0 0 0 3.43-1.42 10 10 0 0 0-8.86-15.18Z" />
          <circle cx="7.5" cy="11.5" r="1.5" />
          <circle cx="12" cy="7.5" r="1.5" />
          <circle cx="16.5" cy="11.5" r="1.5" />
        </svg>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings */}
      <button
        onClick={() => setSettingsModalOpen(true)}
        className="rounded-md p-2 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
        title="Settings"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {/* Toggle sidebar open */}
      <button
        onClick={toggleSidebar}
        className="mb-3 rounded-md p-2 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
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
    </aside>
  );
}

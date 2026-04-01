import { useSettingsStore, type Theme } from "../../stores/settings-store";

export function SidebarSettings() {
  const { theme, setTheme, toggleSidebar } = useSettingsStore();

  const themes: { value: Theme; label: string }[] = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
  ];

  return (
    <div className="border-t border-border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                theme === t.value
                  ? "bg-surface-tertiary text-text"
                  : "text-text-tertiary hover:text-text"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={toggleSidebar}
          className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
          title="Toggle sidebar"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

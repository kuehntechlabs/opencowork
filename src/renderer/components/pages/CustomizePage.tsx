import { useState } from "react";
import { useSettingsStore } from "../../stores/settings-store";
import { SkillsPanel } from "./SkillsPanel";

type CustomizeSection = "skills" | "connectors" | null;

export function CustomizePage() {
  const [activeSection, setActiveSection] = useState<CustomizeSection>(null);
  const setRightPanelPage = useSettingsStore((s) => s.setRightPanelPage);

  return (
    <div className="flex h-full min-h-0">
      {/* Left menu */}
      <div className="flex w-64 shrink-0 flex-col border-r border-border bg-surface">
        {/* Drag region + back button row */}
        <div className="drag-region flex h-12 shrink-0 items-center px-4">
          <button
            onClick={() => setRightPanelPage(null)}
            className="no-drag rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
            title="Back"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
        </div>

        <div className="px-4 pb-6">
          <h2 className="mb-5 text-lg font-semibold text-text">Customize</h2>

          {/* Main items */}
          <div className="flex flex-col gap-0.5">
            <MenuButton
              icon={
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              }
              label="Skills"
              active={activeSection === "skills"}
              onClick={() =>
                setActiveSection(activeSection === "skills" ? null : "skills")
              }
            />
            <MenuButton
              icon={
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              }
              label="Connectors"
              active={activeSection === "connectors"}
              onClick={() =>
                setActiveSection(
                  activeSection === "connectors" ? null : "connectors",
                )
              }
            />
          </div>
        </div>
      </div>

      {/* Right content */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Drag region for right pane */}
        <div className="drag-region h-12 w-full shrink-0" />
        {activeSection === "skills" && <SkillsPanel />}
        {activeSection === "connectors" && (
          <div className="px-6 py-6">
            <h3 className="text-lg font-semibold text-text">Connectors</h3>
            <p className="mt-3 text-sm text-text-tertiary">
              MCP connectors coming soon.
            </p>
          </div>
        )}
        {!activeSection && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-text-tertiary">
              Select a category to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
        active ? "bg-accent/10 text-accent" : "text-text hover:bg-surface-hover"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      {label}
    </button>
  );
}

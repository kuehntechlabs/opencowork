import {
  useSettingsStore,
  type PermissionMode,
} from "../../stores/settings-store";

const modes: { value: PermissionMode; label: string; description: string }[] = [
  {
    value: "allow",
    label: "Allow All",
    description: "Auto-approve all tool calls",
  },
  {
    value: "ask",
    label: "Ask",
    description: "Confirm before running tools",
  },
  {
    value: "plan",
    label: "Plan",
    description: "Plan only, no tool execution",
  },
];

export function PermissionModeSelector() {
  const { permissionMode, setPermissionMode } = useSettingsStore();
  const current = modes.find((m) => m.value === permissionMode) ?? modes[1];

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-secondary p-1">
      {modes.map((mode) => (
        <button
          key={mode.value}
          onClick={() => setPermissionMode(mode.value)}
          title={mode.description}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            permissionMode === mode.value
              ? mode.value === "allow"
                ? "bg-green-500/20 text-green-300"
                : mode.value === "plan"
                  ? "bg-blue-500/20 text-blue-300"
                  : "bg-yellow-500/20 text-yellow-300"
              : "text-text-tertiary hover:text-text"
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

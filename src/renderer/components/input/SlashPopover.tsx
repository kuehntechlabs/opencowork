import { useEffect, useRef } from "react";
import type { SlashCommand } from "../../hooks/useSlashCommands";

interface Props {
  commands: SlashCommand[];
  activeId: string | null;
  onSelect: (cmd: SlashCommand) => void;
  onActiveChange: (id: string) => void;
}

export function SlashPopover({
  commands,
  activeId,
  onSelect,
  onActiveChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll active item into view
  useEffect(() => {
    if (!activeId || !containerRef.current) return;
    const el = containerRef.current.querySelector(
      `[data-slash-id="${activeId}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  if (commands.length === 0) {
    return (
      <div className="absolute inset-x-0 -top-2 z-50 -translate-y-full rounded-xl border border-border bg-surface-secondary p-3 shadow-lg">
        <span className="text-xs text-text-tertiary">No matching commands</span>
      </div>
    );
  }

  // Group commands by category
  const grouped: Record<string, SlashCommand[]> = {};
  for (const cmd of commands) {
    if (!grouped[cmd.category]) grouped[cmd.category] = [];
    grouped[cmd.category].push(cmd);
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-x-0 -top-2 z-50 max-h-72 -translate-y-full overflow-auto rounded-xl border border-border bg-surface-secondary p-2 shadow-lg"
      onMouseDown={(e) => e.preventDefault()}
    >
      {Object.entries(grouped).map(([category, cmds]) => (
        <div key={category}>
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            {category}
          </div>
          {cmds.map((cmd) => (
            <button
              key={cmd.id}
              data-slash-id={cmd.id}
              onClick={() => onSelect(cmd)}
              onMouseEnter={() => onActiveChange(cmd.id)}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition-colors ${
                activeId === cmd.id
                  ? "bg-accent/10 text-accent"
                  : "text-text hover:bg-surface-hover"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-medium">/{cmd.trigger}</span>
                <span className="truncate text-xs text-text-tertiary">
                  {cmd.description}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {cmd.type === "custom" && cmd.source !== "command" && (
                  <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-text-tertiary">
                    {cmd.source === "skill"
                      ? "Skill"
                      : cmd.source === "mcp"
                        ? "MCP"
                        : "Custom"}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

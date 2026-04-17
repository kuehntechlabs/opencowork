import { useEffect } from "react";
import { useSessionStore } from "../../stores/session-store";
import type { MCPStatus } from "../../api/types";
import { SidebarCard } from "./SidebarCard";

function dotColor(s: MCPStatus): string {
  switch (s.status) {
    case "connected":
      return "bg-green-500";
    case "disabled":
      return "bg-text-tertiary/50";
    default:
      return "bg-red-500";
  }
}

function subtitle(s: MCPStatus): string | null {
  if ("error" in s && s.error) return s.error;
  if (s.status === "needs_auth") return "needs auth";
  return null;
}

export function McpPanel() {
  const status = useSessionStore((s) => s.mcpStatus);
  const loadMcpStatus = useSessionStore((s) => s.loadMcpStatus);

  useEffect(() => {
    loadMcpStatus();
  }, [loadMcpStatus]);

  const entries = Object.entries(status);
  if (entries.length === 0) return null;

  return (
    <SidebarCard title={`MCP (${entries.length})`}>
      <ul className="space-y-1">
        {entries.map(([name, s]) => {
          const sub = subtitle(s);
          return (
            <li key={name} className="flex items-start gap-2 text-xs">
              <span
                className={
                  "mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full " + dotColor(s)
                }
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-text-secondary">{name}</div>
                {sub && (
                  <div
                    className="truncate text-[10px] text-text-tertiary"
                    title={sub}
                  >
                    {sub}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </SidebarCard>
  );
}

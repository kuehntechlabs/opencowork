import { useEffect } from "react";
import { useSessionStore } from "../../stores/session-store";
import { SidebarCard } from "./SidebarCard";

function statusLabel(status: { status: string; error?: string }) {
  switch (status.status) {
    case "connected":
      return { text: "Connected", color: "text-green-500" };
    case "disabled":
      return { text: "Disabled", color: "text-text-tertiary" };
    case "failed":
      return {
        text: status.error ? `Failed: ${status.error}` : "Failed",
        color: "text-red-400",
      };
    case "needs_auth":
      return { text: "Needs auth", color: "text-yellow-500" };
    case "needs_client_registration":
      return { text: "Needs registration", color: "text-yellow-500" };
    default:
      return { text: status.status, color: "text-text-tertiary" };
  }
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
          const { text, color } = statusLabel(s);
          return (
            <li
              key={name}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="min-w-0 truncate text-text-secondary">
                {name}
              </span>
              <span className={`text-[11px] ${color}`}>{text}</span>
            </li>
          );
        })}
      </ul>
    </SidebarCard>
  );
}

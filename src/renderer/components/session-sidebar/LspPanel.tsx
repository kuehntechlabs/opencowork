import { useEffect } from "react";
import { useSessionStore } from "../../stores/session-store";
import { SidebarCard } from "./SidebarCard";

export function LspPanel() {
  const servers = useSessionStore((s) => s.lspStatus);
  const loadLspStatus = useSessionStore((s) => s.loadLspStatus);

  useEffect(() => {
    loadLspStatus();
  }, [loadLspStatus]);

  if (!servers || servers.length === 0) return null;

  return (
    <SidebarCard title={`LSP (${servers.length})`}>
      <ul className="space-y-1">
        {servers.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-2 text-xs"
            title={s.root}
          >
            <span
              className={
                "h-1.5 w-1.5 flex-shrink-0 rounded-full " +
                (s.status === "connected" ? "bg-green-500" : "bg-red-500")
              }
            />
            <span className="min-w-0 flex-1 truncate text-text-secondary">
              {s.name || s.id}
            </span>
          </li>
        ))}
      </ul>
    </SidebarCard>
  );
}

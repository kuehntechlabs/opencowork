import { useState } from "react";
import { useSessionStore } from "../../stores/session-store";
import { SidebarCard } from "./SidebarCard";

interface Props {
  sessionId: string;
}

const COLLAPSE_AFTER = 4;

export function FilesPanel({ sessionId }: Props) {
  const diffs = useSessionStore((s) => s.sessionDiffs[sessionId]);
  const [expanded, setExpanded] = useState(false);

  if (!diffs || diffs.length === 0) return null;

  const visible =
    expanded || diffs.length <= COLLAPSE_AFTER
      ? diffs
      : diffs.slice(0, COLLAPSE_AFTER);

  const totalAdds = diffs.reduce((s, d) => s + d.additions, 0);
  const totalDels = diffs.reduce((s, d) => s + d.deletions, 0);

  return (
    <SidebarCard title={`Modified Files (${diffs.length})`}>
      <div className="mb-1.5 text-[11px] text-text-tertiary">
        <span className="text-green-500">+{totalAdds}</span>{" "}
        <span className="text-red-500">-{totalDels}</span> across {diffs.length}{" "}
        file{diffs.length === 1 ? "" : "s"}
      </div>
      <ul className="space-y-1">
        {visible.map((d) => {
          const parts = d.file.split("/");
          const name = parts.pop() ?? d.file;
          const dir = parts.join("/");
          return (
            <li
              key={d.file}
              className="flex items-center gap-2 text-xs"
              title={d.file}
            >
              <span className="min-w-0 flex-1 truncate text-text-secondary">
                {dir && <span className="text-text-tertiary">{dir}/</span>}
                <span>{name}</span>
              </span>
              {d.additions > 0 && (
                <span className="text-green-500">+{d.additions}</span>
              )}
              {d.deletions > 0 && (
                <span className="text-red-500">-{d.deletions}</span>
              )}
            </li>
          );
        })}
      </ul>
      {diffs.length > COLLAPSE_AFTER && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[11px] text-text-tertiary hover:text-text"
        >
          {expanded
            ? "Show less"
            : `Show all (${diffs.length - COLLAPSE_AFTER} more)`}
        </button>
      )}
    </SidebarCard>
  );
}

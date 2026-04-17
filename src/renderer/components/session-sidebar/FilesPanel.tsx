import { useState } from "react";
import { useSessionStore } from "../../stores/session-store";

interface Props {
  sessionId: string;
}

const COLLAPSE_AFTER = 3;

export function FilesPanel({ sessionId }: Props) {
  const diffs = useSessionStore((s) => s.sessionDiffs[sessionId]);
  const [expanded, setExpanded] = useState(false);

  if (!diffs || diffs.length === 0) return null;

  const visible =
    expanded || diffs.length <= COLLAPSE_AFTER
      ? diffs
      : diffs.slice(0, COLLAPSE_AFTER);

  return (
    <div className="border-b border-border/40 px-3 py-2">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-text-tertiary">
        Modified Files
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
    </div>
  );
}

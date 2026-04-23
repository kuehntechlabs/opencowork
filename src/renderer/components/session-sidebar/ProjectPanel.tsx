import { useSessionStore } from "../../stores/session-store";
import { SidebarCard } from "./SidebarCard";

interface Props {
  sessionId: string;
}

export function ProjectPanel({ sessionId }: Props) {
  const session = useSessionStore((s) => s.sessions[sessionId]);
  if (!session?.directory) return null;
  const dir = session.directory;
  const name = dir.split("/").filter(Boolean).pop() ?? dir;

  const reveal = () => {
    window.api.openInFileManager(dir).catch(() => {});
  };

  return (
    <SidebarCard title="Project">
      <button
        type="button"
        onClick={reveal}
        className="flex w-full items-center gap-1.5 text-left text-xs text-text-secondary hover:text-text"
        title={dir}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="flex-shrink-0 text-text-tertiary"
        >
          <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
        </svg>
        <span className="truncate">{name}</span>
      </button>
      <div className="mt-1 truncate text-[10px] text-text-tertiary">{dir}</div>
    </SidebarCard>
  );
}

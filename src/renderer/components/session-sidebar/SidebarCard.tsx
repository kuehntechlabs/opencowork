import { useState, type ReactNode } from "react";

interface Props {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function SidebarCard({ title, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-border/50 bg-surface/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-text"
      >
        <span>{title}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={
            "text-text-tertiary transition-transform " +
            (open ? "rotate-180" : "")
          }
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-border/40 px-3 py-2">{children}</div>
      )}
    </section>
  );
}

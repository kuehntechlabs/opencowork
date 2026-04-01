interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function SidebarSearch({ value, onChange }: Props) {
  return (
    <div className="relative">
      <svg
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="text"
        placeholder="Search chats..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
      />
    </div>
  );
}

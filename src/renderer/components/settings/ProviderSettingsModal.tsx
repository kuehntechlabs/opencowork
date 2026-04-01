import { useSettingsStore } from "../../stores/settings-store";
import { ProviderSettings } from "./ProviderSettings";

export function ProviderSettingsModal() {
  const open = useSettingsStore((s) => s.settingsModalOpen);
  const close = () => useSettingsStore.getState().setSettingsModalOpen(false);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">Settings</h2>
          <button
            onClick={close}
            className="rounded-md p-1 text-text-tertiary hover:bg-surface-hover hover:text-text"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <ProviderSettings onClose={close} />
      </div>
    </div>
  );
}

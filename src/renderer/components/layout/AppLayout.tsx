import { Sidebar } from "./Sidebar";
import { RightPanel } from "./RightPanel";
import { useSettingsStore } from "../../stores/settings-store";
import { ProviderSettingsModal } from "../settings/ProviderSettingsModal";

export function AppLayout() {
  const sidebarOpen = useSettingsStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-full">
      {sidebarOpen && <Sidebar />}
      <RightPanel />
      <ProviderSettingsModal />
    </div>
  );
}

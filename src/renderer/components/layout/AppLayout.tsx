import { Sidebar } from "./Sidebar";
import { CollapsedSidebar } from "./CollapsedSidebar";
import { RightPanel } from "./RightPanel";
import { useSettingsStore } from "../../stores/settings-store";
import { ProviderSettingsModal } from "../settings/ProviderSettingsModal";
import { NewProjectModal } from "../home/NewProjectModal";
import { DirectoryPage } from "../pages/DirectoryPage";
import { ConfigPromptModal } from "../pages/ConfigPromptModal";
import { useDirectoryInstall } from "../../hooks/useDirectoryInstall";

export function AppLayout() {
  const sidebarOpen = useSettingsStore((s) => s.sidebarOpen);
  const rightPanelPage = useSettingsStore((s) => s.rightPanelPage);
  const setRightPanelPage = useSettingsStore((s) => s.setRightPanelPage);
  const directoryCategory = useSettingsStore((s) => s.directoryCategory);
  const {
    installedNames,
    installing,
    handleInstall,
    handleRemove,
    configPrompt,
    submitPrompt,
    cancelPrompt,
  } = useDirectoryInstall();

  return (
    <div className="relative flex h-full flex-col">
      {/* Full-width drag region / title bar for macOS */}
      <div className="drag-region h-12 w-full shrink-0 border-b border-border bg-surface-secondary" />

      <div className="relative flex flex-1 overflow-hidden">
        {sidebarOpen ? <Sidebar /> : <CollapsedSidebar />}
        <RightPanel />
      </div>
      <ProviderSettingsModal />
      <NewProjectModal />

      {/* Directory overlay — covers everything */}
      {rightPanelPage === "directory" && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setRightPanelPage("customize")}
          />
          <div className="fixed inset-6 top-10 z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl dark:bg-[#1a1a1a]">
            <DirectoryPage
              onClose={() => setRightPanelPage("customize")}
              onInstall={handleInstall}
              onRemove={handleRemove}
              installedNames={installedNames}
              installingNames={installing}
              initialCategory={directoryCategory}
            />
          </div>
        </>
      )}

      {/* Config prompt modal for env vars / headers */}
      {configPrompt && (
        <ConfigPromptModal
          prompt={configPrompt}
          onSubmit={submitPrompt}
          onCancel={cancelPrompt}
        />
      )}
    </div>
  );
}

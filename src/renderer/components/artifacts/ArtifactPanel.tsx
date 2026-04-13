import { useArtifactStore } from "../../stores/artifact-store";
import { ArtifactPanelHeader } from "./ArtifactPanelHeader";
import { HtmlArtifactRenderer } from "./HtmlArtifactRenderer";
import { ReactArtifactRenderer } from "./ReactArtifactRenderer";
import { BrowserPreview } from "./BrowserPreview";
import { NotebookRenderer } from "./NotebookRenderer";
import { CodeBlock } from "../chat/CodeBlock";

export function ArtifactPanel() {
  const activeId = useArtifactStore((s) => s.activeArtifactId);
  const artifact = useArtifactStore((s) =>
    s.activeArtifactId ? s.artifacts[s.activeArtifactId] : null,
  );
  const panelWidth = useArtifactStore((s) => s.panelWidth);
  const viewMode = useArtifactStore((s) => s.viewMode);

  if (!artifact) return null;

  const renderContent = () => {
    // Show loading state while artifact is still streaming
    if (artifact.loading) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-accent/20 border-t-accent" />
          <p className="text-sm text-text-tertiary">
            Generating {artifact.type === "react" ? "component" : "preview"}...
          </p>
        </div>
      );
    }

    // Code view mode for html/react
    if (
      viewMode === "code" &&
      (artifact.type === "html" || artifact.type === "react")
    ) {
      return (
        <div className="h-full overflow-auto p-3">
          <CodeBlock language={artifact.language ?? artifact.type}>
            {artifact.content ?? ""}
          </CodeBlock>
        </div>
      );
    }

    switch (artifact.type) {
      case "html":
        return <HtmlArtifactRenderer content={artifact.content ?? ""} />;
      case "react":
        return <ReactArtifactRenderer content={artifact.content ?? ""} />;
      case "browser":
        return <BrowserPreview url={artifact.url ?? "http://localhost:3000"} />;
      case "notebook":
        return <NotebookRenderer filePath={artifact.filePath ?? ""} />;
      default:
        return (
          <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
            Unsupported artifact type
          </div>
        );
    }
  };

  return (
    <div className="relative flex h-full flex-1 flex-col bg-surface">
      <ArtifactPanelHeader />
      <div className="flex-1 overflow-hidden">{renderContent()}</div>
    </div>
  );
}

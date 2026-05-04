import { useState, useRef, useCallback, useEffect } from "react";
import { useArtifactStore } from "../../stores/artifact-store";

interface Props {
  artifactId: string;
  url: string;
}

export function BrowserPreview({ artifactId, url: initialUrl }: Props) {
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(true);
  const webviewRef = useRef<HTMLElement>(null);
  const removeArtifact = useArtifactStore((s) => s.removeArtifact);

  useEffect(() => {
    setCurrentUrl(initialUrl);
  }, [initialUrl]);

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;

    const onStartLoad = () => setLoading(true);
    const onStopLoad = () => setLoading(false);
    const onNavigate = (e: Event) => {
      const url = (e as CustomEvent).detail?.url ?? (wv as any).getURL?.();
      if (url) setCurrentUrl(url);
    };

    wv.addEventListener("did-start-loading", onStartLoad);
    wv.addEventListener("did-stop-loading", onStopLoad);
    wv.addEventListener("did-navigate", onNavigate);
    wv.addEventListener("did-navigate-in-page", onNavigate);

    return () => {
      wv.removeEventListener("did-start-loading", onStartLoad);
      wv.removeEventListener("did-stop-loading", onStopLoad);
      wv.removeEventListener("did-navigate", onNavigate);
      wv.removeEventListener("did-navigate-in-page", onNavigate);
    };
  }, []);

  const handleBack = useCallback(() => {
    (webviewRef.current as any)?.goBack?.();
  }, []);

  const handleForward = useCallback(() => {
    (webviewRef.current as any)?.goForward?.();
  }, []);

  const handleReload = useCallback(() => {
    (webviewRef.current as any)?.reload?.();
  }, []);

  const handleClose = useCallback(() => {
    removeArtifact(artifactId);
  }, [artifactId, removeArtifact]);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-border bg-surface-secondary px-2 py-1.5">
        <button
          onClick={handleBack}
          className="rounded p-1 text-text-tertiary hover:bg-surface-hover hover:text-text"
          title="Back"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <button
          onClick={handleForward}
          className="rounded p-1 text-text-tertiary hover:bg-surface-hover hover:text-text"
          title="Forward"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
        <button
          onClick={handleReload}
          className="rounded p-1 text-text-tertiary hover:bg-surface-hover hover:text-text"
          title="Reload"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
        <div className="flex-1 truncate rounded bg-surface px-2 py-1 font-mono text-[11px] text-text-secondary">
          {loading && (
            <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          )}
          {currentUrl}
        </div>
        <button
          onClick={handleClose}
          className="rounded p-1 text-text-tertiary hover:bg-surface-hover hover:text-text"
          title="Close browser preview"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Webview */}
      {/* @ts-expect-error webview is an Electron-specific tag */}
      <webview
        ref={webviewRef as any}
        src={currentUrl}
        partition="artifact-browser"
        className="flex-1"
        style={{ display: "flex", flex: 1 }}
      />
    </div>
  );
}

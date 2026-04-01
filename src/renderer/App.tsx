import { useEffect, useState } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { setBaseUrl, checkHealth } from "./api/client";
import { connectSSE, disconnectSSE } from "./api/events";
import { useServerStore } from "./stores/server-store";
import { useSessionStore } from "./stores/session-store";
import { Spinner } from "./components/common/Spinner";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

export function App() {
  const { connected, initializing, setUrl, setConnected, setInitializing } =
    useServerStore();
  const loadSessions = useSessionStore((s) => s.loadSessions);
  const directory = useServerStore((s) => s.directory);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const serverUrl = await window.api.getServerUrl();
        if (cancelled) return;

        if (serverUrl) {
          setBaseUrl(serverUrl);
          setUrl(serverUrl);

          // Wait for server to be ready
          let retries = 0;
          while (retries < 30 && !cancelled) {
            const healthy = await checkHealth();
            if (healthy) {
              setConnected(true);
              connectSSE();
              break;
            }
            retries++;
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      } catch (err) {
        console.error("Init error:", err);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      disconnectSSE();
    };
  }, []);

  // Load sessions when connected and directory changes
  useEffect(() => {
    if (connected) {
      loadSessions(directory || undefined);
    }
  }, [connected, directory, loadSessions]);

  // Listen for menu commands
  useEffect(() => {
    return window.api.onMenuCommand((command) => {
      if (command === "new-chat") {
        useSessionStore.getState().setActiveSession(null);
      }
    });
  }, []);

  if (initializing) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Spinner size={32} />
        <p className="text-sm text-text-secondary">
          Starting OpenCode server...
        </p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm text-text-secondary">
          Could not connect to OpenCode server.
        </p>
        <button
          className="rounded bg-white/10 px-4 py-2 text-sm text-text-secondary hover:bg-white/20"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AppLayout />
    </ErrorBoundary>
  );
}

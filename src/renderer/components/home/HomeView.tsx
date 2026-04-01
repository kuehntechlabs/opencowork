import { useState, useCallback } from "react";
import { FolderPicker } from "./FolderPicker";
import { MessageInput } from "../input/MessageInput";
import { useSessionStore } from "../../stores/session-store";
import { useServerStore } from "../../stores/server-store";
import { useSettingsStore } from "../../stores/settings-store";
import { useProjectStore } from "../../stores/project-store";
import { useCurrentAgent } from "../input/ComposerBar";
import lampIconUrl from "../../assets/lamp-icon.png";

export function HomeView() {
  const createSession = useSessionStore((s) => s.createSession);
  const sendPrompt = useSessionStore((s) => s.sendPrompt);
  const directory = useServerStore((s) => s.directory);
  const connected = useServerStore((s) => s.connected);
  const { selectedProvider, selectedModel, permissionMode } =
    useSettingsStore();
  const agent = useCurrentAgent();
  const [sending, setSending] = useState(false);

  const setDirectory = useServerStore((s) => s.setDirectory);
  const { addRecentDirectory } = useProjectStore();

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || !connected) return;

      // Default to user home directory if none selected
      let dir = directory;
      if (!dir) {
        const path = await window.api.openDirectoryPicker();
        if (!path) return;
        dir = path;
        setDirectory(dir);
        addRecentDirectory(dir);
      }

      setSending(true);
      try {
        const action = permissionMode === "bypass" ? "allow" : "ask";
        const session = await createSession(dir, action);
        const model =
          selectedProvider && selectedModel
            ? { providerID: selectedProvider, modelID: selectedModel }
            : undefined;
        await sendPrompt(session.id, text, { model, agent });
      } catch (err) {
        console.error("Failed to create session:", err);
      } finally {
        setSending(false);
      }
    },
    [
      directory,
      connected,
      createSession,
      sendPrompt,
      selectedProvider,
      selectedModel,
      permissionMode,
      agent,
      setDirectory,
      addRecentDirectory,
    ],
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8">
      <div className="flex w-full max-w-2xl flex-col items-center gap-8">
        {/* Logo / Title */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
            <div
              className="h-11 w-11"
              style={{
                WebkitMaskImage: `url(${lampIconUrl})`,
                WebkitMaskSize: "contain",
                WebkitMaskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                maskImage: `url(${lampIconUrl})`,
                maskSize: "contain",
                maskRepeat: "no-repeat",
                maskPosition: "center",
                background: "linear-gradient(135deg, #3D4066 0%, #818CF9 100%)",
              }}
            />
          </div>
          <h1 className="text-2xl font-bold text-text">OpenCowork</h1>
          <p className="text-center text-sm text-text-secondary">
            Your AI assistant. Pick a folder and let's get to work.
          </p>
        </div>

        {/* Folder picker */}
        <FolderPicker />

        {/* Status */}
        {!connected && (
          <div className="flex items-center gap-2 text-sm text-text-tertiary">
            <span className="h-2 w-2 rounded-full bg-yellow-500" />
            Connecting to opencode server...
          </div>
        )}
        {connected && !directory && (
          <p className="text-sm text-text-tertiary">
            Select a project or folder to get started
          </p>
        )}

        {/* Input */}
        <div className="w-full">
          <MessageInput
            onSend={handleSend}
            disabled={!connected || sending}
            placeholder={
              !connected
                ? "Waiting for server..."
                : !directory
                  ? "Type to start — you'll pick a folder first"
                  : "What would you like to build?"
            }
          />
        </div>
      </div>
    </div>
  );
}

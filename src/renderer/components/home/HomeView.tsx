import { useState, useCallback } from "react";
import { FolderPicker } from "./FolderPicker";
import { ModelSelector } from "./ModelSelector";
import { MessageInput } from "../input/MessageInput";
import { useSessionStore } from "../../stores/session-store";
import { useServerStore } from "../../stores/server-store";
import { useSettingsStore } from "../../stores/settings-store";

export function HomeView() {
  const createSession = useSessionStore((s) => s.createSession);
  const sendPrompt = useSessionStore((s) => s.sendPrompt);
  const directory = useServerStore((s) => s.directory);
  const connected = useServerStore((s) => s.connected);
  const { selectedProvider, selectedModel } = useSettingsStore();
  const [sending, setSending] = useState(false);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || !directory || !connected) return;
      setSending(true);
      try {
        const session = await createSession(directory);
        const model =
          selectedProvider && selectedModel
            ? { providerID: selectedProvider, modelID: selectedModel }
            : undefined;
        await sendPrompt(session.id, text, model);
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
    ],
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8">
      <div className="flex w-full max-w-2xl flex-col items-center gap-8">
        {/* Logo / Title */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              className="text-accent"
            >
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
                fill="currentColor"
                opacity="0.2"
              />
              <path
                d="M8 12l3 3 5-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text">OpenCowork</h1>
          <p className="text-center text-sm text-text-secondary">
            AI-powered coding assistant. Choose a folder, select your model, and
            start coding.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <FolderPicker />
          <ModelSelector />
        </div>

        {/* Status */}
        {!connected && (
          <div className="flex items-center gap-2 text-sm text-text-tertiary">
            <span className="h-2 w-2 rounded-full bg-yellow-500" />
            Connecting to opencode server...
          </div>
        )}
        {connected && !directory && (
          <p className="text-sm text-text-tertiary">
            Select a working directory to get started
          </p>
        )}

        {/* Input */}
        <div className="w-full">
          <MessageInput
            onSend={handleSend}
            disabled={!connected || !directory || sending}
            placeholder={
              !connected
                ? "Waiting for server..."
                : !directory
                  ? "Choose a directory first..."
                  : "What would you like to build?"
            }
          />
        </div>
      </div>
    </div>
  );
}

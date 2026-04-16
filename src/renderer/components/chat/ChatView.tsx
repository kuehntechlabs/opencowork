import { useCallback } from "react";
import { MessageList } from "./MessageList";
import { MessageInput } from "../input/MessageInput";
import { PermissionBanner } from "./PermissionBanner";
import { useSessionStore } from "../../stores/session-store";
import { useSettingsStore } from "../../stores/settings-store";
import { useCurrentAgent } from "../input/ComposerBar";
import { useArtifactDetector } from "../../hooks/useArtifactDetector";
import * as api from "../../api/client";

interface Props {
  sessionId: string;
}

const emptyMessages: never[] = [];

export function ChatView({ sessionId }: Props) {
  const session = useSessionStore((s) => s.sessions[sessionId]);
  const messages =
    useSessionStore((s) => s.messages[sessionId]) ?? emptyMessages;
  const status = useSessionStore((s) => s.sessionStatus[sessionId]);
  const sendPrompt = useSessionStore((s) => s.sendPrompt);
  const abortSession = useSessionStore((s) => s.abortSession);
  const { selectedProvider, selectedModel } = useSettingsStore();
  const agent = useCurrentAgent();
  const isBusy = status?.type === "busy";

  useArtifactDetector(sessionId);

  const handleSend = useCallback(
    async (text: string) => {
      // If busy, abort current generation first then send
      if (status?.type === "busy") {
        await abortSession(sessionId);
      }

      // Detect slash commands: "/command args"
      if (text.startsWith("/")) {
        const [head, ...tail] = text.split(/\s+/);
        const commandName = head.slice(1);
        if (commandName) {
          const model =
            selectedProvider && selectedModel
              ? `${selectedProvider}/${selectedModel}`
              : undefined;
          await api
            .executeCommand(sessionId, commandName, tail.join(" "), { model })
            .catch((err) => console.error("Command execution failed:", err));
          return;
        }
      }

      const model =
        selectedProvider && selectedModel
          ? { providerID: selectedProvider, modelID: selectedModel }
          : undefined;
      await sendPrompt(sessionId, text, { model, agent });
    },
    [
      sessionId,
      sendPrompt,
      abortSession,
      status,
      selectedProvider,
      selectedModel,
      agent,
    ],
  );

  const handleAbort = useCallback(() => {
    abortSession(sessionId);
  }, [sessionId, abortSession]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 className="truncate text-sm font-medium text-text">
          {session?.title || "New Chat"}
        </h2>
        {session?.directory && (
          <span className="ml-2 truncate text-xs text-text-tertiary">
            {session.directory}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <MessageList sessionId={sessionId} messages={messages} />
      </div>

      {/* Permission requests */}
      <PermissionBanner sessionId={sessionId} />

      {/* Input */}
      <div className="border-t border-border p-4">
        <MessageInput
          onSend={handleSend}
          isBusy={isBusy}
          onAbort={handleAbort}
          placeholder={isBusy ? "Send to interrupt..." : "Send a message..."}
        />
      </div>
    </div>
  );
}

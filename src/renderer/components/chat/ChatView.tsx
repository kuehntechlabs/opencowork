import { useCallback } from "react";
import { MessageList } from "./MessageList";
import { MessageInput } from "../input/MessageInput";
import { PermissionBanner } from "./PermissionBanner";
import { useSessionStore } from "../../stores/session-store";
import { useSettingsStore } from "../../stores/settings-store";
import { Spinner } from "../common/Spinner";

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
  const isBusy = status?.type === "busy";

  const handleSend = useCallback(
    async (text: string) => {
      const model =
        selectedProvider && selectedModel
          ? { providerID: selectedProvider, modelID: selectedModel }
          : undefined;
      await sendPrompt(sessionId, text, { model });
    },
    [sessionId, sendPrompt, selectedProvider, selectedModel],
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
        {isBusy && (
          <div className="flex items-center gap-2 px-6 py-3">
            <Spinner size={16} />
            <span className="text-xs text-text-tertiary">Thinking...</span>
          </div>
        )}
      </div>

      {/* Permission requests */}
      <PermissionBanner sessionId={sessionId} />

      {/* Input */}
      <div className="border-t border-border p-4">
        {isBusy ? (
          <button
            onClick={handleAbort}
            className="w-full rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 text-sm text-red-400 transition-colors hover:bg-red-500/20"
          >
            Stop generating
          </button>
        ) : (
          <MessageInput onSend={handleSend} placeholder="Send a message..." />
        )}
      </div>
    </div>
  );
}

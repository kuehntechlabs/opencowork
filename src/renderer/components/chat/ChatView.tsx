import { useCallback, useMemo } from "react";
import { MessageList } from "./MessageList";
import { MessageInput } from "../input/MessageInput";
import { PermissionBanner } from "./PermissionBanner";
import { useSessionStore } from "../../stores/session-store";
import { useSettingsStore } from "../../stores/settings-store";
import { useCurrentAgent } from "../input/ComposerBar";
import { useArtifactDetector } from "../../hooks/useArtifactDetector";
import type { PromptPartInput } from "../../api/types";

interface Props {
  sessionId: string;
}

const emptyMessages: never[] = [];

export function ChatView({ sessionId }: Props) {
  const session = useSessionStore((s) => s.sessions[sessionId]);
  const messages =
    useSessionStore((s) => s.messages[sessionId]) ?? emptyMessages;
  const revertPointer = session?.revert?.messageID;
  const visibleMessages = useMemo(
    () =>
      revertPointer ? messages.filter((m) => m.id < revertPointer) : messages,
    [messages, revertPointer],
  );
  const status = useSessionStore((s) => s.sessionStatus[sessionId]);
  const sendPrompt = useSessionStore((s) => s.sendPrompt);
  const abortSession = useSessionStore((s) => s.abortSession);
  const { selectedProvider, selectedModel, selectedVariant } =
    useSettingsStore();
  const agent = useCurrentAgent();
  const isBusy = status?.type === "busy";

  useArtifactDetector(sessionId);

  const handleSend = useCallback(
    async (text: string, attachments?: PromptPartInput[]) => {
      // If busy, abort current generation first then send
      if (status?.type === "busy") {
        await abortSession(sessionId);
      }

      const model =
        selectedProvider && selectedModel
          ? { providerID: selectedProvider, modelID: selectedModel }
          : undefined;
      const parts: PromptPartInput[] = [
        ...(attachments ?? []),
        { type: "text", text },
      ];
      await sendPrompt(sessionId, parts, {
        model,
        agent,
        variant: selectedVariant ?? undefined,
      });
      return true;
    },
    [
      sessionId,
      sendPrompt,
      abortSession,
      status,
      selectedProvider,
      selectedModel,
      selectedVariant,
      agent,
    ],
  );

  const handleAbort = useCallback(() => {
    abortSession(sessionId);
  }, [sessionId, abortSession]);

  const openInFileManagerTooltip = useMemo(() => {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes("mac")) return "Show in Finder";
    if (platform.includes("win")) return "Show in Explorer";
    return "Open folder";
  }, []);

  const handleOpenInFileManager = useCallback(() => {
    if (!session?.directory) return;
    window.api.openInFileManager(session.directory).catch(() => {});
  }, [session?.directory]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 className="truncate text-sm font-medium text-text">
          {session?.title || "New Chat"}
        </h2>
        {session?.directory && (
          <div className="ml-2 flex min-w-0 items-center gap-1">
            <span className="truncate text-xs text-text-tertiary">
              {session.directory}
            </span>
            <button
              type="button"
              onClick={handleOpenInFileManager}
              title={openInFileManagerTooltip}
              aria-label={openInFileManagerTooltip}
              className="flex-shrink-0 rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <MessageList sessionId={sessionId} messages={visibleMessages} />
      </div>

      {/* Permission requests */}
      <PermissionBanner sessionId={sessionId} />

      {/* Input */}
      <div className="border-t border-border p-4">
        <MessageInput
          onSend={handleSend}
          draftKey={sessionId}
          isBusy={isBusy}
          onAbort={handleAbort}
          placeholder={isBusy ? "Send to interrupt..." : "Send a message..."}
        />
      </div>
    </div>
  );
}

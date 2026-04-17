import { useMemo } from "react";
import { useSessionStore } from "../../stores/session-store";
import type { AssistantMessage, Message } from "../../api/types";

interface Props {
  sessionId: string;
}

function isAssistant(m: Message): m is AssistantMessage {
  return m.role === "assistant";
}

export function ContextPanel({ sessionId }: Props) {
  const messages = useSessionStore((s) => s.messages[sessionId]);

  const stats = useMemo(() => {
    if (!messages || messages.length === 0) return null;
    const assistants = messages.filter(isAssistant);
    if (assistants.length === 0) return null;
    const latest = assistants[assistants.length - 1];
    const tokens = latest.tokens;
    const latestTokens = tokens
      ? tokens.input +
        tokens.output +
        tokens.reasoning +
        (tokens.cache?.read ?? 0) +
        (tokens.cache?.write ?? 0)
      : 0;
    const totalCost = assistants.reduce((sum, m) => sum + (m.cost ?? 0), 0);
    return { latestTokens, totalCost };
  }, [messages]);

  if (!stats) return null;

  return (
    <div className="border-b border-border/40 px-3 py-2">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-text-tertiary">
        Context
      </div>
      <div className="flex items-center justify-between text-xs text-text-secondary">
        <span>{stats.latestTokens.toLocaleString()} tokens</span>
        {stats.totalCost > 0 && <span>${stats.totalCost.toFixed(4)}</span>}
      </div>
    </div>
  );
}

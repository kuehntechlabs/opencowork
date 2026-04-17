import { useEffect, useMemo } from "react";
import { useSessionStore } from "../../stores/session-store";
import type { AssistantMessage, Message } from "../../api/types";
import { SidebarCard } from "./SidebarCard";

interface Props {
  sessionId: string;
}

function isAssistant(m: Message): m is AssistantMessage {
  return m.role === "assistant";
}

export function ContextPanel({ sessionId }: Props) {
  const messages = useSessionStore((s) => s.messages[sessionId]);
  const providers = useSessionStore((s) => s.providers);
  const loadProviders = useSessionStore((s) => s.loadProviders);

  useEffect(() => {
    if (providers.length === 0) loadProviders();
  }, [providers.length, loadProviders]);

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

    const provider = providers.find((p) => p.id === latest.providerID);
    const model = provider?.models?.[latest.modelID];
    const context = model?.limit?.context;
    const percent =
      context && context > 0
        ? Math.min(100, Math.round((latestTokens / context) * 100))
        : null;

    return { latestTokens, totalCost, context, percent };
  }, [messages, providers]);

  if (!stats) return null;

  return (
    <SidebarCard title="Context">
      <div className="space-y-1 text-xs">
        <div className="flex items-baseline justify-between">
          <span className="text-text">
            {stats.latestTokens.toLocaleString()}
          </span>
          <span className="text-[10px] text-text-tertiary">tokens</span>
        </div>
        {stats.percent !== null && stats.context && (
          <>
            <div className="text-[11px] text-text-tertiary">
              {stats.percent}% used · {stats.context.toLocaleString()} limit
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-surface-tertiary">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </>
        )}
        {stats.totalCost > 0 && (
          <div className="pt-1 text-[11px] text-text-tertiary">
            ${stats.totalCost.toFixed(4)} spent
          </div>
        )}
      </div>
    </SidebarCard>
  );
}

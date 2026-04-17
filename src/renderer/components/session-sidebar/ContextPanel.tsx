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

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
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
    const t = latest.tokens;
    const input = t?.input ?? 0;
    const output = t?.output ?? 0;
    const reasoning = t?.reasoning ?? 0;
    const cacheRead = t?.cache?.read ?? 0;
    const cacheWrite = t?.cache?.write ?? 0;
    const total = input + output + reasoning + cacheRead + cacheWrite;
    const totalCost = assistants.reduce((sum, m) => sum + (m.cost ?? 0), 0);

    const provider = providers.find((p) => p.id === latest.providerID);
    const model = provider?.models?.[latest.modelID];
    const context = model?.limit?.context;
    const percent =
      context && context > 0
        ? Math.min(100, Math.round((total / context) * 100))
        : null;

    return { input, output, total, totalCost, context, percent };
  }, [messages, providers]);

  if (!stats) return null;

  return (
    <SidebarCard title="Context">
      <div className="space-y-2 text-xs">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-text">
            {stats.total.toLocaleString()}
          </span>
          <span className="text-[10px] text-text-tertiary">tokens</span>
        </div>

        {stats.percent !== null && stats.context && (
          <div>
            <div className="text-[11px] text-text-tertiary">
              {stats.percent}% of {formatCompact(stats.context)}
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-tertiary">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 text-[11px] text-text-secondary">
          <span className="flex items-center gap-1" title="Input tokens">
            <span className="text-text-tertiary">↓</span>
            <span className="tabular-nums">
              {stats.input.toLocaleString()}
            </span>
          </span>
          <span className="flex items-center gap-1" title="Output tokens">
            <span className="text-text-tertiary">↑</span>
            <span className="tabular-nums">
              {stats.output.toLocaleString()}
            </span>
          </span>
        </div>

        {stats.totalCost > 0 && (
          <div className="text-[11px] text-text-tertiary">
            ${stats.totalCost.toFixed(4)} spent
          </div>
        )}
      </div>
    </SidebarCard>
  );
}

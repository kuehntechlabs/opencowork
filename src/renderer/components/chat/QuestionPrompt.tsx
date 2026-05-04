import { useState } from "react";
import type { QuestionRequest } from "../../api/types";
import * as api from "../../api/client";
import { useSessionStore } from "../../stores/session-store";

interface Props {
  request: QuestionRequest;
}

type Selections = Record<number, Set<string>>;
type CustomAnswers = Record<number, string>;

export function QuestionPrompt({ request }: Props) {
  const directory = useSessionStore(
    (s) => s.sessions[request.sessionID]?.directory,
  );
  const [selected, setSelected] = useState<Selections>({});
  const [custom, setCustom] = useState<CustomAnswers>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (qIdx: number, label: string, multiple: boolean) => {
    setSelected((prev) => {
      const current = prev[qIdx] ?? new Set<string>();
      const next = new Set(multiple ? current : []);
      if (current.has(label)) next.delete(label);
      else next.add(label);
      return { ...prev, [qIdx]: next };
    });
  };

  const setCustomFor = (qIdx: number, value: string) =>
    setCustom((prev) => ({ ...prev, [qIdx]: value }));

  const buildAnswers = (): string[][] =>
    request.questions.map((_, i) => {
      const labels = [...(selected[i] ?? [])];
      const typed = custom[i]?.trim();
      if (typed) labels.push(typed);
      return labels;
    });

  const canSubmit = request.questions.every((_, i) => {
    const hasOption = (selected[i]?.size ?? 0) > 0;
    const hasCustom = (custom[i]?.trim().length ?? 0) > 0;
    return hasOption || hasCustom;
  });

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.replyQuestion(request.id, buildAnswers(), directory);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send answer");
      setSubmitting(false);
    }
  };

  return (
    <div className="my-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
      {request.questions.map((q, qIdx) => {
        const multiple = !!q.multiple;
        const allowCustom = q.custom !== false;
        const picked = selected[qIdx] ?? new Set<string>();
        return (
          <div key={qIdx} className={qIdx > 0 ? "mt-3" : ""}>
            {q.header && (
              <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                {q.header}
              </div>
            )}
            <div className="mb-2 text-sm text-text">{q.question}</div>
            <div className="space-y-1">
              {q.options.map((o) => {
                const isPicked = picked.has(o.label);
                return (
                  <button
                    key={o.label}
                    type="button"
                    onClick={() => toggle(qIdx, o.label, multiple)}
                    disabled={submitting}
                    className={
                      "flex w-full items-start gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors " +
                      (isPicked
                        ? "border-accent bg-accent/10"
                        : "border-border hover:border-accent/50 hover:bg-surface-hover")
                    }
                  >
                    <span
                      className={
                        "mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center " +
                        (multiple
                          ? "rounded-sm border"
                          : "rounded-full border") +
                        (isPicked
                          ? " border-accent bg-accent text-accent-text"
                          : " border-border")
                      }
                    >
                      {isPicked &&
                        (multiple ? (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-accent-text" />
                        ))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-text">
                        {o.label}
                      </span>
                      {o.description && (
                        <span className="block text-[11px] text-text-tertiary">
                          {o.description}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
              {allowCustom && (
                <input
                  type="text"
                  value={custom[qIdx] ?? ""}
                  onChange={(e) => setCustomFor(qIdx, e.target.value)}
                  placeholder="Or type your own answer…"
                  disabled={submitting}
                  className="w-full rounded-md border border-border bg-surface-secondary px-2.5 py-1.5 text-xs text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
                />
              )}
            </div>
          </div>
        );
      })}

      {error && (
        <div className="mt-2 text-xs text-red-400" role="alert">
          {error}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-text transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          {submitting ? "Sending…" : "Send answer"}
        </button>
      </div>
    </div>
  );
}

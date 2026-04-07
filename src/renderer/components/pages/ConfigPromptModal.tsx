import { useState, useEffect } from "react";
import type { ConfigPrompt } from "../../hooks/useDirectoryInstall";

interface Props {
  prompt: ConfigPrompt;
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
}

export function ConfigPromptModal({ prompt, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of prompt.fields) init[f.key] = "";
    return init;
  });

  // Reset values when prompt changes
  useEffect(() => {
    const init: Record<string, string> = {};
    for (const f of prompt.fields) init[f.key] = "";
    setValues(init);
  }, [prompt]);

  // Escape to cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  const allFilled = prompt.fields.every((f) => values[f.key]?.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allFilled) return;
    onSubmit(values);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl"
      >
        <h2 className="mb-1 text-lg font-semibold text-text">{prompt.title}</h2>
        <p className="mb-5 text-xs text-text-tertiary">
          Fill in the required configuration to connect this server.
        </p>

        <div className="flex flex-col gap-4">
          {prompt.fields.map((field, idx) => (
            <div key={field.key}>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                {field.key}
              </label>
              {field.label && field.label !== field.key && (
                <p className="mb-1.5 text-[11px] text-text-tertiary">
                  {field.label}
                </p>
              )}
              <input
                type={field.secret ? "password" : "text"}
                value={values[field.key] || ""}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    [field.key]: e.target.value,
                  }))
                }
                placeholder={field.key}
                autoFocus={idx === 0}
                className="w-full rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
              />
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm text-text transition-colors hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!allFilled}
            className="rounded-lg bg-accent px-4 py-2 text-sm text-accent-text transition-colors hover:bg-accent/80 disabled:opacity-50"
          >
            Connect
          </button>
        </div>
      </form>
    </div>
  );
}

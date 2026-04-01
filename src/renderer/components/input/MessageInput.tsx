import { useState, useRef, useCallback } from "react";
import { VoiceButton } from "./VoiceButton";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({ onSend, disabled, placeholder }: Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const handleVoiceTranscript = useCallback((transcript: string) => {
    setText((prev) => (prev ? prev + " " + transcript : transcript));
  }, []);

  return (
    <div className="flex items-end gap-2 rounded-xl border border-border bg-surface-secondary p-2 focus-within:border-accent">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Type a message..."}
        disabled={disabled}
        rows={1}
        className="max-h-[200px] min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-text placeholder:text-text-tertiary focus:outline-none disabled:opacity-50"
      />
      <div className="flex items-center gap-1">
        <VoiceButton onTranscript={handleVoiceTranscript} />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-text transition-colors hover:bg-accent-hover disabled:opacity-30"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

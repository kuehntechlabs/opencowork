import { useVoice } from "../../hooks/useVoice";

interface Props {
  onTranscript: (text: string) => void;
}

export function VoiceButton({ onTranscript }: Props) {
  const { isListening, toggleListening } = useVoice(onTranscript);

  return (
    <button
      onClick={toggleListening}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
        isListening
          ? "bg-red-500/20 text-red-400"
          : "text-text-tertiary hover:bg-surface-hover hover:text-text"
      }`}
      title={isListening ? "Stop recording" : "Voice input"}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        {isListening ? (
          <>
            <rect
              x="6"
              y="6"
              width="12"
              height="12"
              rx="2"
              fill="currentColor"
            />
          </>
        ) : (
          <>
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </>
        )}
      </svg>
      {isListening && (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-red-500" />
      )}
    </button>
  );
}

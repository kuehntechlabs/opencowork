import { useEffect, useLayoutEffect, useRef } from "react";
import type { Message } from "../../api/types";
import { MessageBubble } from "./MessageBubble";
import { useSessionStore } from "../../stores/session-store";

interface Props {
  sessionId: string;
  messages: Message[];
}

const scrollPositions = new Map<string, number>();
const NEAR_BOTTOM_PX = 80;

export function MessageList({ sessionId, messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const restoredSessionRef = useRef<string | null>(null);
  const previousMessagesRef = useRef<{
    sessionId: string | null;
    length: number;
    lastId: string | null;
  }>({ sessionId: null, length: 0, lastId: null });
  const status = useSessionStore((s) => s.sessionStatus[sessionId]);
  const isBusy = status?.type === "busy";
  const hasMessages = messages.length > 0;

  const getScroller = () => containerRef.current?.parentElement ?? null;
  const updateScrollState = (scroller: HTMLElement) => {
    const distanceFromBottom =
      scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
    isNearBottomRef.current = distanceFromBottom <= NEAR_BOTTOM_PX;
    scrollPositions.set(sessionId, scroller.scrollTop);
  };

  useEffect(() => {
    const scroller = getScroller();
    if (!scroller) return;

    const updatePosition = () => {
      updateScrollState(scroller);
    };

    updatePosition();
    scroller.addEventListener("scroll", updatePosition, { passive: true });
    return () => {
      updatePosition();
      scroller.removeEventListener("scroll", updatePosition);
    };
  }, [sessionId, hasMessages]);

  useEffect(() => {
    const scroller = getScroller();
    const container = containerRef.current;
    if (!scroller || !container || typeof ResizeObserver === "undefined") {
      return;
    }

    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (!isNearBottomRef.current) return;
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        scroller.scrollTop = scroller.scrollHeight;
        updateScrollState(scroller);
      });
    });

    observer.observe(container);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [sessionId, hasMessages]);

  useLayoutEffect(() => {
    const scroller = getScroller();
    if (!scroller) return;

    if (restoredSessionRef.current !== sessionId) {
      restoredSessionRef.current = sessionId;
      const savedTop = scrollPositions.get(sessionId);
      if (savedTop === undefined) {
        scroller.scrollTop = scroller.scrollHeight;
      } else {
        scroller.scrollTop = savedTop;
      }
      updateScrollState(scroller);
    }
  }, [sessionId, hasMessages]);

  useLayoutEffect(() => {
    const scroller = getScroller();
    const previous = previousMessagesRef.current;
    const lastMessage = messages[messages.length - 1] ?? null;

    if (previous.sessionId !== sessionId) {
      previousMessagesRef.current = {
        sessionId,
        length: messages.length,
        lastId: lastMessage?.id ?? null,
      };
      return;
    }

    const appended =
      messages.length > previous.length && lastMessage?.id !== previous.lastId;

    previousMessagesRef.current = {
      sessionId,
      length: messages.length,
      lastId: lastMessage?.id ?? null,
    };

    if (!scroller || !appended) return;

    if (isNearBottomRef.current || lastMessage?.role === "user") {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
      updateScrollState(scroller);
    }
  }, [messages, sessionId]);

  if (!hasMessages) {
    if (isBusy) {
      return (
        <div className="flex h-full items-center justify-center gap-2 text-sm text-text-tertiary">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-text-tertiary/30 border-t-text-tertiary" />
          Sending…
        </div>
      );
    }
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
        Start a conversation…
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-4 px-4 py-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

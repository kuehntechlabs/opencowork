import { fetchEventSource } from "@microsoft/fetch-event-source";
import { getBaseUrl, getCredentials } from "./client";
import type { GlobalEvent } from "./types";
import { useSessionStore } from "../stores/session-store";
import { useServerStore } from "../stores/server-store";

let abort: AbortController | null = null;
let streamMode: "all" | "directory" = "all";

export function isSSEDirectoryScoped() {
  return streamMode === "directory";
}

export function connectSSE() {
  const url = getBaseUrl();
  const password = getCredentials();
  if (!url || !password) return;

  disconnectSSE();
  abort = new AbortController();

  const directory = useServerStore.getState().directory;
  const params = new URLSearchParams();
  if (streamMode === "directory" && directory) params.set("directory", directory);
  const sseUrl = `${url}/global/event${params.toString() ? "?" + params.toString() : ""}`;
  const auth = "Basic " + btoa("opencode:" + password);

  let opened = false;
  fetchEventSource(sseUrl, {
    signal: abort.signal,
    headers: { Authorization: auth },
    openWhenHidden: true,
    onopen: async (res) => {
      if (res.status === 200) {
        opened = true;
        useServerStore.getState().setConnected(true);
        return;
      }
      throw new Error(`SSE open failed status=${res.status}`);
    },
    onmessage: (ev) => {
      if (!ev.data) return;
      try {
        const data = JSON.parse(ev.data) as GlobalEvent;
        handleEvent(data);
      } catch {
        // ignore parse errors
      }
    },
    onerror: (err) => {
      useServerStore.getState().setConnected(false);
      if (!opened && streamMode === "all") {
        // Flip to directory mode and let the polyfill retry on the new URL.
        streamMode = "directory";
        // Re-throw an Error so fetchEventSource closes this stream;
        // then reconnect via a fresh call (the polyfill's auto-retry won't
        // pick up the URL change otherwise).
        setTimeout(() => connectSSE(), 0);
        throw err;
      }
      // Otherwise, let the polyfill retry with our backoff delay (ms).
      return 2000;
    },
  }).catch(() => {
    // Aborted or final failure — leave it; the renderer will retry on user action.
  });
}

export function disconnectSSE() {
  if (abort) {
    abort.abort();
    abort = null;
  }
}

function handleEvent(event: GlobalEvent) {
  const { payload } = event;
  const store = useSessionStore.getState();

  switch (payload.type) {
    case "session.created":
      store.upsertSession(payload.properties.info);
      break;

    case "session.updated":
      store.upsertSession(payload.properties.info);
      break;

    case "session.deleted":
      store.removeSession(payload.properties.sessionID);
      break;

    case "session.status":
      store.setSessionStatus(
        payload.properties.sessionID,
        payload.properties.status,
      );
      break;

    case "message.updated":
      store.upsertMessage(
        payload.properties.sessionID,
        payload.properties.info,
      );
      if (
        payload.properties.info.role === "assistant" &&
        payload.properties.info.time.completed
      ) {
        store.loadSessionDiff(payload.properties.sessionID);
      }
      break;

    case "message.removed":
      store.removeMessage(
        payload.properties.sessionID,
        payload.properties.messageID,
      );
      break;

    case "message.part.updated":
      store.upsertPart(payload.properties.sessionID, payload.properties.part);
      break;

    case "message.part.removed":
      store.removePart(
        payload.properties.sessionID,
        payload.properties.messageID,
        payload.properties.partID,
      );
      break;

    case "message.part.delta":
      store.applyDelta(
        payload.properties.sessionID,
        payload.properties.messageID,
        payload.properties.partID,
        payload.properties.field,
        payload.properties.delta,
      );
      break;

    case "permission.asked":
      store.addPermissionRequest(payload.properties);
      break;

    case "permission.replied":
      store.removePermissionRequest(payload.properties.requestID);
      break;

    case "todo.updated":
      store.upsertTodos(payload.properties.sessionID, payload.properties.todos);
      break;

    case "lsp.updated":
      store.loadLspStatus();
      break;

    case "question.asked":
      store.upsertPendingQuestion(payload.properties);
      break;

    case "question.replied":
    case "question.rejected":
      store.clearPendingQuestion(
        payload.properties.sessionID,
        payload.properties.requestID,
      );
      break;
  }
}

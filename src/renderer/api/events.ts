import { getBaseUrl } from "./client";
import type { GlobalEvent, Part } from "./types";
import { useSessionStore } from "../stores/session-store";
import { useServerStore } from "../stores/server-store";

let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let streamMode: "all" | "directory" = "all";

export function isSSEDirectoryScoped() {
  return streamMode === "directory";
}

export function connectSSE() {
  const url = getBaseUrl();
  if (!url) return;

  disconnectSSE();

  let opened = false;
  const directory = useServerStore.getState().directory;
  const params = new URLSearchParams();
  if (streamMode === "directory" && directory) {
    params.set("directory", directory);
  }
  const sseUrl = `${url}/global/event${
    params.toString() ? "?" + params.toString() : ""
  }`;
  eventSource = new EventSource(sseUrl);

  eventSource.onopen = () => {
    opened = true;
    useServerStore.getState().setConnected(true);
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as GlobalEvent;
      handleEvent(data);
    } catch {
      // ignore parse errors
    }
  };

  eventSource.onerror = () => {
    useServerStore.getState().setConnected(false);
    eventSource?.close();
    eventSource = null;

    // Reconnect after 2 seconds
    reconnectTimer = setTimeout(() => {
      if (!opened && streamMode === "all") {
        streamMode = "directory";
      }
      connectSSE();
    }, 2000);
  };
}

export function disconnectSSE() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

function handleEvent(event: GlobalEvent) {
  const { payload, directory } = event;
  const store = useSessionStore.getState();
  const sessionID = (payload.properties as { sessionID?: string }).sessionID;
  if (sessionID) {
    store.rememberSessionDirectory(sessionID, directory);
  }

  switch (payload.type) {
    case "session.created":
      store.upsertSession(payload.properties.info, directory);
      break;

    case "session.updated":
      store.upsertSession(payload.properties.info, directory);
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

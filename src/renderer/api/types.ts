// Core types matching the opencode SDK types

export interface Session {
  id: string;
  slug: string;
  projectID: string;
  workspaceID?: string;
  directory: string;
  parentID?: string;
  title: string;
  version: string;
  time: {
    created: number;
    updated: number;
    compacting?: number;
    archived?: number;
  };
  summary?: {
    additions: number;
    deletions: number;
    files: number;
  };
  share?: { url: string };
  revert?: {
    messageID: string;
    partID?: string;
    snapshot?: string;
    diff?: string;
  };
}

export interface UserMessage {
  id: string;
  sessionID: string;
  role: "user";
  time: { created: number };
  agent: string;
  model: { providerID: string; modelID: string };
}

export interface AssistantMessage {
  id: string;
  sessionID: string;
  role: "assistant";
  time: { created: number; completed?: number };
  parentID: string;
  modelID: string;
  providerID: string;
  mode: string;
  agent: string;
  path: { cwd: string; root: string };
  cost: number;
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cache: { read: number; write: number };
  };
  error?: SessionError;
  finish?: string;
}

export type Message = UserMessage | AssistantMessage;

export interface TextPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "text";
  text: string;
  synthetic?: boolean;
  time?: { start: number; end?: number };
}

export interface ReasoningPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "reasoning";
  text: string;
  time: { start: number; end?: number };
}

export interface ToolStatePending {
  status: "pending";
  input: Record<string, unknown>;
}

export interface ToolStateRunning {
  status: "running";
  input: Record<string, unknown>;
  title?: string;
  time: { start: number };
}

export interface ToolStateCompleted {
  status: "completed";
  input: Record<string, unknown>;
  output: string;
  title: string;
  time: { start: number; end: number };
}

export interface ToolStateError {
  status: "error";
  input: Record<string, unknown>;
  error: string;
  time: { start: number; end: number };
}

export type ToolState =
  | ToolStatePending
  | ToolStateRunning
  | ToolStateCompleted
  | ToolStateError;

export interface ToolPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "tool";
  callID: string;
  tool: string;
  state: ToolState;
}

export interface StepStartPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "step-start";
}

export interface StepFinishPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "step-finish";
  reason: string;
  cost: number;
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cache: { read: number; write: number };
  };
}

export interface FilePart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "file";
  mime: string;
  filename?: string;
  url: string;
}

export interface TextPartInput {
  type: "text";
  text: string;
}

export interface FilePartInput {
  type: "file";
  mime: string;
  filename?: string;
  url: string;
}

export type PromptPartInput = TextPartInput | FilePartInput;

export interface AgentPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "agent";
  name: string;
}

export type Part =
  | TextPart
  | ReasoningPart
  | ToolPart
  | StepStartPart
  | StepFinishPart
  | FilePart
  | AgentPart;

export type SessionStatus =
  | { type: "idle" }
  | { type: "busy" }
  | { type: "retry"; attempt: number; message: string; next: number };

export interface SessionError {
  name: string;
  data: Record<string, unknown>;
}

export interface Provider {
  id: string;
  name: string;
  models: Record<string, Model>;
}

export interface Model {
  id: string;
  name: string;
  variants?: Record<string, unknown>;
  cost?: {
    input: number;
    output: number;
  };
  status?: "alpha" | "beta" | "deprecated" | "active";
  capabilities?: {
    reasoning?: boolean;
    toolcall?: boolean;
  };
}

export interface AgentInfo {
  name: string;
  description: string;
  mode: "subagent" | "primary" | "all";
  native: boolean;
  hidden: boolean;
}

export interface PermissionRequest {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
  always: string[];
}

// SSE Event types
export type GlobalEvent = {
  directory: string;
  payload: ServerEvent;
};

export type ServerEvent =
  | {
      type: "session.created";
      properties: { sessionID: string; info: Session };
    }
  | {
      type: "session.updated";
      properties: { sessionID: string; info: Session };
    }
  | {
      type: "session.deleted";
      properties: { sessionID: string; info: Session };
    }
  | {
      type: "session.status";
      properties: { sessionID: string; status: SessionStatus };
    }
  | {
      type: "session.error";
      properties: { sessionID?: string; error?: SessionError };
    }
  | {
      type: "message.updated";
      properties: { sessionID: string; info: Message };
    }
  | {
      type: "message.removed";
      properties: { sessionID: string; messageID: string };
    }
  | {
      type: "message.part.updated";
      properties: { sessionID: string; part: Part; time: number };
    }
  | {
      type: "message.part.removed";
      properties: { sessionID: string; messageID: string; partID: string };
    }
  | {
      type: "message.part.delta";
      properties: {
        sessionID: string;
        messageID: string;
        partID: string;
        field: string;
        delta: string;
      };
    }
  | { type: "permission.asked"; properties: PermissionRequest }
  | {
      type: "permission.replied";
      properties: { sessionID: string; requestID: string; reply: string };
    }
  | { type: "todo.updated"; properties: { sessionID: string; todos: Todo[] } }
  | { type: "question.asked"; properties: QuestionRequest }
  | {
      type: "question.replied";
      properties: {
        sessionID: string;
        requestID: string;
        answers: string[][];
      };
    }
  | {
      type: "question.rejected";
      properties: { sessionID: string; requestID: string };
    }
  | { type: string; properties: Record<string, unknown> };

export interface Todo {
  content: string;
  status: string;
  priority: string;
}

export interface FileDiff {
  file: string;
  before: string;
  after: string;
  additions: number;
  deletions: number;
  status?: "added" | "deleted" | "modified";
}

export interface QuestionOption {
  label: string;
  description: string;
}

export interface QuestionInfo {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
}

export interface QuestionRequest {
  id: string;
  sessionID: string;
  questions: QuestionInfo[];
  tool?: { messageID: string; callID: string };
}

import { useEffect, useRef } from "react";
import { useSessionStore } from "../stores/session-store";
import { useArtifactStore } from "../stores/artifact-store";
import {
  extractPartialArtifacts,
  extractCodeBlocks,
  isArtifactLanguage,
  isReactLanguage,
  choosePreviewUrl,
  detectNotebookPaths,
} from "../utils/artifact-detection";
import { getBaseUrl } from "../api/client";

/**
 * Watches streaming message parts for artifact-eligible content
 * and auto-opens the artifact panel when detected.
 *
 * Detection priority:
 * 1. Structured <artifact> tags — detected immediately on opening tag
 *    (creates a loading artifact, updates as content streams)
 * 2. Code blocks with html/jsx/tsx/svg language (fallback)
 * 3. Localhost URLs in tool output → browser preview
 * 4. .ipynb file paths in tool output → notebook preview
 */
export function useArtifactDetector(sessionId: string) {
  const seenRef = useRef(new Set<string>());
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  /** Maps artifact identifier → store artifact ID for streaming updates */
  const artifactIdMap = useRef(new Map<string, string>());

  useEffect(() => {
    seenRef.current.clear();
    artifactIdMap.current.clear();
  }, [sessionId]);

  useEffect(() => {
    const unsubscribe = useSessionStore.subscribe((state) => {
      const messages = state.messages[sessionId] ?? [];
      const assistantMsgs = messages.filter((m) => m.role === "assistant");

      for (const msg of assistantMsgs) {
        const parts = state.parts[msg.id] ?? [];

        for (const part of parts) {
          const key = part.id;

          // --- Text parts: detect artifact tags and code blocks ---
          if (part.type === "text" && part.text) {
            // 1. Structured <artifact> tags — detect opening tag immediately
            const partials = extractPartialArtifacts(part.text);

            for (const partial of partials) {
              const tagKey = `tag-${key}-${partial.identifier}`;
              const existingStoreId = artifactIdMap.current.get(
                partial.identifier,
              );

              if (!seenRef.current.has(tagKey)) {
                // First time seeing this artifact — create it immediately
                seenRef.current.add(tagKey);

                const store = useArtifactStore.getState();
                // Check if we already have it from a previous render
                const existing = Object.values(store.artifacts).find(
                  (a) =>
                    a.sessionId === sessionId &&
                    a.title === partial.title &&
                    a.type === partial.type,
                );

                if (existing) {
                  artifactIdMap.current.set(partial.identifier, existing.id);
                  store.updateArtifactContent(existing.id, partial.content);
                  if (partial.complete && existing.loading) {
                    // Loading → done transition: reveal it. After this, never
                    // auto-reopen — the user may have closed the panel.
                    store.setArtifactLoading(existing.id, false);
                  }
                } else {
                  const id = store.addArtifact({
                    type: partial.type,
                    title: partial.title,
                    content: partial.content,
                    language: partial.type === "react" ? "tsx" : "html",
                    sessionId,
                    loading: !partial.complete,
                    createdByMessageId: msg.id,
                  });
                  artifactIdMap.current.set(partial.identifier, id);
                }
              } else if (existingStoreId) {
                // Already tracking — update content as it streams
                const store = useArtifactStore.getState();
                store.updateArtifactContent(existingStoreId, partial.content);
                if (partial.complete) {
                  store.setArtifactLoading(existingStoreId, false);
                }
              }
            }

            // Skip code block fallback if we found structured tags
            if (partials.length > 0) continue;

            // 2. Fallback: code blocks with artifact-eligible languages
            const blocks = extractCodeBlocks(part.text);
            for (const block of blocks) {
              if (!isArtifactLanguage(block.language)) continue;

              const blockKey = `block-${key}-${block.language}-${block.content.slice(0, 50)}`;
              if (seenRef.current.has(blockKey)) continue;
              seenRef.current.add(blockKey);

              clearTimeout(timerRef.current);
              timerRef.current = setTimeout(() => {
                const latestParts =
                  useSessionStore.getState().parts[msg.id] ?? [];
                const latestPart = latestParts.find((p) => p.id === part.id);
                if (!latestPart || latestPart.type !== "text") return;

                const latestBlocks = extractCodeBlocks(latestPart.text);
                const latestBlock = latestBlocks.find(
                  (b) => b.language === block.language,
                );
                if (!latestBlock) return;

                const type = isReactLanguage(latestBlock.language)
                  ? "react"
                  : "html";

                useArtifactStore.getState().addArtifact({
                  type,
                  title: type === "react" ? "React Component" : "HTML Preview",
                  content: latestBlock.content,
                  language: latestBlock.language,
                  sessionId,
                  createdByMessageId: msg.id,
                });
              }, 500);
            }
          }

          // --- Tool parts: detect artifacts in input, localhost URLs, notebook files ---
          if (part.type === "tool") {
            const toolKey = `tool-${key}`;

            // Scan tool input for <artifact> tags (model wrote artifact to file)
            if (part.state.input && !seenRef.current.has(`toolinput-${key}`)) {
              const inputStr = JSON.stringify(part.state.input);
              const inputPartials = extractPartialArtifacts(inputStr);
              const completeTags = inputPartials.filter((p) => p.complete);
              if (completeTags.length > 0) {
                seenRef.current.add(`toolinput-${key}`);
                for (const tag of completeTags) {
                  const store = useArtifactStore.getState();
                  store.addArtifact({
                    type: tag.type,
                    title: tag.title,
                    content: tag.content,
                    language: tag.type === "react" ? "tsx" : "html",
                    sessionId,
                    createdByMessageId: msg.id,
                  });
                }
              }
            }

            // Completed tool outputs: localhost URLs and notebook paths
            if (
              part.state.status === "completed" &&
              !seenRef.current.has(toolKey)
            ) {
              seenRef.current.add(toolKey);
              const output = part.state.output;

              const url = choosePreviewUrl(output, getBaseUrl());
              if (url) {
                const urlKey = `browser-${url}`;
                if (!seenRef.current.has(urlKey)) {
                  seenRef.current.add(urlKey);

                  useArtifactStore.getState().addArtifact({
                    type: "browser",
                    title: url,
                    url,
                    sessionId,
                    createdByMessageId: msg.id,
                  });
                }
              }

              const inputStr = JSON.stringify(part.state.input);
              const nbPaths = detectNotebookPaths(inputStr + " " + output);
              for (const filePath of nbPaths) {
                const nbKey = `notebook-${filePath}`;
                if (seenRef.current.has(nbKey)) continue;
                seenRef.current.add(nbKey);

                useArtifactStore.getState().addArtifact({
                  type: "notebook",
                  title: filePath.split("/").pop() ?? "notebook.ipynb",
                  filePath,
                  sessionId,
                  createdByMessageId: msg.id,
                });
              }
            }
          }
        }
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(timerRef.current);
    };
  }, [sessionId]);
}

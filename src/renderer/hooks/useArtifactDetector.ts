import { useEffect, useRef } from "react";
import { useSessionStore } from "../stores/session-store";
import { useArtifactStore } from "../stores/artifact-store";
import {
  extractArtifactTags,
  extractCodeBlocks,
  isArtifactLanguage,
  isReactLanguage,
  detectLocalhostUrls,
  detectNotebookPaths,
} from "../utils/artifact-detection";

/**
 * Watches streaming message parts for artifact-eligible content
 * and auto-opens the artifact panel when detected.
 *
 * Detection priority:
 * 1. Structured <artifact> tags (from models with artifact system prompt)
 * 2. Code blocks with html/jsx/tsx/svg language (fallback)
 * 3. Localhost URLs in tool output → browser preview
 * 4. .ipynb file paths in tool output → notebook preview
 */
export function useArtifactDetector(sessionId: string) {
  const seenRef = useRef(new Set<string>());
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    seenRef.current.clear();
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
            // 1. Structured <artifact> tags (highest priority)
            const artifactTags = extractArtifactTags(part.text);
            for (const tag of artifactTags) {
              const tagKey = `tag-${key}-${tag.identifier}`;
              if (seenRef.current.has(tagKey)) continue;
              seenRef.current.add(tagKey);

              clearTimeout(timerRef.current);
              timerRef.current = setTimeout(() => {
                // Re-read latest content for streaming
                const latestParts =
                  useSessionStore.getState().parts[msg.id] ?? [];
                const latestPart = latestParts.find((p) => p.id === part.id);
                if (!latestPart || latestPart.type !== "text") return;

                const latestTags = extractArtifactTags(latestPart.text);
                const latestTag = latestTags.find(
                  (t) => t.identifier === tag.identifier,
                );
                if (!latestTag) return;

                // Check if we already have an artifact with this identifier
                const store = useArtifactStore.getState();
                const existing = Object.values(store.artifacts).find(
                  (a) =>
                    a.sessionId === sessionId &&
                    a.title === latestTag.title &&
                    a.type === latestTag.type,
                );

                if (existing) {
                  // Update existing artifact content
                  store.updateArtifactContent(existing.id, latestTag.content);
                  store.setActiveArtifact(existing.id);
                } else {
                  store.addArtifact({
                    type: latestTag.type,
                    title: latestTag.title,
                    content: latestTag.content,
                    language: latestTag.type === "react" ? "tsx" : "html",
                    sessionId,
                  });
                }
              }, 500);
            }

            // Skip code block fallback if we found structured tags
            if (artifactTags.length > 0) continue;

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
              const inputTags = extractArtifactTags(inputStr);
              if (inputTags.length > 0) {
                seenRef.current.add(`toolinput-${key}`);
                for (const tag of inputTags) {
                  const store = useArtifactStore.getState();
                  store.addArtifact({
                    type: tag.type,
                    title: tag.title,
                    content: tag.content,
                    language: tag.type === "react" ? "tsx" : "html",
                    sessionId,
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

              const urls = detectLocalhostUrls(output);
              for (const url of urls) {
                const urlKey = `browser-${url}`;
                if (seenRef.current.has(urlKey)) continue;
                seenRef.current.add(urlKey);

                useArtifactStore.getState().addArtifact({
                  type: "browser",
                  title: url,
                  url,
                  sessionId,
                });
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

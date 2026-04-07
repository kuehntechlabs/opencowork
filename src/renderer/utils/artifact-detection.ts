import type { ArtifactType } from "../stores/artifact-store";

const LOCALHOST_RE = /https?:\/\/localhost:\d+/g;
const NOTEBOOK_PATH_RE = /[^\s"']+\.ipynb/g;

const ARTIFACT_LANGUAGES = new Set(["html", "jsx", "tsx", "svg"]);
const REACT_LANGUAGES = new Set(["jsx", "tsx"]);

export function isArtifactLanguage(lang: string): boolean {
  return ARTIFACT_LANGUAGES.has(lang.toLowerCase());
}

export function isReactLanguage(lang: string): boolean {
  return REACT_LANGUAGES.has(lang.toLowerCase());
}

export function detectLocalhostUrls(text: string): string[] {
  return [...text.matchAll(LOCALHOST_RE)].map((m) => m[0]);
}

export function detectNotebookPaths(text: string): string[] {
  return [...text.matchAll(NOTEBOOK_PATH_RE)].map((m) => m[0]);
}

/** Extract fenced code blocks from markdown text with their language */
export function extractCodeBlocks(
  text: string,
): { language: string; content: string }[] {
  const blocks: { language: string; content: string }[] = [];
  const re = /```(\w+)\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    blocks.push({ language: match[1], content: match[2].trim() });
  }
  return blocks;
}

/** Structured artifact from <artifact> tags */
export interface ParsedArtifact {
  identifier: string;
  type: ArtifactType;
  title: string;
  content: string;
}

const TYPE_MAP: Record<string, ArtifactType> = {
  "text/html": "html",
  "application/vnd.react": "react",
  "image/svg+xml": "html", // SVG rendered as HTML artifact
};

/**
 * Extract structured <artifact> tags from AI output text.
 * These are intentionally created by models that have artifact instructions.
 */
export function extractArtifactTags(text: string): ParsedArtifact[] {
  const results: ParsedArtifact[] = [];
  const re = /<artifact\s+([^>]*?)>([\s\S]*?)<\/artifact>/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const attrs = match[1];
    const content = match[2].trim();

    const id = getAttr(attrs, "identifier") ?? `artifact-${results.length}`;
    const rawType = getAttr(attrs, "type") ?? "";
    const title = getAttr(attrs, "title") ?? "Artifact";
    const type = TYPE_MAP[rawType] ?? inferType(rawType, content);

    results.push({ identifier: id, type, title, content });
  }

  return results;
}

function getAttr(attrs: string, name: string): string | null {
  const re = new RegExp(`${name}=["']([^"']*)["']`);
  const m = re.exec(attrs);
  return m ? m[1] : null;
}

function inferType(rawType: string, content: string): ArtifactType {
  if (rawType.includes("react")) return "react";
  if (rawType.includes("svg")) return "html";
  if (rawType.includes("html")) return "html";
  // Guess from content
  if (
    content.includes("export default") ||
    content.includes("useState") ||
    content.includes("React")
  ) {
    return "react";
  }
  return "html";
}

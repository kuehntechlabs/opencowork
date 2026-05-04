import type { ArtifactType } from "../stores/artifact-store";

const LOCALHOST_RE =
  /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+(?:\/[^\s"'`<>)\]}]*)?/g;
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
  return [...new Set([...text.matchAll(LOCALHOST_RE)].map((m) => m[0]))];
}

export function choosePreviewUrl(
  text: string,
  excludedBaseUrl?: string | null,
): string | null {
  const urls = [...text.matchAll(LOCALHOST_RE)].map((m) => ({
    url: m[0],
    index: m.index ?? 0,
  }));
  const excludedOrigin = getOrigin(excludedBaseUrl);

  const candidates = urls
    .filter(({ url }) => !excludedOrigin || getOrigin(url) !== excludedOrigin)
    .map(({ url, index }) => ({
      url,
      score: scorePreviewUrl(url, text, index),
    }));

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return best && best.score >= 3 ? best.url : null;
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

/**
 * Detect an opening <artifact ...> tag even before the closing tag arrives.
 * Returns the attributes and any partial content streamed so far.
 * Returns null if no opening tag is found.
 */
export interface PartialArtifact {
  identifier: string;
  type: ArtifactType;
  title: string;
  content: string;
  complete: boolean;
}

export function extractPartialArtifacts(text: string): PartialArtifact[] {
  const results: PartialArtifact[] = [];

  // First, find all complete artifacts
  const completeRe = /<artifact\s+([^>]*?)>([\s\S]*?)<\/artifact>/g;
  const completeRanges: [number, number][] = [];
  let m: RegExpExecArray | null;
  while ((m = completeRe.exec(text)) !== null) {
    const attrs = m[1];
    const content = m[2].trim();
    const id = getAttr(attrs, "identifier") ?? `artifact-${results.length}`;
    const rawType = getAttr(attrs, "type") ?? "";
    const title = getAttr(attrs, "title") ?? "Artifact";
    const type = TYPE_MAP[rawType] ?? inferType(rawType, content);
    results.push({ identifier: id, type, title, content, complete: true });
    completeRanges.push([m.index, m.index + m[0].length]);
  }

  // Then, find opening tags that don't have a closing tag yet
  const openRe = /<artifact\s+([^>]*?)>/g;
  while ((m = openRe.exec(text)) !== null) {
    const start = m.index;
    // Skip if this is part of a complete artifact
    if (completeRanges.some(([s, e]) => start >= s && start < e)) continue;

    const attrs = m[1];
    const id = getAttr(attrs, "identifier") ?? `artifact-${results.length}`;
    const rawType = getAttr(attrs, "type") ?? "";
    const title = getAttr(attrs, "title") ?? "Artifact";
    const type = TYPE_MAP[rawType] ?? inferType(rawType, "");

    // Grab whatever content has streamed after the opening tag
    const contentStart = start + m[0].length;
    const content = text.slice(contentStart).trim();

    results.push({ identifier: id, type, title, content, complete: false });
  }

  return results;
}

function getAttr(attrs: string, name: string): string | null {
  const re = new RegExp(`${name}=["']([^"']*)["']`);
  const m = re.exec(attrs);
  return m ? m[1] : null;
}

function getOrigin(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function scorePreviewUrl(url: string, text: string, index: number): number {
  let score = 0;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return -100;
  }

  const pathname = parsed.pathname.toLowerCase();
  const href = parsed.href.toLowerCase();
  const context = text.slice(
    Math.max(0, index - 120),
    index + url.length + 120,
  );
  const lowerContext = context.toLowerCase();

  if (pathname === "/" || pathname === "") score += 8;
  if (/\.(html?|xhtml)$/.test(pathname)) score += 6;
  const frontendContext =
    /(frontend|vite|next|webpack|parcel|preview|browser|html|ui|app)/.test(
      lowerContext,
    );
  const backendContext = /(api|backend|server|health|json|endpoint|log)/.test(
    lowerContext,
  );

  if (
    /(frontend|vite|next|webpack|parcel|preview|browser|html|ui|app)/.test(
      href,
    )
  ) {
    score += 5;
  }
  if (frontendContext) score += 5;
  if (
    /(local|ready|available|open|view|running at|served at)/.test(
      lowerContext,
    )
  ) {
    score += 3;
  }

  if (pathname.startsWith("/api") || pathname.includes("/api/")) score -= 12;
  if (pathname === "/health" || pathname.includes("/health")) score -= 12;
  if (/\.(json|xml|txt|log)$/.test(pathname)) score -= 10;
  if (backendContext) {
    score -= 6;
  }
  if (backendContext && !frontendContext) score -= 6;

  return score;
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

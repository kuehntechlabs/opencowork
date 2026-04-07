# OpenCowork

Desktop UI for OpenCode — AI Coding Agent. Built with Electron, React 19, and Tailwind CSS 4.

## Features

- **Chat Interface** — Conversational UI for interacting with AI coding agents via OpenCode
- **Artifacts Panel** — Live preview panel for AI-generated content:
  - **HTML** — Rendered in sandboxed iframe with Tailwind CSS
  - **React** — JSX/TSX transpiled via Sucrase with React 19 runtime
  - **Browser Preview** — Embedded webview for localhost dev servers
  - **Jupyter Notebooks** — Parsed and rendered `.ipynb` files
- **MCP Marketplace** — Browse and install MCP servers from the official registry (registry.modelcontextprotocol.io), with support for both local (stdio/npm) and remote (streamable-http/sse) transports, introspection, and one-click removal
- **Skills Browser** — Discover and customize AI skills
- **Projects** — Project management with custom agent instructions

## Artifacts

The AI model is taught to create artifacts using `<artifact>` tags injected via a system prompt on the first message of each session. Supported types:

| Type | Tag | Description |
|------|-----|-------------|
| HTML | `type="text/html"` | Full HTML pages with inline CSS/JS |
| React | `type="application/vnd.react"` | React components with hooks + Tailwind |
| SVG | `type="image/svg+xml"` | Scalable vector graphics |

Artifacts are auto-detected from streaming responses and rendered in a resizable panel alongside the chat. A fallback detector also catches code blocks (`html`, `jsx`, `tsx`) and localhost URLs from tool output.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run package:mac   # macOS
npm run package:win   # Windows
```

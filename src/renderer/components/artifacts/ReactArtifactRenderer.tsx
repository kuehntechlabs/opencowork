import { useMemo, useRef, useEffect, useState } from "react";

interface Props {
  content: string;
}

export function ReactArtifactRenderer({ content }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce content updates during streaming
  const [debouncedContent, setDebouncedContent] = useState(content);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedContent(content);
      setError(null);
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [content]);

  const srcdoc = useMemo(() => {
    // Escape the source for embedding in a template literal inside a module script
    const escapedSource = debouncedContent
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`")
      .replace(/\$\{/g, "\\${")
      .replace(/<\/script>/gi, "<\\/script>");

    // Use a module script to import React 19 ESM + Sucrase, then transpile & render
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
    #root { min-height: 100vh; }
    .error-display {
      padding: 16px;
      background: #fef2f2;
      border: 1px solid #fca5a5;
      border-radius: 8px;
      margin: 16px;
      font-family: monospace;
      font-size: 13px;
      color: #991b1b;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .loading-display {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      color: #6b7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div id="root"><div class="loading-display">Loading...</div></div>
  <script type="module">
    const source = \`${escapedSource}\`;

    function showError(msg) {
      document.getElementById('root').innerHTML =
        '<div class="error-display">' + msg.replace(/</g, '&lt;') + '<\\/div>';
      window.parent.postMessage({ type: 'artifact-error', error: msg }, '*');
    }

    try {
      // Import React 19 and Sucrase as ESM modules
      const [ReactMod, ReactDOMMod, SucraseMod] = await Promise.all([
        import('https://esm.sh/react@19'),
        import('https://esm.sh/react-dom@19/client'),
        import('https://esm.sh/sucrase@3'),
      ]);

      const React = ReactMod.default || ReactMod;
      const { createRoot } = ReactDOMMod;

      // Expose React globally so user code can use React.createElement, hooks, etc.
      window.React = React;

      // Transpile JSX/TSX with Sucrase
      const transformed = SucraseMod.transform(source, {
        transforms: ['jsx', 'typescript', 'imports'],
        jsxRuntime: 'classic',
        jsxPragma: 'React.createElement',
        jsxFragmentPragma: 'React.Fragment',
        production: false,
      });

      const moduleCode = transformed.code;

      // Provide a require shim that resolves 'react'
      function require(mod) {
        if (mod === 'react') return React;
        if (mod === 'react-dom' || mod === 'react-dom/client') return { createRoot };
        throw new Error('Module not found: ' + mod);
      }

      // Execute transpiled code in a function scope
      const exports = {};
      const module = { exports };
      const fn = new Function('React', 'require', 'exports', 'module', moduleCode);
      fn(React, require, exports, module);

      // Find the component
      let Component = module.exports.default || module.exports;
      if (typeof Component === 'object' && Component !== null) {
        Component = Component.default || Component;
      }

      // Check named exports
      if (!Component || typeof Component !== 'function') {
        for (const key of Object.keys(module.exports)) {
          if (typeof module.exports[key] === 'function') {
            Component = module.exports[key];
            break;
          }
        }
      }
      if (!Component || typeof Component !== 'function') {
        for (const key of Object.keys(exports)) {
          if (typeof exports[key] === 'function') {
            Component = exports[key];
            break;
          }
        }
      }

      if (!Component) {
        showError('No React component found. Export a component as default or named export.');
      } else {
        const root = createRoot(document.getElementById('root'));
        root.render(React.createElement(Component));
      }
    } catch (err) {
      showError(err.message || String(err));
    }
  <\/script>
</body>
</html>`;
  }, [debouncedContent]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "artifact-error") {
        setError(e.data.error);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return (
    <div className="relative h-full w-full">
      <iframe
        ref={iframeRef}
        srcDoc={srcdoc}
        sandbox="allow-scripts allow-same-origin"
        className="h-full w-full border-0 bg-white"
        title="React Preview"
      />
      {error && (
        <div className="absolute bottom-2 left-2 right-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}

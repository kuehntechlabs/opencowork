import { useMemo } from "react";

interface Props {
  content: string;
}

export function HtmlArtifactRenderer({ content }: Props) {
  const srcdoc = useMemo(() => {
    // If content looks like a full HTML document, use it directly
    const isFullDoc =
      content.trimStart().startsWith("<!") ||
      content.trimStart().startsWith("<html");

    if (isFullDoc) {
      return content;
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body>${content}</body>
</html>`;
  }, [content]);

  return (
    <iframe
      srcDoc={srcdoc}
      sandbox="allow-scripts allow-same-origin"
      className="h-full w-full border-0 bg-white"
      title="HTML Preview"
    />
  );
}

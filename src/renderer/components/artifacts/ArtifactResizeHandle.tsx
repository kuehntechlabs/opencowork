export function ArtifactResizeHandle() {
  // Left-edge visual divider — draggable resize can be added later
  return (
    <div className="absolute left-0 top-0 z-10 h-full w-0.5 bg-border hover:w-1 hover:bg-accent/40 transition-all cursor-col-resize" />
  );
}

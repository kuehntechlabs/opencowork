import { useCallback, useRef } from "react";
import { useArtifactStore } from "../../stores/artifact-store";

const MIN_WIDTH = 300;
const MAX_RATIO = 0.6;

export function ArtifactResizeHandle() {
  const setPanelWidth = useArtifactStore((s) => s.setPanelWidth);
  const dragging = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;

      const startX = e.clientX;
      const startWidth = useArtifactStore.getState().panelWidth;

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const delta = ev.clientX - startX;
        const maxWidth = window.innerWidth * MAX_RATIO;
        const newWidth = Math.max(
          MIN_WIDTH,
          Math.min(maxWidth, startWidth + delta),
        );
        setPanelWidth(newWidth);
      };

      const onMouseUp = () => {
        dragging.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [setPanelWidth],
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className="absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize transition-colors hover:bg-accent/40"
    />
  );
}

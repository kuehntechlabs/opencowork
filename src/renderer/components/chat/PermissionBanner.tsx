import { useEffect } from "react";
import { useSessionStore } from "../../stores/session-store";
import { useSettingsStore } from "../../stores/settings-store";
import { replyPermission } from "../../api/client";
import type { PermissionRequest } from "../../api/types";

interface Props {
  sessionId: string;
}

export function PermissionBanner({ sessionId }: Props) {
  const requests = useSessionStore((s) => s.permissionRequests);
  const removeRequest = useSessionStore((s) => s.removePermissionRequest);
  const permissionMode = useSettingsStore((s) => s.permissionMode);

  const pending = Object.values(requests).filter(
    (r) => r.sessionID === sessionId,
  );

  // Auto-handle permissions based on mode
  useEffect(() => {
    if (pending.length === 0) return;
    if (permissionMode === "allow") {
      // Auto-approve all
      for (const req of pending) {
        replyPermission(req.id, "always")
          .then(() => removeRequest(req.id))
          .catch(() => {});
      }
    } else if (permissionMode === "plan") {
      // Auto-reject all (plan only)
      for (const req of pending) {
        replyPermission(req.id, "reject")
          .then(() => removeRequest(req.id))
          .catch(() => {});
      }
    }
  }, [pending.length, permissionMode]);

  // In allow/plan mode, don't show the banner
  if (permissionMode !== "ask" || pending.length === 0) return null;

  const handleReply = async (
    req: PermissionRequest,
    reply: "once" | "always" | "reject",
  ) => {
    try {
      await replyPermission(req.id, reply);
      removeRequest(req.id);
    } catch (err) {
      console.error("Failed to reply permission:", err);
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-yellow-500/30 bg-yellow-500/5 px-4 py-3">
      {pending.map((req) => (
        <div key={req.id} className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              className="mt-0.5 shrink-0 text-yellow-400"
            >
              <path
                d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-200">
                Permission requested
              </p>
              <p className="mt-0.5 font-mono text-xs text-text-secondary">
                {req.permission}
              </p>
              {req.patterns.length > 0 && (
                <p className="mt-0.5 font-mono text-[11px] text-text-tertiary">
                  {req.patterns.join(", ")}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleReply(req, "once")}
              className="rounded-md bg-yellow-500/20 px-3 py-1.5 text-xs font-medium text-yellow-200 transition-colors hover:bg-yellow-500/30"
            >
              Allow once
            </button>
            <button
              onClick={() => handleReply(req, "always")}
              className="rounded-md bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-200 transition-colors hover:bg-green-500/30"
            >
              Always allow
            </button>
            <button
              onClick={() => handleReply(req, "reject")}
              className="rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/30"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

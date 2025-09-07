import React from "react";
import { useHoverPanel } from "../hooks/useHoverPanel";

export function AppShell({ children }: { children: React.ReactNode }) {
  const hp = useHoverPanel({ openDelay: 140, closeDelay: 420, minOpenMs: 260 });
  const PANEL_W = 280;
  const EDGE_W = 18;
  const isPanelActive = hp.open || hp.pinned;

  return (
    <div className="min-h-screen w-full bg-base-900 text-base-100">
      {/* hover edge */}
      <div
        className="fixed inset-y-0 left-0"
        style={{
          width: EDGE_W,
          zIndex: 40,
          cursor: "ew-resize",
          pointerEvents: isPanelActive ? "none" : "auto",
        }}
        onPointerEnter={hp.scheduleOpen}
        onPointerLeave={hp.cancelOpen}
        aria-hidden
      />

      <div
        className="min-h-screen grid"
        style={{
          gridTemplateColumns: `${isPanelActive ? PANEL_W : 0}px 1fr`,
          transition: "grid-template-columns 180ms ease",
        }}
      >
        {/* sidebar */}
        <aside
          className="relative border-r border-border bg-[color:var(--color-panel)]"
          onPointerEnter={hp.scheduleOpen}
          onPointerLeave={hp.scheduleClose}
          style={{ width: isPanelActive ? PANEL_W : 0, overflow: "hidden", transition: "width 180ms ease" }}
        >
          <div className="flex items-center justify-between gap-3 p-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="i-lucide-settings h-4 w-4" />
              <span className="font-medium">Settings</span>
            </div>
            <button
              onClick={hp.togglePin}
              className="rounded border border-border px-2 py-1 text-xs hover:brightness-110"
              title={hp.pinned ? "Unpin" : "Pin"}
            >
              {hp.pinned ? "Unpin" : "Pin"}
            </button>
          </div>
          <div className="px-3 pb-4 text-xs text-muted/80">
            Hover this panel to reveal it. Click <b>Pin</b> to keep it open.
          </div>
        </aside>

        {/* main */}
        <main className="w-full min-w-0 p-6 md:p-8 space-y-6">{children}</main>
      </div>
    </div>
  );
}

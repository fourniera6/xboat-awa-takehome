import type { ThemeMode } from "../hooks/useTheme";

type Props = {
  mode: ThemeMode;
  setTheme: (m: ThemeMode) => void;

  open: boolean;
  pinned: boolean;

  // hover handlers from controller
  onEnter: () => void;        // cancel close; OK to arm open externally
  onLeave: () => void;        // schedule close
  onOpenNow: () => void;      // instant open (gear click)
  onTogglePin: () => void;    // pin/unpin
  onScheduleOpen: () => void; // arm open (for collapsed hover)
  onCancelOpen: () => void;   // cancel open timer
};

export default function SideSettings({
  mode, setTheme,
  open, pinned,
  onEnter, onLeave, onOpenNow, onTogglePin, onScheduleOpen, onCancelOpen
}: Props) {
  const sectionTitle =
    "text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2";

  return (
    <aside
      // 👇 Now it's a normal block in the left grid column, with sticky positioning.
      className={[
        "h-screen sticky top-0 w-full box-border select-none",
        "border-r bg-white dark:bg-neutral-900",
        "border-gray-200 dark:border-neutral-800 shadow-sm",
        // width is controlled by the grid column, we only animate inner opacity for smoothness
      ].join(" ")}
      onPointerEnter={() => { onEnter(); if (!open && !pinned) onScheduleOpen(); }}
      onPointerLeave={() => { onCancelOpen(); onLeave(); }}
    >
      {/* Header */}
      <div className="h-14 flex items-center gap-3 px-3">
        <button
          title="Open settings"
          onClick={onOpenNow}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg
                     bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.125c1.543-.89 3.31.877 2.42 2.42a1.724 1.724 0 0 0 1.125 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.125 2.573c.89 1.543-.877 3.31-2.42 2.42a1.724 1.724 0 0 0-2.573 1.125c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.125c-1.543.89-3.31-.877-2.42-2.42a1.724 1.724 0 0 0-1.125-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.125-2.573c-.89-1.543.877-3.31 2.42-2.42Z" />
            <circle cx="12" cy="12" r="3.25" />
          </svg>
        </button>

        <div className={[
          "text-sm font-medium transition-opacity whitespace-nowrap",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        ].join(" ")}>Settings</div>

        <div className="flex-1" />

        <button
          title={pinned ? "Unpin" : "Pin panel"}
          onClick={onTogglePin}
          className={[
            "transition-opacity text-xs px-2 py-1 rounded-md border",
            open ? "opacity-100" : "opacity-0 pointer-events-none",
            "border-gray-300 dark:border-neutral-700",
            "hover:bg-gray-100 dark:hover:bg-neutral-800"
          ].join(" ")}
        >
          {pinned ? "Unpin" : "Pin"}
        </button>
      </div>

      {/* Content */}
      <div className={[
        "px-3 pb-4 overflow-y-auto transition-opacity",
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      ].join(" ")} style={{ height: "calc(100% - 56px)" }}>
        <div className={sectionTitle}>Appearance</div>
        <fieldset className="space-y-2">
          {(["light","dark","system"] as ThemeMode[]).map(opt => {
            const active = mode === opt;
            return (
              <label
                key={opt}
                className={[
                  "flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer",
                  "bg-white dark:bg-neutral-900",
                  active
                    ? "border-yellow-400/70 ring-1 ring-yellow-400/70"
                    : "border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800",
                ].join(" ")}
                onClick={() => setTheme(opt)}
              >
                <span className="capitalize text-sm">{opt}</span>
                <span className={[
                  "inline-flex h-5 w-5 items-center justify-center rounded-full border",
                  active ? "border-yellow-400" : "border-gray-300 dark:border-neutral-600"
                ].join(" ")}>
                  <span className={["h-2.5 w-2.5 rounded-full", active ? "bg-yellow-400" : "bg-transparent"].join(" ")} />
                </span>
                <input type="radio" className="hidden" readOnly checked={active} />
              </label>
            );
          })}
        </fieldset>
      </div>
    </aside>
  );
}

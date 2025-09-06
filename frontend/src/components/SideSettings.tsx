import { useState } from "react";
import type { ThemeMode } from "../hooks/useTheme";

type Props = {
  mode: ThemeMode;
  isDark: boolean;
  setTheme: (m: ThemeMode) => void;
};

export default function SideSettings({ mode, isDark, setTheme }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={[
        "fixed left-0 top-0 bottom-0 z-50",
        "transition-all duration-200 ease-out",
        open ? "w-72" : "w-14",                 // collapsed vs expanded width
      ].join(" ")}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* panel body */}
      <div className="h-full border-r bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col">
        {/* header / gear */}
        <div className="flex items-center gap-3 px-3 py-3">
          {/* gear button (also toggles on click, handy on touch) */}
          <button
            title="Settings"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full
                       bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
          >
            {/* inline SVG gear (no dependency) */}
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.125c1.543-.89 3.31.877 2.42 2.42a1.724 1.724 0 0 0 1.125 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.125 2.573c.89 1.543- .877 3.31-2.42 2.42a1.724 1.724 0 0 0-2.573 1.125c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.125c-1.543.89-3.31-.877-2.42-2.42a1.724 1.724 0 0 0-1.125-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.125-2.573c-.89-1.543.877-3.31 2.42-2.42.97.56 2.187.074 2.573-1.125Z" />
              <circle cx="12" cy="12" r="3.25" />
            </svg>
          </button>
          {/* title when expanded */}
          <div className={["text-sm font-medium select-none transition-opacity", open ? "opacity-100" : "opacity-0 pointer-events-none"].join(" ")}>
            Settings
          </div>
        </div>

        {/* content */}
        <div className="px-3 pb-4 overflow-y-auto">
          {/* Appearance section */}
          <div className={["mt-2 transition-opacity", open ? "opacity-100" : "opacity-0 pointer-events-none"].join(" ")}>
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Appearance</div>
            <fieldset className="space-y-2">
              {(["light","dark","system"] as ThemeMode[]).map((opt) => {
                const active = mode === opt;
                return (
                  <label
                    key={opt}
                    className={[
                      "flex items-center justify-between rounded-md border px-3 py-2 cursor-pointer",
                      active
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                        : "border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm capitalize">{opt}</span>
                    </div>
                    {/* custom radio */}
                    <span className={[
                      "inline-flex h-4 w-4 items-center justify-center rounded-full border",
                      active
                        ? "border-blue-600"
                        : "border-gray-300 dark:border-neutral-600"
                    ].join(" ")}>
                      <span className={[
                        "h-2.5 w-2.5 rounded-full",
                        active ? "bg-blue-600" : "bg-transparent"
                      ].join(" ")} />
                    </span>
                    <input
                      type="radio"
                      name="theme"
                      className="hidden"
                      checked={active}
                      onChange={() => setTheme(opt)}
                    />
                  </label>
                );
              })}
            </fieldset>
          </div>
        </div>

        {/* spacer to push content */}
        <div className="flex-1" />
      </div>
    </div>
  );
}

import React from "react";

export function Card({
  title,
  actions,
  className = "",
  children,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={[
        "w-full overflow-hidden rounded-2xl",
        "border border-border bg-[color:var(--color-panel)] shadow-soft",
        "p-4 md:p-5",
        className,
      ].join(" ")}
    >
      {(title || actions) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title && <h3 className="text-base font-semibold leading-none">{title}</h3>}
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

import { ReactNode } from "react";

interface PanelLayoutProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function PanelLayout({ title, description, actions, children }: PanelLayoutProps) {
  return (
    <div className="flex h-full flex-col">
      {/* The header stays put while the page scrolls, so the run and export
          buttons are always reachable on long results pages. */}
      <div className="sticky top-0 z-10 flex h-[var(--topbar-h)] shrink-0 items-center justify-between gap-4 border-b bg-background px-6">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{title}</h1>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>
        )}
      </div>
      <div className="flex-1 overflow-auto p-6">
        {/* Capped so tables and charts stay readable on very wide displays. */}
        <div className="mx-auto h-full w-full max-w-[1600px]">{children}</div>
      </div>
    </div>
  );
}

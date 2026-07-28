import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

interface CollapsibleCardProps {
  title: ReactNode;
  /** Controls pinned to the right of the title, above the fold. */
  actions?: ReactNode;
  /** Start folded — useful for cards that are reference rather than workflow. */
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

/**
 * A card whose body folds away.
 *
 * Side panels stack a lot of cards, and most of the time only one is being
 * worked on; folding the rest keeps the column short enough to see at once.
 */
export function CollapsibleCard({
  title, actions, defaultOpen = true, className, contentClassName, children,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <button
            onClick={() => setOpen((o) => !o)}
            className="-my-1 -ml-1 flex flex-1 items-center gap-1.5 rounded px-1 py-1 text-left transition-colors hover:bg-muted/60"
            aria-expanded={open}
          >
            <ChevronDown
              size={13}
              className={cn("shrink-0 text-muted-foreground transition-transform duration-150", !open && "-rotate-90")}
            />
            <span className="flex flex-1 items-center gap-1.5">{title}</span>
          </button>
          {actions}
        </CardTitle>
      </CardHeader>
      {open && <CardContent className={contentClassName}>{children}</CardContent>}
    </Card>
  );
}

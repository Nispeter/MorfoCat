import { ReactNode, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { exportChart, type ChartFormat } from "@/lib/chartExport";
import { Download, Loader2 } from "lucide-react";

interface ChartFrameProps {
  title: ReactNode;
  /** Base name for the downloaded file, without extension. */
  filename: string;
  /** Controls rendered between the title and the export buttons. */
  controls?: ReactNode;
  /** How many times the on-screen size the PNG is rendered at. */
  exportScale?: number;
  className?: string;
  children: ReactNode;
}

/**
 * Card wrapper that gives every chart the same header layout and a PNG/SVG
 * export control in the top-right corner.
 */
export function ChartFrame({ title, filename, controls, className, exportScale = 3, children }: ChartFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<ChartFormat | null>(null);

  const save = async (format: ChartFormat) => {
    setBusy(format);
    try {
      await exportChart(ref.current, filename, format, exportScale);
      toast.success(`Chart exported as ${format.toUpperCase()}`);
    } catch (e) {
      toast.error("Export failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-3 text-sm">
          {title}
          <span className="ml-auto flex items-center gap-2">
            {controls}
            <span className="flex items-center overflow-hidden rounded-md border">
              <Button
                variant="ghost" size="sm"
                className="h-7 rounded-none px-2 text-xs font-normal"
                disabled={busy !== null}
                onClick={() => save("png")}
              >
                {busy === "png" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PNG
              </Button>
              <span className="h-4 w-px bg-border" />
              <Button
                variant="ghost" size="sm"
                className="h-7 rounded-none px-2 text-xs font-normal"
                disabled={busy !== null}
                onClick={() => save("svg")}
              >
                SVG
              </Button>
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={ref}>{children}</div>
      </CardContent>
    </Card>
  );
}

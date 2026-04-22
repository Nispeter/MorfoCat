import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

interface LandmarkViewer2DProps {
  landmarks: number[][];
  consensus?: number[][];
  specimenId?: string;
  showLabels?: boolean;
  width?: number;
  height?: number;
}

export function LandmarkViewer2D({
  landmarks, consensus, specimenId, showLabels = true, width = 400, height = 340,
}: LandmarkViewer2DProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState<d3.ZoomTransform>(d3.zoomIdentity);

  useEffect(() => {
    if (!svgRef.current || !landmarks?.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const pad = 30;
    const xs = [...landmarks.map((p) => p[0]), ...(consensus?.map((p) => p[0]) ?? [])];
    const ys = [...landmarks.map((p) => p[1]), ...(consensus?.map((p) => p[1]) ?? [])];
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const rX = maxX - minX || 1;
    const rY = maxY - minY || 1;
    const scale = Math.min((width - pad * 2) / rX, (height - pad * 2) / rY);
    const ox = pad + ((width - pad * 2) - rX * scale) / 2;
    const oy = pad + ((height - pad * 2) - rY * scale) / 2;

    const toSvg = (x: number, y: number) => ({
      cx: ox + (x - minX) * scale,
      cy: height - oy - (y - minY) * scale,
    });

    const g = svg.append("g").attr("class", "zoom-g");

    // Wireframe
    if (landmarks.length > 1) {
      for (let i = 0; i < landmarks.length; i++) {
        const a = toSvg(landmarks[i][0], landmarks[i][1]);
        const b = toSvg(landmarks[(i + 1) % landmarks.length][0], landmarks[(i + 1) % landmarks.length][1]);
        g.append("line").attr("x1", a.cx).attr("y1", a.cy).attr("x2", b.cx).attr("y2", b.cy)
          .attr("stroke", "hsl(var(--muted-foreground))").attr("stroke-width", 0.7).attr("opacity", 0.4);
      }
    }

    // Consensus landmarks (grey)
    consensus?.forEach((p) => {
      const { cx, cy } = toSvg(p[0], p[1]);
      g.append("circle").attr("cx", cx).attr("cy", cy).attr("r", 3)
        .attr("fill", "hsl(var(--muted-foreground))").attr("opacity", 0.4);
    });

    // Specimen landmarks
    landmarks.forEach((p, i) => {
      const { cx, cy } = toSvg(p[0], p[1]);
      const dot = g.append("circle").attr("cx", cx).attr("cy", cy).attr("r", 5)
        .attr("fill", "hsl(var(--primary))").attr("opacity", 0.85).attr("cursor", "pointer");
      dot.append("title").text(`LM ${i + 1}: (${p[0].toFixed(4)}, ${p[1].toFixed(4)})`);
      if (showLabels) {
        g.append("text").attr("x", cx + 7).attr("y", cy + 4).attr("font-size", 9)
          .attr("fill", "hsl(var(--foreground))").text(String(i + 1));
      }
    });

    // Zoom
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 10])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoom(event.transform);
      });
    svg.call(zoomBehavior).call(zoomBehavior.transform, zoom);
  }, [landmarks, consensus, showLabels, width, height]);

  return (
    <div className="relative">
      <svg ref={svgRef} width={width} height={height} className="rounded border bg-card" />
      {specimenId && (
        <span className="absolute bottom-2 left-2 text-[10px] text-muted-foreground">{specimenId}</span>
      )}
      <span className="absolute bottom-2 right-2 text-[10px] text-muted-foreground">
        {zoom.k !== 1 ? `×${zoom.k.toFixed(1)}` : "scroll to zoom"}
      </span>
    </div>
  );
}

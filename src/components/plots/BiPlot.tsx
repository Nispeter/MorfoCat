import { useRef, useEffect } from "react";
import * as d3 from "d3";

interface BiPlotProps {
  scores: number[][];
  loadings: number[][];
  groups?: string[];
  pcX?: number;
  pcY?: number;
  pctVariance?: number[];
  ids?: string[];
  showLoadings?: boolean;
}

const GROUP_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#ec4899", "#84cc16",
];

export function BiPlot({
  scores, loadings, groups, pcX = 0, pcY = 1,
  pctVariance, ids, showLoadings = true,
}: BiPlotProps) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !scores.length) return;

    const W = ref.current.clientWidth || 520;
    const H = 360;
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const w = W - margin.left - margin.right;
    const h = H - margin.top - margin.bottom;

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    svg.attr("height", H);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const xs = scores.map((s) => s[pcX] ?? 0);
    const ys = scores.map((s) => s[pcY] ?? 0);

    const xExt = d3.extent(xs) as [number, number];
    const yExt = d3.extent(ys) as [number, number];
    const pad = 0.15;

    const xScale = d3.scaleLinear().domain([xExt[0] - Math.abs(xExt[0]) * pad, xExt[1] + Math.abs(xExt[1]) * pad]).range([0, w]);
    const yScale = d3.scaleLinear().domain([yExt[0] - Math.abs(yExt[0]) * pad, yExt[1] + Math.abs(yExt[1]) * pad]).range([h, 0]);

    const uniqueGroups = groups ? [...new Set(groups)] : ["all"];

    // Grid
    g.append("g").attr("class", "grid").call(
      d3.axisLeft(yScale).tickSize(-w).tickFormat(() => "")
    ).selectAll("line").attr("stroke", "hsl(var(--border))").attr("stroke-dasharray", "3,3");
    g.append("g").attr("class", "grid").attr("transform", `translate(0,${h})`).call(
      d3.axisBottom(xScale).tickSize(-h).tickFormat(() => "")
    ).selectAll("line").attr("stroke", "hsl(var(--border))").attr("stroke-dasharray", "3,3");

    // Axes
    g.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(xScale).ticks(6)).selectAll("text").attr("font-size", 10);
    g.append("g").call(d3.axisLeft(yScale).ticks(6)).selectAll("text").attr("font-size", 10);

    // Axis labels
    const xLbl = pctVariance ? `PC${pcX + 1} (${pctVariance[pcX].toFixed(1)}%)` : `PC${pcX + 1}`;
    const yLbl = pctVariance ? `PC${pcY + 1} (${pctVariance[pcY].toFixed(1)}%)` : `PC${pcY + 1}`;
    g.append("text").attr("x", w / 2).attr("y", h + 34).attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "hsl(var(--foreground))").text(xLbl);
    g.append("text").attr("transform", "rotate(-90)").attr("x", -h / 2).attr("y", -38).attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "hsl(var(--foreground))").text(yLbl);

    // Zero lines
    g.append("line").attr("x1", xScale(0)).attr("x2", xScale(0)).attr("y1", 0).attr("y2", h).attr("stroke", "hsl(var(--muted-foreground))").attr("stroke-width", 0.5);
    g.append("line").attr("x1", 0).attr("x2", w).attr("y1", yScale(0)).attr("y2", yScale(0)).attr("stroke", "hsl(var(--muted-foreground))").attr("stroke-width", 0.5);

    // Scores
    scores.forEach((s, i) => {
      const gi = groups ? uniqueGroups.indexOf(groups[i]) : 0;
      g.append("circle")
        .attr("cx", xScale(s[pcX] ?? 0))
        .attr("cy", yScale(s[pcY] ?? 0))
        .attr("r", 4)
        .attr("fill", GROUP_COLORS[gi % GROUP_COLORS.length])
        .attr("opacity", 0.75)
        .append("title").text(ids?.[i] ?? `sp_${i}`);
    });

    // Loadings arrows (scaled)
    if (showLoadings && loadings.length) {
      const scaleFactor = 0.3 * Math.min(w, h);
      const lxs = loadings.map((l) => l[pcX] ?? 0);
      const lys = loadings.map((l) => l[pcY] ?? 0);
      const maxL = Math.max(...lxs.map(Math.abs), ...lys.map(Math.abs)) || 1;

      svg.append("defs").append("marker").attr("id", "arrow").attr("viewBox", "0 -5 10 10").attr("refX", 8).attr("refY", 0).attr("markerWidth", 4).attr("markerHeight", 4).attr("orient", "auto").append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "hsl(var(--destructive))");

      loadings.slice(0, 30).forEach((l) => {
        const lx = (l[pcX] ?? 0) / maxL * scaleFactor;
        const ly = (l[pcY] ?? 0) / maxL * scaleFactor;
        g.append("line")
          .attr("x1", xScale(0)).attr("y1", yScale(0))
          .attr("x2", xScale(0) + lx).attr("y2", yScale(0) - ly)
          .attr("stroke", "hsl(var(--destructive))").attr("stroke-width", 0.8).attr("opacity", 0.5)
          .attr("marker-end", "url(#arrow)");
      });
    }
  }, [scores, loadings, groups, pcX, pcY, pctVariance, ids, showLoadings]);

  return <svg ref={ref} width="100%" style={{ display: "block" }} />;
}

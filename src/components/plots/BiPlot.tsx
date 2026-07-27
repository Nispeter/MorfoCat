import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { symbolPath, isStrokeOnly, defaultGroupColor, defaultGroupSymbol } from "@/lib/symbols";
import { usePlotStyleStore } from "@/store/plotStyleStore";

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

export function BiPlot({
  scores, loadings, groups, pcX = 0, pcY = 1,
  pctVariance, ids, showLoadings = true,
}: BiPlotProps) {
  const ref = useRef<SVGSVGElement>(null);
  const styles = usePlotStyleStore((s) => s.styles);

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
    // Share the Figure tab's colours and symbols so both views of the same
    // PCA look like the same analysis.
    const styleFor = (name: string) => {
      const s = styles[name];
      const idx = Math.max(0, uniqueGroups.indexOf(name));
      return s ?? {
        label: name,
        color: defaultGroupColor(idx),
        symbol: defaultGroupSymbol(idx),
        filled: true,
      };
    };

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

    // Hover read-out, drawn last so it sits above the points
    const tip = g.append("g").style("display", "none").style("pointer-events", "none");
    const tipBox = tip.append("rect").attr("rx", 4).attr("height", 32)
      .attr("fill", "hsl(var(--popover))").attr("stroke", "hsl(var(--border))");
    const tipName = tip.append("text").attr("x", 8).attr("y", 14).attr("font-size", 11).attr("font-weight", 600).attr("fill", "hsl(var(--popover-foreground))");
    const tipVals = tip.append("text").attr("x", 8).attr("y", 26).attr("font-size", 10).attr("fill", "hsl(var(--muted-foreground))");

    // Scores
    scores.forEach((s, i) => {
      const st = styleFor(groups ? groups[i] : "all");
      const outline = isStrokeOnly(st.symbol) || !st.filled;
      const cx = xScale(s[pcX] ?? 0);
      const cy = yScale(s[pcY] ?? 0);
      g.append("path")
        .attr("d", symbolPath(st.symbol, 4.5))
        .attr("transform", `translate(${cx},${cy})`)
        .attr("fill", outline ? "none" : st.color)
        .attr("stroke", st.color)
        .attr("stroke-width", outline ? 1.6 : 0.7)
        .attr("opacity", 0.85)
        .style("cursor", "pointer")
        .on("mouseenter", function () {
          d3.select(this).attr("opacity", 1).attr("d", symbolPath(st.symbol, 6.5));
          const name = ids?.[i] ?? `sp_${i + 1}`;
          const vals = `PC${pcX + 1} ${(s[pcX] ?? 0).toFixed(4)} · PC${pcY + 1} ${(s[pcY] ?? 0).toFixed(4)}`;
          tipName.text(name);
          tipVals.text(vals);
          const width = Math.max(name.length * 6.5, vals.length * 5.4) + 16;
          tipBox.attr("width", width);
          tip
            .attr("transform", `translate(${Math.min(cx + 10, w - width)},${Math.max(cy - 38, 0)})`)
            .style("display", null);
        })
        .on("mouseleave", function () {
          d3.select(this).attr("opacity", 0.85).attr("d", symbolPath(st.symbol, 4.5));
          tip.style("display", "none");
        });
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

    // Legend
    if (groups && uniqueGroups.length > 1) {
      const legend = g.append("g").attr("transform", `translate(${w - 8},8)`);
      uniqueGroups.forEach((name, i) => {
        const st = styleFor(name);
        const outline = isStrokeOnly(st.symbol) || !st.filled;
        const row = legend.append("g").attr("transform", `translate(0,${i * 15})`);
        row.append("path").attr("d", symbolPath(st.symbol, 4)).attr("transform", "translate(-6,0)")
          .attr("fill", outline ? "none" : st.color).attr("stroke", st.color).attr("stroke-width", outline ? 1.6 : 0.7);
        row.append("text").attr("x", -14).attr("y", 4).attr("text-anchor", "end")
          .attr("font-size", 10).attr("fill", "hsl(var(--foreground))").text(st.label);
      });
    }
  }, [scores, loadings, groups, pcX, pcY, pctVariance, ids, showLoadings, styles]);

  return <svg ref={ref} width="100%" style={{ display: "block" }} />;
}

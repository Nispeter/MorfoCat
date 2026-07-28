import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Database, GitMerge, ScanSearch, BarChart2, Layers, TrendingUp,
  Activity, GitBranch, Dna, Network, Sigma, ChevronLeft, ChevronRight, ChevronDown,
  Cat, Grid3X3, Images, MousePointerClick, Settings, Spline,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useNavStore } from "@/store/navStore";
import { useDatasetStore } from "@/store/datasetStore";
import { hasGroups } from "@/lib/groups";
import { useT, type TranslationKey } from "@/lib/i18n";

export type PageId =
  | "data" | "image-import" | "digitizer"
  | "procrustes" | "outliers" | "covariance" | "wireframe"
  | "pca" | "matrix-corr" | "pls" | "regression" | "modularity"
  | "cva" | "lda"
  | "phylogenetics" | "quant-genetics"
  | "settings";

/** What a page needs before it can do anything useful. */
type Requirement = "none" | "dataset" | "aligned" | "groups";

interface NavItem {
  id: PageId;
  labelKey: TranslationKey;
  icon: React.ReactNode;
  group: string;
  requires: Requirement;
}

const NAV: NavItem[] = [
  { id: "image-import",   labelKey: "nav.imageImport",   icon: <Images size={18} />,            group: "Digitize",     requires: "none" },
  { id: "digitizer",      labelKey: "nav.digitizer",     icon: <MousePointerClick size={18} />, group: "Digitize",     requires: "none" },
  { id: "data",           labelKey: "nav.data",          icon: <Database size={18} />,          group: "Data",         requires: "none" },
  { id: "procrustes",     labelKey: "nav.procrustes",    icon: <GitMerge size={18} />,          group: "Core",         requires: "dataset" },
  { id: "outliers",       labelKey: "nav.outliers",      icon: <ScanSearch size={18} />,        group: "Core",         requires: "aligned" },
  { id: "covariance",     labelKey: "nav.covariance",    icon: <Grid3X3 size={18} />,           group: "Core",         requires: "aligned" },
  { id: "wireframe",      labelKey: "nav.wireframe",     icon: <Spline size={18} />,            group: "Core",         requires: "dataset" },
  { id: "pca",            labelKey: "nav.pca",           icon: <BarChart2 size={18} />,         group: "Multivariate", requires: "aligned" },
  { id: "matrix-corr",    labelKey: "nav.matrixCorr",    icon: <Layers size={18} />,            group: "Multivariate", requires: "aligned" },
  { id: "pls",            labelKey: "nav.pls",           icon: <Sigma size={18} />,             group: "Multivariate", requires: "aligned" },
  { id: "regression",     labelKey: "nav.regression",    icon: <TrendingUp size={18} />,        group: "Multivariate", requires: "aligned" },
  { id: "modularity",     labelKey: "nav.modularity",    icon: <Network size={18} />,           group: "Multivariate", requires: "aligned" },
  { id: "cva",            labelKey: "nav.cva",           icon: <Activity size={18} />,          group: "Discriminant", requires: "groups" },
  { id: "lda",            labelKey: "nav.lda",           icon: <GitBranch size={18} />,         group: "Discriminant", requires: "groups" },
  { id: "phylogenetics",  labelKey: "nav.phylogenetics", icon: <GitBranch size={18} />,         group: "Comparative",  requires: "aligned" },
  { id: "quant-genetics", labelKey: "nav.quantGenetics", icon: <Dna size={18} />,               group: "Comparative",  requires: "aligned" },
  { id: "settings",       labelKey: "nav.settings",      icon: <Settings size={18} />,          group: "Tools",        requires: "none" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set());
  const { activePage, navigate } = useNavStore();
  const t = useT();

  const dataset = useDatasetStore((s) => s.dataset);
  const aligned = useDatasetStore((s) => s.aligned);
  const activeClassifier = useDatasetStore((s) => s.activeClassifier);
  const hasDataset = !!dataset;
  const hasAligned = !!aligned;
  const hasGroupLabels = hasGroups(dataset?.specimens.filter((s) => s.include) ?? [], activeClassifier);

  /** Why a page can't be opened yet, or null when it's ready. */
  function blockedReason(req: Requirement): string | null {
    if (req === "none") return null;
    if (!hasDataset) return t("ui.needDataset");
    if (req === "dataset") return null;
    if (!hasAligned) return t("ui.needProcrustes");
    if (req === "aligned") return null;
    if (!hasGroupLabels) return t("ui.needGroups");
    return null;
  }

  /** Pages that already hold a result get a dot, so progress is visible. */
  function isDone(id: PageId): boolean {
    if (id === "data") return hasDataset;
    if (id === "procrustes") return hasAligned;
    return false;
  }

  const groups = [...new Set(NAV.map((n) => n.group))];

  function toggleGroup(group: string) {
    setClosedGroups((prev) => {
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      return next;
    });
  }

  return (
    <TooltipProvider delayDuration={300}>
      <aside className={cn(
        "flex h-full flex-col border-r bg-card transition-all duration-200",
        collapsed ? "w-14" : "w-64"
      )}>
        <div className={cn("flex items-center gap-2 p-4 font-bold text-primary", collapsed && "justify-center")}>
          <Cat size={22} className="shrink-0" />
          {!collapsed && <span className="text-base">MorfoCat</span>}
        </div>

        <Separator />

        <ScrollArea className="flex-1 px-2 py-2">
          {groups.map((group) => {
            const isGroupClosed = closedGroups.has(group);
            const groupItems = NAV.filter((n) => n.group === group);
            const groupActive = groupItems.some((n) => n.id === activePage);

            return (
              <div key={group} className="mb-1">
                {!collapsed ? (
                  <button
                    onClick={() => toggleGroup(group)}
                    className={cn(
                      "mb-0.5 flex w-full items-center justify-between rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-widest transition-colors hover:bg-muted/60",
                      groupActive && isGroupClosed ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    <span>{t(`group.${group}` as TranslationKey)}</span>
                    <ChevronDown
                      size={11}
                      className={cn("transition-transform duration-150", isGroupClosed && "-rotate-90")}
                    />
                  </button>
                ) : (
                  <div className="mb-0.5 h-px mx-1 bg-border/50" />
                )}

                {(!isGroupClosed || collapsed) && groupItems.map((item) => {
                  const blocked = blockedReason(item.requires);
                  const done = isDone(item.id);
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        <Button
                          variant={activePage === item.id ? "default" : "ghost"}
                          size={collapsed ? "icon" : "sm"}
                          // Left enabled on purpose: a truly disabled button
                          // swallows hover, and the tooltip is what explains
                          // why the page isn't ready.
                          aria-disabled={!!blocked}
                          className={cn(
                            "relative w-full justify-start gap-2",
                            collapsed && "justify-center",
                            activePage === item.id && "font-semibold",
                            blocked && "cursor-not-allowed opacity-40"
                          )}
                          onClick={() => { if (!blocked) navigate(item.id); }}
                        >
                          {item.icon}
                          {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                          {done && (
                            <span
                              className={cn(
                                "ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500",
                                collapsed && "absolute right-1.5 top-1.5 ml-0"
                              )}
                            />
                          )}
                        </Button>
                      </TooltipTrigger>
                      {(collapsed || blocked) && (
                        <TooltipContent side="right" className="max-w-56 text-xs">
                          {collapsed && <span className="font-medium">{t(item.labelKey)}</span>}
                          {collapsed && blocked && <br />}
                          {blocked}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
              </div>
            );
          })}
        </ScrollArea>

        <Separator />
        <div className="p-2">
          <Button
            variant="ghost" size="icon" className="w-full"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}

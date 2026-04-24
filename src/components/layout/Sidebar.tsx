import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Database, GitMerge, ScanSearch, BarChart2, Layers, TrendingUp,
  Activity, GitBranch, Dna, Network, Sigma, ChevronLeft, ChevronRight,
  Cat, Grid3X3, Images, MousePointerClick, PackageOpen, Settings,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useNavStore } from "@/store/navStore";
import { useT, type TranslationKey } from "@/lib/i18n";

export type PageId =
  | "data" | "image-import" | "digitizer"
  | "procrustes" | "outliers" | "covariance"
  | "pca" | "matrix-corr" | "pls" | "regression" | "modularity"
  | "cva" | "lda"
  | "phylogenetics" | "quant-genetics"
  | "export-all" | "settings";

interface NavItem {
  id: PageId;
  labelKey: TranslationKey;
  icon: React.ReactNode;
  group: string;
}

const NAV: NavItem[] = [
  { id: "data",           labelKey: "nav.data",          icon: <Database size={18} />,          group: "Data" },
  { id: "image-import",   labelKey: "nav.imageImport",   icon: <Images size={18} />,            group: "Digitize" },
  { id: "digitizer",      labelKey: "nav.digitizer",     icon: <MousePointerClick size={18} />, group: "Digitize" },
  { id: "procrustes",     labelKey: "nav.procrustes",    icon: <GitMerge size={18} />,          group: "Core" },
  { id: "outliers",       labelKey: "nav.outliers",      icon: <ScanSearch size={18} />,        group: "Core" },
  { id: "covariance",     labelKey: "nav.covariance",    icon: <Grid3X3 size={18} />,           group: "Core" },
  { id: "pca",            labelKey: "nav.pca",           icon: <BarChart2 size={18} />,         group: "Multivariate" },
  { id: "matrix-corr",    labelKey: "nav.matrixCorr",    icon: <Layers size={18} />,            group: "Multivariate" },
  { id: "pls",            labelKey: "nav.pls",           icon: <Sigma size={18} />,             group: "Multivariate" },
  { id: "regression",     labelKey: "nav.regression",    icon: <TrendingUp size={18} />,        group: "Multivariate" },
  { id: "modularity",     labelKey: "nav.modularity",    icon: <Network size={18} />,           group: "Multivariate" },
  { id: "cva",            labelKey: "nav.cva",           icon: <Activity size={18} />,          group: "Discriminant" },
  { id: "lda",            labelKey: "nav.lda",           icon: <GitBranch size={18} />,         group: "Discriminant" },
  { id: "phylogenetics",  labelKey: "nav.phylogenetics", icon: <GitBranch size={18} />,         group: "Comparative" },
  { id: "quant-genetics", labelKey: "nav.quantGenetics", icon: <Dna size={18} />,               group: "Comparative" },
  { id: "export-all",     labelKey: "nav.exportAll",     icon: <PackageOpen size={18} />,       group: "Tools" },
  { id: "settings",       labelKey: "nav.settings",      icon: <Settings size={18} />,          group: "Tools" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { activePage, navigate } = useNavStore();
  const t = useT();

  const groups = [...new Set(NAV.map((n) => n.group))];

  return (
    <TooltipProvider delayDuration={300}>
      <aside className={cn(
        "flex h-full flex-col border-r bg-card transition-all duration-200",
        collapsed ? "w-14" : "w-56"
      )}>
        <div className={cn("flex items-center gap-2 p-4 font-bold text-primary", collapsed && "justify-center")}>
          <Cat size={22} className="shrink-0" />
          {!collapsed && <span className="text-base">MorfoCat</span>}
        </div>

        <Separator />

        <ScrollArea className="flex-1 px-2 py-2">
          {groups.map((group) => (
            <div key={group} className="mb-3">
              {!collapsed && (
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t(`group.${group}` as TranslationKey)}
                </p>
              )}
              {NAV.filter((n) => n.group === group).map((item) => (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={activePage === item.id ? "default" : "ghost"}
                      size={collapsed ? "icon" : "sm"}
                      className={cn(
                        "w-full justify-start gap-2",
                        collapsed && "justify-center",
                        activePage === item.id && "font-semibold"
                      )}
                      onClick={() => navigate(item.id)}
                    >
                      {item.icon}
                      {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                    </Button>
                  </TooltipTrigger>
                  {collapsed && <TooltipContent side="right">{t(item.labelKey)}</TooltipContent>}
                </Tooltip>
              ))}
            </div>
          ))}
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

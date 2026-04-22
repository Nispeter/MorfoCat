import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Database, GitMerge, ScanSearch, BarChart2, Layers, TrendingUp,
  Activity, GitBranch, Dna, Network, Sigma, ChevronLeft, ChevronRight, Cat,
  Grid3X3,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

export type PageId =
  | "data"
  | "procrustes"
  | "outliers"
  | "covariance"
  | "pca"
  | "matrix-corr"
  | "pls"
  | "regression"
  | "modularity"
  | "cva"
  | "lda"
  | "phylogenetics"
  | "quant-genetics";

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ReactNode;
  group: string;
}

const NAV: NavItem[] = [
  { id: "data", label: "Data Manager", icon: <Database size={18} />, group: "Data" },
  { id: "procrustes", label: "Procrustes Fit", icon: <GitMerge size={18} />, group: "Core" },
  { id: "outliers", label: "Outlier Detection", icon: <ScanSearch size={18} />, group: "Core" },
  { id: "covariance", label: "Covariance Matrix", icon: <Grid3X3 size={18} />, group: "Core" },
  { id: "pca", label: "PCA", icon: <BarChart2 size={18} />, group: "Multivariate" },
  { id: "matrix-corr", label: "Matrix Correlation", icon: <Layers size={18} />, group: "Multivariate" },
  { id: "pls", label: "Two-Block PLS", icon: <Sigma size={18} />, group: "Multivariate" },
  { id: "regression", label: "Regression", icon: <TrendingUp size={18} />, group: "Multivariate" },
  { id: "modularity", label: "Modularity", icon: <Network size={18} />, group: "Multivariate" },
  { id: "cva", label: "CVA", icon: <Activity size={18} />, group: "Discriminant" },
  { id: "lda", label: "LDA / Cross-Val", icon: <GitBranch size={18} />, group: "Discriminant" },
  { id: "phylogenetics", label: "Phylogenetics", icon: <GitBranch size={18} />, group: "Comparative" },
  { id: "quant-genetics", label: "Quant. Genetics", icon: <Dna size={18} />, group: "Comparative" },
];

interface SidebarProps {
  activePage: PageId;
  onNavigate: (id: PageId) => void;
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const groups = [...new Set(NAV.map((n) => n.group))];

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        className={cn(
          "flex h-full flex-col border-r bg-card transition-all duration-200",
          collapsed ? "w-14" : "w-56"
        )}
      >
        {/* Logo */}
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
                  {group}
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
                      onClick={() => onNavigate(item.id)}
                    >
                      {item.icon}
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Button>
                  </TooltipTrigger>
                  {collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
                </Tooltip>
              ))}
            </div>
          ))}
        </ScrollArea>

        <Separator />
        <div className="p-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-full"
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

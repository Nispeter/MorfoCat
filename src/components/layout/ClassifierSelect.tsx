import { useDatasetStore } from "@/store/datasetStore";
import { useT } from "@/lib/i18n";

/**
 * Compact dropdown to choose which classifier drives grouping/coloring.
 * Reads classifier names + active from the dataset store. Renders nothing
 * when no classifiers are defined.
 */
export function ClassifierSelect({ label }: { label?: string } = {}) {
  const t = useT();
  const names = useDatasetStore((s) => s.dataset?.classifierNames ?? []);
  const active = useDatasetStore((s) => s.activeClassifier);
  const setActive = useDatasetStore((s) => s.setActiveClassifier);

  if (names.length === 0) return null;

  return (
    <span className="flex items-center gap-1.5">
      <span className="text-xs font-normal text-muted-foreground">{label ?? t("plot.colorBy")}</span>
      <select
        className="rounded border px-1 py-0.5 text-xs"
        value={active ?? ""}
        onChange={(e) => setActive(e.target.value || null)}
      >
        {names.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </span>
  );
}

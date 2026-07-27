import type { Specimen } from "@/store/datasetStore";

/**
 * Resolve the grouping label for each specimen under the active classifier.
 * Falls back to the legacy `group` field, then "unassigned".
 */
export function groupsOf(specimens: Specimen[], active: string | null): string[] {
  return specimens.map((s) =>
    (active ? s.classifiers?.[active] : undefined) ?? s.group ?? "unassigned"
  );
}

/** True if at least one specimen has a non-empty label under the active classifier. */
export function hasGroups(specimens: Specimen[], active: string | null): boolean {
  return specimens.some((s) => {
    const g = (active ? s.classifiers?.[active] : undefined) ?? s.group;
    return !!g && g !== "unassigned";
  });
}

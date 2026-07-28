import type { Specimen } from "@/store/datasetStore";

export const UNASSIGNED = "unassigned";

/**
 * Resolve the grouping label for each specimen under the active classifier.
 * Falls back to the legacy `group` field, then "unassigned".
 *
 * An extracted classifier can legitimately come out empty — an ID shorter than
 * the character range asked for — and a blank label would otherwise reach the
 * plots as a nameless group with a blank legend entry.
 */
export function groupsOf(specimens: Specimen[], active: string | null): string[] {
  return specimens.map((s) => {
    const value = (active ? s.classifiers?.[active] : undefined) ?? s.group;
    return value?.trim() || UNASSIGNED;
  });
}

/** True if at least one specimen has a real label under the active classifier. */
export function hasGroups(specimens: Specimen[], active: string | null): boolean {
  return specimens.some((s) => {
    const g = ((active ? s.classifiers?.[active] : undefined) ?? s.group)?.trim();
    return !!g && g !== UNASSIGNED;
  });
}

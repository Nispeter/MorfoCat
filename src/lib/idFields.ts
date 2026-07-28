/**
 * Ways of pulling a classifier out of a specimen ID.
 *
 * ID conventions differ from one project to the next: some encode everything by
 * character position (`26-13MA020230`), others separate the parts with a
 * delimiter (`ficu_F_031`). Both are described here so a scheme can mix them,
 * and neither the order of the fields nor their names are assumed.
 */
export type IdField =
  | { name: string; by: "position"; first: number; last: number }
  | { name: string; by: "separator"; separator: string; part: number };

/** Separators worth offering, in the order they are guessed. */
export const ID_SEPARATORS: string[] = ["_", "-", ".", " ", "/"];

/**
 * Read one field out of an ID. Values are trimmed, since IDs taken from file
 * names often carry stray spaces and " QN" should not be a group of its own.
 */
export function idFieldValue(id: string, field: IdField): string {
  if (field.by === "separator") {
    if (!field.separator) return id.trim();
    return (id.split(field.separator)[field.part] ?? "").trim();
  }
  return id.slice(Math.max(0, field.first - 1), field.last).trim();
}

/**
 * Accept schemes saved before separators existed, which had no `by` tag.
 * Anything with a `first` is a character span.
 */
export function normalizeField(raw: unknown): IdField | null {
  const f = raw as Partial<IdField> & { first?: number; last?: number };
  if (!f || typeof f.name !== "string") return null;
  if ((f as { by?: string }).by === "separator") {
    const s = f as Extract<IdField, { by: "separator" }>;
    return { name: s.name, by: "separator", separator: s.separator ?? "_", part: s.part ?? 0 };
  }
  if (typeof f.first === "number" && typeof f.last === "number") {
    return { name: f.name, by: "position", first: f.first, last: f.last };
  }
  return null;
}

/** The separator that splits a sample of IDs into the most parts. */
export function guessSeparator(ids: string[]): string {
  const sample = ids.slice(0, 20);
  let best = ID_SEPARATORS[0];
  let bestParts = 1;
  for (const sep of ID_SEPARATORS) {
    // Only count it when every ID splits the same way, otherwise the parts
    // would not line up across specimens.
    const counts = sample.map((id) => id.split(sep).length);
    const parts = counts[0] ?? 1;
    if (parts > bestParts && counts.every((c) => c === parts)) {
      best = sep;
      bestParts = parts;
    }
  }
  return bestParts > 1 ? best : "";
}

/** How many parts a separator yields, for laying out the editor. */
export function partCount(ids: string[], separator: string): number {
  if (!separator) return 0;
  return ids.reduce((n, id) => Math.max(n, id.split(separator).length), 0);
}

/**
 * Carry persisted state across the MorfoCat → MorphoCat rename.
 *
 * The zustand stores key their `localStorage` entries by name, so renaming the
 * app orphaned everything saved under the old prefix: theme, language, recent
 * files and the figure styling all silently reset. This copies each entry over
 * once, the first time the renamed build runs.
 *
 * It runs as an import side effect, on purpose. `persist` reads storage while
 * the store module is evaluated, and ES imports are hoisted above statements —
 * so a function *called* from `main.tsx` would run too late. Importing this
 * module ahead of the app is what makes the ordering hold.
 *
 * Safe to delete once no one is upgrading from a build older than the rename.
 */
const RENAMED = ["settings", "recent-files", "plot-style"];

export function migrateRenamedStorage(): void {
  let moved = 0;
  for (const suffix of RENAMED) {
    const from = `morfocat-${suffix}`;
    const to = `morphocat-${suffix}`;
    try {
      // Never overwrite: whatever the renamed build already wrote is newer.
      if (localStorage.getItem(to) !== null) continue;
      const value = localStorage.getItem(from);
      if (value === null) continue;
      localStorage.setItem(to, value);
      moved++;
    } catch {
      // Storage can be unavailable or full; losing preferences is not worth
      // failing to start over.
    }
  }
  if (moved > 0) {
    console.info(`Carried ${moved} saved setting(s) over from the old app name.`);
  }
}

migrateRenamedStorage();

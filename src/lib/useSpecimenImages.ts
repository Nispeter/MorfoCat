import { useEffect, useState } from "react";
import { readFileB64 } from "./ipc";
import { imageMime } from "./figure";

/** Decoded images live for the session — re-reading them off disk on every
 *  re-render would make dragging the legend crawl. */
const cache = new Map<string, string>();

/**
 * Resolve specimen photos to data URLs.
 *
 * Paths that cannot be read (moved or renamed images) resolve to nothing rather
 * than throwing, so the figure just falls back to drawing the wireframe.
 */
export function useSpecimenImages(paths: string[]): Record<string, string> {
  // JSON rather than a joined string: image paths can contain any character.
  const key = JSON.stringify(paths);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const wanted = [...new Set(paths.filter(Boolean))];
    if (wanted.length === 0) {
      setUrls({});
      return;
    }

    // Show whatever is already cached straight away, then fill in the rest.
    const immediate: Record<string, string> = {};
    for (const p of wanted) {
      const hit = cache.get(p);
      if (hit) immediate[p] = hit;
    }
    setUrls(immediate);

    const missing = wanted.filter((p) => !cache.has(p));
    if (missing.length === 0) return;

    Promise.all(
      missing.map(async (p) => {
        try {
          const b64 = await readFileB64(p);
          cache.set(p, `data:${imageMime(p)};base64,${b64}`);
        } catch {
          cache.set(p, "");
        }
      })
    ).then(() => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const p of wanted) {
        const url = cache.get(p);
        if (url) next[p] = url;
      }
      setUrls(next);
    });

    return () => { cancelled = true; };
  }, [key]);

  return urls;
}

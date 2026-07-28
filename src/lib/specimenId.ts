/**
 * Working out a usable name for a specimen.
 *
 * Shared by the Data Manager and the Digitizer so a file gives the same IDs
 * whichever door it comes in through — otherwise a dataset loaded via the
 * digitizer ends up labelled 0, 1, 2 and no classifier can be cut out of it.
 */

/** File name of an image reference, without directories or extension. */
export function imageStem(image: string): string {
  const base = image.replace(/\\/g, "/").split("/").pop() ?? image;
  return base
    .replace(/\.[^.]+$/, "")
    // File names collected by hand pick up stray and doubled spaces, which
    // would otherwise split one site into "La Puntilla" and "La  Puntilla".
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pick the most informative name available.
 *
 * A bare number carries nothing — tpsDig writes `ID=0`, `ID=1` by default — so
 * the image file name wins when there is one, since that is where projects
 * actually encode the site, area and specimen codes.
 */
export function resolveSpecimenId(
  id: string | null | undefined,
  image: string | null | undefined,
  fallbackIdx: number
): string {
  if (id && !/^\d+$/.test(id.trim())) return id.trim();
  if (image) return imageStem(image);
  if (id) return id.trim();
  return `specimen_${fallbackIdx + 1}`;
}

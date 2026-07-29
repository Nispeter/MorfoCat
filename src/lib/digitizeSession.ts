import { parseTPS } from "@/lib/parsers";
import { readTextFile, listDirImages } from "@/lib/ipc";
import { resolveSpecimenId } from "@/lib/specimenId";
import type { DigitizerSpecimen } from "@/store/digitizerStore";

export function basename(p: string) {
  return p.replace(/\\/g, "/").split("/").pop() ?? p;
}

export function dirname(p: string) {
  const norm = p.replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  return idx === -1 ? "" : norm.slice(0, idx);
}

export interface OpenedTPS {
  specimens: DigitizerSpecimen[];
  dir: string;
  filePath: string;
  /** 0 for a TpsUtil template, which lists images but has no coordinates yet. */
  nLandmarks: number;
  /** True when the file carries no IMAGE= field at all. */
  noImageRefs: boolean;
  /** Images the file names that are not in the folder the file sits in. */
  missingImages: string[];
}

/**
 * Read a TPS file as the starting point of a digitizing session.
 *
 * TPS files identify images by name, not by a path that survives being moved,
 * so the images have to sit in the same folder as the TPS itself — tpsDig
 * writes absolute paths from whatever machine digitized them, and those almost
 * never resolve anywhere else. The names are therefore stripped to their base
 * and looked for next to the file, and whatever is not there is reported so the
 * caller can say so plainly rather than showing empty canvases later.
 */
export async function openTPSForDigitizing(filePath: string): Promise<OpenedTPS> {
  const parsed = parseTPS(await readTextFile(filePath));
  const dir = dirname(filePath);

  const specimens: DigitizerSpecimen[] = parsed.specimens.map((sp, i) => {
    const imgBase = sp.image ? basename(sp.image) : null;
    return {
      id: resolveSpecimenId(sp.id, imgBase, i),
      imagePath: imgBase ? (dir ? `${dir}/${imgBase}` : imgBase) : "",
      imageBase: imgBase ?? "",
      scale: sp.scale ?? undefined,
      landmarks: sp.landmarks.map((pt) => ({
        x: pt[0],
        y: pt[1],
        isSemi: false, // plain TPS carries no semilandmark information
      })),
    };
  });

  const wanted = specimens.map((sp) => sp.imageBase).filter(Boolean);
  let missingImages: string[] = [];
  if (wanted.length > 0) {
    try {
      const present = new Set((await listDirImages(dir || ".")).map((p) => basename(p).toLowerCase()));
      missingImages = wanted.filter((name) => !present.has(name.toLowerCase()));
    } catch {
      // An unreadable folder is not worth failing the import over; the canvas
      // reports a missing image per specimen anyway.
    }
  }

  return {
    specimens,
    dir,
    filePath,
    nLandmarks: parsed.n_landmarks,
    noImageRefs: wanted.length === 0,
    missingImages,
  };
}

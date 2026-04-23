"""TPS (thin-plate spline) file format parser and writer.

Handles both orderings that exist in the wild:
  - Metadata after coordinates (most common):
      LM=n  /  coords  /  IMAGE=  /  *ID=  /  SCALE=
  - Metadata before coordinates (some digitizers):
      IMAGE=  /  *ID=  /  SCALE=  /  LM=n  /  coords
"""
from __future__ import annotations
import re
from typing import Any


def parse_tps(content: str) -> dict[str, Any]:
    """Parse TPS file content into landmark arrays."""
    specimens: list[dict] = []
    current: dict | None = None
    lm_count = 0
    collected = 0
    # Buffer for metadata lines that arrive before the LM= of their block
    pending: dict = {}

    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        key_match = re.match(r"^\*?([A-Z_]+)=(.*)$", line, re.IGNORECASE)
        if key_match:
            key = key_match.group(1).upper()
            val = key_match.group(2).strip()

            if key == "LM":
                if current is not None:
                    specimens.append(current)
                current = {
                    "landmarks": [],
                    "id": pending.pop("id", None),
                    "scale": pending.pop("scale", None),
                    "image": pending.pop("image", None),
                }
                pending.clear()
                lm_count = int(val)
                collected = 0

            elif key == "ID":
                if current is not None:
                    current["id"] = val
                else:
                    pending["id"] = val

            elif key == "IMAGE":
                if current is not None:
                    current["image"] = val
                else:
                    pending["image"] = val

            elif key == "SCALE":
                try:
                    f = float(val)
                    if current is not None:
                        current["scale"] = f
                    else:
                        pending["scale"] = f
                except ValueError:
                    pass

            # silently skip CURVES and other unknown keys

        elif current is not None and collected < lm_count:
            coords = [float(v) for v in line.split()]
            current["landmarks"].append(coords)
            collected += 1

    if current is not None:
        specimens.append(current)

    if not specimens:
        raise ValueError("No specimens found in TPS file.")

    n_lm = len(specimens[0]["landmarks"])
    if n_lm == 0:
        raise ValueError("First specimen has no landmark coordinates.")
    dim = len(specimens[0]["landmarks"][0])
    for i, sp in enumerate(specimens):
        if len(sp["landmarks"]) != n_lm:
            raise ValueError(
                f"Specimen {i} has {len(sp['landmarks'])} landmarks; expected {n_lm}."
            )

    return {
        "specimens": [
            {
                "id": sp.get("id"),
                "scale": sp.get("scale"),
                "image": sp.get("image"),
                "landmarks": sp["landmarks"],
            }
            for sp in specimens
        ],
        "n_landmarks": n_lm,
        "dimensions": dim,
    }


def write_tps(
    landmarks: list[list[list[float]]],
    ids: list[str] | None = None,
    scale: list[float] | None = None,
) -> str:
    """Serialize landmark data back to TPS format."""
    lines: list[str] = []
    for i, sp_lms in enumerate(landmarks):
        lines.append(f"LM={len(sp_lms)}")
        for pt in sp_lms:
            lines.append(" ".join(f"{v:.6f}" for v in pt))
        if ids and i < len(ids):
            lines.append(f"ID={ids[i]}")
        if scale and i < len(scale):
            lines.append(f"SCALE={scale[i]:.6f}")
        lines.append("")
    return "\n".join(lines)

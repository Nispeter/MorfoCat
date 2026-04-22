"""TPS (thin-plate spline) file format parser and writer.

TPS is the most common format for geometric morphometrics landmark data.
Each specimen block:
  LM=<n>
  x1 y1
  ...
  xn yn
  ID=<name>       (optional)
  SCALE=<float>   (optional)
  IMAGE=<file>    (optional)
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

    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        key_match = re.match(r"^([A-Z_]+)=(.*)$", line, re.IGNORECASE)
        if key_match:
            key = key_match.group(1).upper()
            val = key_match.group(2).strip()

            if key == "LM":
                if current is not None:
                    specimens.append(current)
                current = {"landmarks": [], "id": None, "scale": None, "image": None}
                lm_count = int(val)
                collected = 0

            elif key in ("ID", "IMAGE") and current is not None:
                current[key.lower()] = val

            elif key == "SCALE" and current is not None:
                try:
                    current["scale"] = float(val)
                except ValueError:
                    pass

            elif key == "CURVES":
                # skip curve data blocks
                pass

        elif current is not None and collected < lm_count:
            coords = [float(v) for v in line.split()]
            current["landmarks"].append(coords)
            collected += 1

    if current is not None:
        specimens.append(current)

    if not specimens:
        raise ValueError("No specimens found in TPS file.")

    # Validate uniform landmark count
    n_lm = len(specimens[0]["landmarks"])
    dim = len(specimens[0]["landmarks"][0]) if specimens[0]["landmarks"] else 2
    for sp in specimens:
        if len(sp["landmarks"]) != n_lm:
            raise ValueError("Inconsistent landmark counts across specimens.")

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

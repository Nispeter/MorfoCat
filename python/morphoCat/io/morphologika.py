"""Morphologika file format parser and writer."""
from __future__ import annotations
import re
from typing import Any


def _read_block(lines: list[str], tag: str) -> list[str] | None:
    """Extract lines inside [tag] ... [end tag] blocks (case-insensitive)."""
    inside = False
    result: list[str] = []
    end_tag = f"[end {tag.lower().strip('[]')}]"
    for line in lines:
        low = line.strip().lower()
        if low == tag.lower():
            inside = True
            continue
        if low == end_tag:
            break
        if inside:
            result.append(line.strip())
    return result if result else None


def parse_morphologika(content: str) -> dict[str, Any]:
    lines = content.splitlines()
    stripped = [l.strip() for l in lines]

    def find_value(key: str) -> str | None:
        for l in stripped:
            if l.lower().startswith(f"[{key.lower()}]"):
                return l.split("]", 1)[-1].strip()
        return None

    n_inds = int(find_value("individuals") or 0)
    n_lm = int(find_value("landmarks") or 0)
    n_dim = int(find_value("dimensions") or 2)

    ids_block = _read_block(stripped, "[labels]") or []
    ids = [l for l in ids_block if l]

    data_block = _read_block(stripped, "[rawpoints]") or []
    specimens: list[dict] = []
    current_lms: list[list[float]] = []

    for line in data_block:
        if re.match(r"^'", line):
            if current_lms:
                specimens.append(current_lms)
            current_lms = []
        else:
            coords = [float(v) for v in line.split() if v]
            if coords:
                current_lms.append(coords)

    if current_lms:
        specimens.append(current_lms)

    if not specimens and n_inds:
        raise ValueError("No rawpoints data found in Morphologika file.")

    return {
        "specimens": [
            {
                "id": ids[i] if i < len(ids) else f"specimen_{i + 1}",
                "scale": None,
                "image": None,
                "landmarks": sp,
            }
            for i, sp in enumerate(specimens)
        ],
        "n_landmarks": n_lm or (len(specimens[0]) if specimens else 0),
        "dimensions": n_dim,
    }


def write_morphologika(
    landmarks: list[list[list[float]]],
    ids: list[str] | None = None,
) -> str:
    if not landmarks:
        return ""
    n_spec = len(landmarks)
    n_lm = len(landmarks[0])
    n_dim = len(landmarks[0][0])
    lines = [
        f"[individuals] {n_spec}",
        f"[landmarks] {n_lm}",
        f"[dimensions] {n_dim}",
        "[labels]",
        *[(ids[i] if ids and i < len(ids) else f"specimen_{i + 1}") for i in range(n_spec)],
        "[end labels]",
        "[rawpoints]",
    ]
    for i, sp in enumerate(landmarks):
        label = ids[i] if ids and i < len(ids) else f"specimen_{i + 1}"
        lines.append(f"'{label}")
        for pt in sp:
            lines.append(" ".join(f"{v:.6f}" for v in pt))
    lines.append("[end rawpoints]")
    return "\n".join(lines)

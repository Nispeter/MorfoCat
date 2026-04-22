"""NTS (NTSYS) file format parser and writer."""
from __future__ import annotations
from typing import Any


def parse_nts(content: str) -> dict[str, Any]:
    """Parse NTS format. First non-comment line is: n_specimens n_landmarks [n_dim]."""
    lines = [l.strip() for l in content.splitlines() if l.strip() and not l.strip().startswith("'")]

    if not lines:
        raise ValueError("Empty NTS file.")

    header = lines[0].split()
    n_spec = int(header[0])
    n_lm = int(header[1])
    n_dim = int(header[2]) if len(header) > 2 else 2

    # Remaining lines are flat coordinate data
    coords_flat: list[float] = []
    ids: list[str] = []

    for line in lines[1:]:
        tokens = line.split()
        for t in tokens:
            try:
                coords_flat.append(float(t))
            except ValueError:
                ids.append(t)

    expected = n_spec * n_lm * n_dim
    if len(coords_flat) != expected:
        raise ValueError(
            f"Expected {expected} coordinate values, got {len(coords_flat)}."
        )

    specimens = []
    per_spec = n_lm * n_dim
    for i in range(n_spec):
        flat = coords_flat[i * per_spec: (i + 1) * per_spec]
        lms = [flat[j * n_dim: (j + 1) * n_dim] for j in range(n_lm)]
        specimens.append({
            "id": ids[i] if i < len(ids) else f"specimen_{i + 1}",
            "scale": None,
            "image": None,
            "landmarks": lms,
        })

    return {
        "specimens": specimens,
        "n_landmarks": n_lm,
        "dimensions": n_dim,
    }


def write_nts(
    landmarks: list[list[list[float]]],
    ids: list[str] | None = None,
) -> str:
    if not landmarks:
        return ""
    n_spec = len(landmarks)
    n_lm = len(landmarks[0])
    n_dim = len(landmarks[0][0])
    lines = [f"{n_spec} {n_lm} {n_dim}"]
    for i, sp in enumerate(landmarks):
        flat = " ".join(f"{v:.6f}" for pt in sp for v in pt)
        prefix = (ids[i] + " ") if ids and i < len(ids) else ""
        lines.append(prefix + flat)
    return "\n".join(lines)

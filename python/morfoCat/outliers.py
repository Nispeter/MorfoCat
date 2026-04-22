"""Outlier detection based on Procrustes distances from the mean configuration."""
from __future__ import annotations
import numpy as np
from typing import Any


def detect_outliers(aligned: list[list[list[float]]]) -> dict[str, Any]:
    arr = np.array(aligned, dtype=float)  # (n_spec, n_lm, n_dim)
    mean = arr.mean(axis=0)
    distances = np.sqrt(np.sum((arr - mean) ** 2, axis=(1, 2)))

    mean_d = float(distances.mean())
    std_d = float(distances.std(ddof=1))
    z_scores = (np.zeros_like(distances) if std_d == 0.0
                else (distances - mean_d) / std_d).tolist()

    return {
        "procrustes_distances": distances.tolist(),
        "mean_distance": mean_d,
        "std_distance": std_d,
        "z_scores": z_scores,
    }

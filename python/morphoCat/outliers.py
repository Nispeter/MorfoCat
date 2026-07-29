"""Outlier detection based on distances from the mean configuration.

Two distances per specimen:

- **Procrustes distance** — plain Euclidean distance from the mean shape,
  treating every shape variable as equally important.
- **Mahalanobis distance** — the same distance measured in units of how much
  the sample actually varies in each direction, so a specimen that is unusual
  in a normally-invariant direction stands out even if it is close overall.
"""
from __future__ import annotations
import numpy as np
from typing import Any


def detect_outliers(aligned: list[list[list[float]]]) -> dict[str, Any]:
    arr = np.array(aligned, dtype=float)  # (n_spec, n_lm, n_dim)
    mean = arr.mean(axis=0)
    distances = np.sqrt(np.sum((arr - mean) ** 2, axis=(1, 2)))

    mean_d = float(distances.mean())
    std_d = float(distances.std(ddof=1)) if arr.shape[0] > 1 else 0.0
    z_scores = (np.zeros_like(distances) if std_d == 0.0
                else (distances - mean_d) / std_d).tolist()

    return {
        "procrustes_distances": distances.tolist(),
        "mean_distance": mean_d,
        "std_distance": std_d,
        "z_scores": z_scores,
        "mahalanobis_distances": _mahalanobis_from_mean(arr).tolist(),
    }


def _mahalanobis_from_mean(arr: np.ndarray) -> np.ndarray:
    """
    Mahalanobis distance of every specimen from the sample mean.

    Procrustes-aligned coordinates always have more variables than specimens,
    so the covariance matrix is singular; a pseudo-inverse restricted to the
    non-degenerate directions gives the usual well-defined answer.
    """
    n_spec = arr.shape[0]
    X = arr.reshape(n_spec, -1)
    if n_spec < 3:
        return np.zeros(n_spec)

    centered = X - X.mean(axis=0)
    cov = np.cov(centered, rowvar=False)
    if cov.ndim == 0:
        cov = cov.reshape(1, 1)
    # rcond trims directions with essentially no variance, which would
    # otherwise blow the distance up to meaningless magnitudes.
    inv = np.linalg.pinv(cov, rcond=1e-10, hermitian=True)
    d2 = np.einsum("ij,jk,ik->i", centered, inv, centered)
    return np.sqrt(np.maximum(d2, 0.0))

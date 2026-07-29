"""Generalized Procrustes Analysis (GPA).

Implements full GPA (Rohlf & Slice 1990) for 2D and 3D landmark data,
with optional object symmetry support (Mardia et al. 2000).
"""
from __future__ import annotations
import numpy as np
from typing import Any


def _center(X: np.ndarray) -> np.ndarray:
    return X - X.mean(axis=0)


def _scale(X: np.ndarray) -> tuple[np.ndarray, float]:
    cs = np.sqrt(np.sum(X ** 2))
    return X / cs, float(cs)


def _rotate(X: np.ndarray, Y: np.ndarray) -> np.ndarray:
    """Optimal rotation of X onto Y via SVD (full rotation, no reflection)."""
    M = Y.T @ X
    U, _, Vt = np.linalg.svd(M)
    # Ensure proper rotation (det = +1)
    D = np.eye(M.shape[0])
    D[-1, -1] = np.linalg.det(U @ Vt)
    R = U @ D @ Vt
    return X @ R.T


def procrustes_gpa(
    landmarks: list[list[list[float]]],
    symmetry: bool = False,
    sym_pairs: list[list[int]] | None = None,
    midline_lms: list[int] | None = None,
    max_iter: int = 100,
    tol: float = 1e-10,
) -> dict[str, Any]:
    """
    Full Procrustes GPA.

    Parameters
    ----------
    landmarks : list of (n_lm × n_dim) arrays (as nested lists)
    symmetry  : if True, enforce bilateral object symmetry
    sym_pairs : pairs of landmark indices [(left, right), ...]
    midline_lms : indices of midline landmarks (reflected to themselves)
    """
    arr = np.array(landmarks, dtype=float)  # (n_spec, n_lm, n_dim)
    n_spec, n_lm, n_dim = arr.shape

    # Step 1: center + scale each configuration
    configs = np.zeros_like(arr)
    centroid_sizes = np.zeros(n_spec)
    for i in range(n_spec):
        c = _center(arr[i])
        c, cs = _scale(c)
        configs[i] = c
        centroid_sizes[i] = cs

    # Step 2: iterative alignment to consensus
    mean_config = configs[0].copy()
    for _ in range(max_iter):
        # Align all to current mean
        aligned = np.zeros_like(configs)
        for i in range(n_spec):
            aligned[i] = _rotate(configs[i], mean_config)

        new_mean = aligned.mean(axis=0)
        # Re-scale mean to unit size
        _, cs_mean = _scale(new_mean)
        new_mean = _center(new_mean)
        new_mean, _ = _scale(new_mean)

        diff = np.max(np.abs(new_mean - mean_config))
        mean_config = new_mean
        if diff < tol:
            break

    # Symmetry enforcement: average each specimen with its reflected copy
    if symmetry and sym_pairs:
        sym_aligned = np.zeros_like(aligned)
        for i in range(n_spec):
            config = aligned[i].copy()
            reflected = config.copy()
            for left, right in sym_pairs:
                reflected[left] = config[right].copy()
                reflected[right] = config[left].copy()
                # Flip x-coordinate for 2D/3D bilateral symmetry
                reflected[left, 0] *= -1
                reflected[right, 0] *= -1
            if midline_lms:
                for ml in midline_lms:
                    reflected[ml, 0] *= -1
            sym_aligned[i] = (config + _rotate(reflected, config)) / 2
        aligned = sym_aligned
        mean_config = aligned.mean(axis=0)
        mean_config = _center(mean_config)
        mean_config, _ = _scale(mean_config)

    # Procrustes residuals (Procrustes distances from mean)
    residuals = [float(np.sqrt(np.sum((aligned[i] - mean_config) ** 2))) for i in range(n_spec)]

    return {
        "aligned": aligned.tolist(),
        "consensus": mean_config.tolist(),
        "centroid_sizes": centroid_sizes.tolist(),
        "procrustes_distances": residuals,
        "n_specimens": n_spec,
        "n_landmarks": n_lm,
        "dimensions": n_dim,
    }

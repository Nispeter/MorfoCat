"""Two-block Partial Least Squares (PLS) via SVD of the cross-covariance matrix."""
from __future__ import annotations
import numpy as np
from typing import Any


def two_block_pls(
    block1: list,
    block2: list,
    permutations: int = 999,
) -> dict[str, Any]:
    X = np.array(block1, dtype=float)
    Y = np.array(block2, dtype=float)

    if X.ndim == 3:
        X = X.reshape(X.shape[0], -1)
    if Y.ndim == 3:
        Y = Y.reshape(Y.shape[0], -1)

    n = X.shape[0]
    Xc = X - X.mean(axis=0)
    Yc = Y - Y.mean(axis=0)

    # Cross-covariance matrix
    S_xy = (Xc.T @ Yc) / (n - 1)

    U, singular_values, Vt = np.linalg.svd(S_xy, full_matrices=False)

    # Scores
    x_scores = (Xc @ U).tolist()
    y_scores = (Yc @ Vt.T).tolist()

    # RV coefficient (Escoufier 1973) — measures overall association.
    # Use raw cross-products (no 1/(n-1) normalisation) so numerator and
    # denominator are on the same scale: RV = tr(XY·YX) / sqrt(tr(XX²)·tr(YY²))
    Wxy = Xc.T @ Yc
    Wxx = Xc.T @ Xc
    Wyy = Yc.T @ Yc
    denom = np.sqrt(np.trace(Wxx @ Wxx) * np.trace(Wyy @ Wyy))
    rv = float(np.trace(Wxy @ Wxy.T) / denom) if denom > 0 else 0.0

    # Permutation test for first singular value
    rng = np.random.default_rng(None)
    sv1_obs = float(singular_values[0])
    null_sv1 = np.zeros(permutations)
    for i in range(permutations):
        perm = rng.permutation(n)
        S_perm = (Xc[perm].T @ Yc) / (n - 1)
        _, sv_perm, _ = np.linalg.svd(S_perm, full_matrices=False)
        null_sv1[i] = sv_perm[0]

    p_value = float((null_sv1 >= sv1_obs).mean())

    pct_covariance = (singular_values ** 2 / np.sum(singular_values ** 2) * 100).tolist()

    return {
        "singular_values": singular_values.tolist(),
        "pct_covariance": pct_covariance,
        "x_loadings": U.tolist(),
        "y_loadings": Vt.T.tolist(),
        "x_scores": x_scores,
        "y_scores": y_scores,
        "rv_coefficient": rv,
        "p_value_sv1": p_value,
        "permutations": permutations,
    }

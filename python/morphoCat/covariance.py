"""Covariance matrix computation: standard and pooled within-group."""
from __future__ import annotations
import numpy as np
from typing import Any


def _reshape_aligned(aligned: list) -> np.ndarray:
    """Flatten (n_spec, n_lm, n_dim) → (n_spec, n_lm*n_dim)."""
    arr = np.array(aligned, dtype=float)
    return arr.reshape(arr.shape[0], -1)


def compute_covariance(
    aligned: list,
    groups: list[str] | None = None,
    pooled: bool = False,
) -> dict[str, Any]:
    X = _reshape_aligned(aligned)
    n_spec, n_vars = X.shape

    if not pooled or groups is None:
        cov = np.cov(X, rowvar=False).tolist()
        return {
            "covariance": cov,
            "n_specimens": n_spec,
            "n_variables": n_vars,
            "type": "standard",
        }

    # Pooled within-group covariance
    group_labels = np.array(groups)
    unique_groups = np.unique(group_labels)
    pooled_cov = np.zeros((n_vars, n_vars))
    total_df = 0

    for g in unique_groups:
        mask = group_labels == g
        Xg = X[mask]
        ng = Xg.shape[0]
        if ng < 2:
            continue
        cg = np.cov(Xg, rowvar=False)
        pooled_cov += (ng - 1) * cg
        total_df += ng - 1

    if total_df > 0:
        pooled_cov /= total_df

    return {
        "covariance": pooled_cov.tolist(),
        "n_specimens": n_spec,
        "n_variables": n_vars,
        "type": "pooled_within_group",
        "groups": unique_groups.tolist(),
        "degrees_of_freedom": total_df,
    }

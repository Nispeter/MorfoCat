"""Principal Component Analysis on Procrustes shape coordinates."""
from __future__ import annotations
import numpy as np
from typing import Any


def run_pca(
    aligned: list,
    cov_matrix: list | None = None,
) -> dict[str, Any]:
    arr = np.array(aligned, dtype=float)
    n_spec = arr.shape[0]
    X = arr.reshape(n_spec, -1)  # (n_spec, p)

    # Use provided covariance or compute from data
    if cov_matrix is not None:
        S = np.array(cov_matrix, dtype=float)
    else:
        S = np.cov(X, rowvar=False)

    # Eigendecomposition
    eigenvalues, eigenvectors = np.linalg.eigh(S)
    # Sort descending
    idx = np.argsort(eigenvalues)[::-1]
    eigenvalues = eigenvalues[idx]
    eigenvectors = eigenvectors[:, idx]

    # Keep only positive eigenvalues (numerical zeros may appear)
    pos_mask = eigenvalues > 1e-12
    eigenvalues = eigenvalues[pos_mask]
    eigenvectors = eigenvectors[:, pos_mask]

    # Percent variance explained
    total_var = eigenvalues.sum()
    pct_variance = (eigenvalues / total_var * 100).tolist()
    cumulative_pct = np.cumsum(pct_variance).tolist()

    # PC scores: project centered data onto eigenvectors
    Xc = X - X.mean(axis=0)
    scores = (Xc @ eigenvectors).tolist()

    return {
        "scores": scores,
        "loadings": eigenvectors.tolist(),
        "eigenvalues": eigenvalues.tolist(),
        "pct_variance": pct_variance,
        "cumulative_pct": cumulative_pct,
        "n_components": int(pos_mask.sum()),
        "n_specimens": n_spec,
    }

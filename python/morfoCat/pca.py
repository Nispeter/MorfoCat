"""Principal Component Analysis on Procrustes shape coordinates."""
from __future__ import annotations
import numpy as np
from typing import Any


def _fix_signs(eigenvectors: np.ndarray) -> np.ndarray:
    """
    Give every component a deterministic sign.

    An eigenvector is only defined up to sign, so `eigh` may hand back either
    direction and a plot can come out mirrored from one run to the next — or
    against a figure made in another program. Forcing the largest-magnitude
    entry of each component to be positive (the convention scikit-learn uses)
    makes the orientation reproducible. Whether it matches some other program's
    choice is a separate question, which is why the figure also lets the axis be
    flipped by hand.
    """
    if eigenvectors.size == 0:
        return eigenvectors
    dominant = np.argmax(np.abs(eigenvectors), axis=0)
    signs = np.sign(eigenvectors[dominant, np.arange(eigenvectors.shape[1])])
    signs[signs == 0] = 1.0
    return eigenvectors * signs


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

    eigenvectors = _fix_signs(eigenvectors)

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

"""Matrix correlation with permutation test (Mantel-style)."""
from __future__ import annotations
import numpy as np
from typing import Any


def _upper_tri(M: np.ndarray) -> np.ndarray:
    idx = np.triu_indices(M.shape[0], k=1)
    return M[idx]


def matrix_correlation(
    matrix_a: list,
    matrix_b: list,
    permutations: int = 999,
) -> dict[str, Any]:
    A = np.array(matrix_a, dtype=float)
    B = np.array(matrix_b, dtype=float)

    a_vec = _upper_tri(A)
    b_vec = _upper_tri(B)

    observed_r = float(np.corrcoef(a_vec, b_vec)[0, 1])

    # Permutation test: randomly permute rows and columns of A
    rng = np.random.default_rng(None)
    null_dist = np.zeros(permutations)
    n = A.shape[0]
    for i in range(permutations):
        perm = rng.permutation(n)
        A_perm = A[perm][:, perm]
        null_dist[i] = np.corrcoef(_upper_tri(A_perm), b_vec)[0, 1]

    p_value = float((np.abs(null_dist) >= np.abs(observed_r)).mean())

    return {
        "r": observed_r,
        "p_value": p_value,
        "permutations": permutations,
        "null_distribution": null_dist.tolist(),
    }

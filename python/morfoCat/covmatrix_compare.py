"""Comparison of covariance matrices between groups.

Two complementary statistics, as in MorphoJ:

- **Matrix correlation** — Pearson correlation between the entries of the two
  covariance matrices, reported both with and without the diagonal (the
  diagonal holds the variances and tends to dominate the correlation).
- **Random skewers** (Cheverud & Marroig 2007) — the two matrices are applied
  to many random selection vectors; the mean correlation between the resulting
  response vectors says how similarly the matrices would channel selection.

Significance comes from permuting specimens between the two groups, which is
the null hypothesis that both groups share one covariance structure.
"""
from __future__ import annotations
import numpy as np
from itertools import combinations
from typing import Any


def _flatten(M: np.ndarray, include_diagonal: bool) -> np.ndarray:
    idx = np.triu_indices(M.shape[0], k=0 if include_diagonal else 1)
    return M[idx]


def _matrix_correlation(A: np.ndarray, B: np.ndarray, include_diagonal: bool) -> float:
    a = _flatten(A, include_diagonal)
    b = _flatten(B, include_diagonal)
    if a.size < 2 or np.std(a) == 0 or np.std(b) == 0:
        return 0.0
    return float(np.corrcoef(a, b)[0, 1])


def _random_skewers(A: np.ndarray, B: np.ndarray, skewers: np.ndarray) -> float:
    """Mean correlation between responses of A and B to random selection vectors."""
    Ra = skewers @ A.T
    Rb = skewers @ B.T
    na = np.linalg.norm(Ra, axis=1)
    nb = np.linalg.norm(Rb, axis=1)
    ok = (na > 0) & (nb > 0)
    if not np.any(ok):
        return 0.0
    cos = np.sum(Ra[ok] * Rb[ok], axis=1) / (na[ok] * nb[ok])
    return float(np.mean(cos))


def compare_covariance_matrices(
    aligned: list,
    groups: list[str],
    permutations: int = 999,
    n_skewers: int = 1000,
    seed: int | None = None,
) -> dict[str, Any]:
    arr = np.array(aligned, dtype=float)
    X = arr.reshape(arr.shape[0], -1)
    y = np.array(groups)

    unique = sorted(set(groups))
    if len(unique) < 2:
        raise ValueError("Comparing covariance matrices needs at least two groups.")

    rng = np.random.default_rng(seed)
    n_vars = X.shape[1]
    skewers = rng.normal(size=(n_skewers, n_vars))
    skewers /= np.linalg.norm(skewers, axis=1, keepdims=True)

    pairs: list[dict[str, Any]] = []

    for g1, g2 in combinations(unique, 2):
        ia = np.flatnonzero(y == g1)
        ib = np.flatnonzero(y == g2)
        if len(ia) < 3 or len(ib) < 3:
            pairs.append({
                "group1": g1, "group2": g2,
                "n1": int(len(ia)), "n2": int(len(ib)),
                "r_with_diagonal": 0.0, "r_without_diagonal": 0.0,
                "random_skewers": 0.0,
                "p_matrix_correlation": 1.0, "p_random_skewers": 1.0,
                "warning": "Each group needs at least 3 specimens.",
            })
            continue

        Ca = np.cov(X[ia], rowvar=False)
        Cb = np.cov(X[ib], rowvar=False)

        r_diag = _matrix_correlation(Ca, Cb, True)
        r_nodiag = _matrix_correlation(Ca, Cb, False)
        rs = _random_skewers(Ca, Cb, skewers)

        # Under the null the groups share a covariance structure, so shuffled
        # splits should look at least as similar as the observed one.
        both = np.vstack([X[ia], X[ib]])
        na = len(ia)
        r_le = 0
        rs_le = 0
        for _ in range(permutations):
            perm = rng.permutation(both.shape[0])
            Pa = np.cov(both[perm[:na]], rowvar=False)
            Pb = np.cov(both[perm[na:]], rowvar=False)
            if _matrix_correlation(Pa, Pb, False) <= r_nodiag:
                r_le += 1
            if _random_skewers(Pa, Pb, skewers) <= rs:
                rs_le += 1

        pairs.append({
            "group1": g1,
            "group2": g2,
            "n1": int(na),
            "n2": int(len(ib)),
            "r_with_diagonal": r_diag,
            "r_without_diagonal": r_nodiag,
            "random_skewers": rs,
            "p_matrix_correlation": (r_le + 1) / (permutations + 1),
            "p_random_skewers": (rs_le + 1) / (permutations + 1),
        })

    return {
        "pairs": pairs,
        "groups": unique,
        "permutations": permutations,
        "n_skewers": n_skewers,
        "n_variables": int(n_vars),
    }

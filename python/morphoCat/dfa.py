"""Pairwise discriminant function analysis with cross-validation.

For every pair of groups this reports how far apart the group means are
(Procrustes and Mahalanobis distance, each with a permutation test) and how
reliably a discriminant function separates the two groups when it is scored on
specimens it was not trained on (leave-one-out cross-validation).
"""
from __future__ import annotations
import numpy as np
from itertools import combinations
from typing import Any


def _pooled_covariance(Xa: np.ndarray, Xb: np.ndarray) -> np.ndarray:
    na, nb = Xa.shape[0], Xb.shape[0]
    df = (na - 1) + (nb - 1)
    if df <= 0:
        return np.zeros((Xa.shape[1], Xa.shape[1]))
    Sa = np.cov(Xa, rowvar=False) * (na - 1) if na > 1 else 0.0
    Sb = np.cov(Xb, rowvar=False) * (nb - 1) if nb > 1 else 0.0
    return (Sa + Sb) / df


def _mahalanobis(Xa: np.ndarray, Xb: np.ndarray) -> float:
    """Mahalanobis distance between two group means.

    Shape data usually has more variables than specimens, so the pooled
    covariance is singular and a pseudo-inverse is used.
    """
    diff = Xa.mean(axis=0) - Xb.mean(axis=0)
    S = _pooled_covariance(Xa, Xb)
    if not np.any(S):
        return 0.0
    d2 = float(diff @ np.linalg.pinv(S) @ diff)
    return float(np.sqrt(max(d2, 0.0)))


def _loo_accuracy(Xa: np.ndarray, Xb: np.ndarray) -> tuple[float, list[list[int]]]:
    """Leave-one-out classification rate and 2×2 confusion matrix."""
    from sklearn.discriminant_analysis import LinearDiscriminantAnalysis

    X = np.vstack([Xa, Xb])
    y = np.array([0] * Xa.shape[0] + [1] * Xb.shape[0])
    n = X.shape[0]
    if n < 4:
        return 0.0, [[0, 0], [0, 0]]

    cm = [[0, 0], [0, 0]]
    correct = 0
    for i in range(n):
        mask = np.ones(n, dtype=bool)
        mask[i] = False
        if len(np.unique(y[mask])) < 2:
            continue
        # Shrinkage keeps the fit stable when variables outnumber specimens.
        model = LinearDiscriminantAnalysis(solver="lsqr", shrinkage="auto")
        model.fit(X[mask], y[mask])
        pred = int(model.predict(X[i : i + 1])[0])
        cm[int(y[i])][pred] += 1
        if pred == y[i]:
            correct += 1
    return correct / n, cm


def run_pairwise_dfa(
    aligned: list,
    groups: list[str],
    permutations: int = 999,
    seed: int | None = None,
) -> dict[str, Any]:
    arr = np.array(aligned, dtype=float)
    X = arr.reshape(arr.shape[0], -1)
    y = np.array(groups)

    unique = sorted(set(groups))
    if len(unique) < 2:
        raise ValueError("Pairwise DFA needs at least two groups.")

    rng = np.random.default_rng(seed)
    pairs: list[dict[str, Any]] = []

    for g1, g2 in combinations(unique, 2):
        ia = np.flatnonzero(y == g1)
        ib = np.flatnonzero(y == g2)
        Xa, Xb = X[ia], X[ib]
        if len(ia) < 2 or len(ib) < 2:
            pairs.append({
                "group1": g1, "group2": g2,
                "n1": int(len(ia)), "n2": int(len(ib)),
                "procrustes_distance": float(np.linalg.norm(Xa.mean(0) - Xb.mean(0))),
                "mahalanobis_distance": 0.0,
                "p_procrustes": 1.0,
                "p_mahalanobis": 1.0,
                "loo_accuracy": 0.0,
                "loo_confusion_matrix": [[0, 0], [0, 0]],
                "warning": "Each group needs at least 2 specimens.",
            })
            continue

        proc_d = float(np.linalg.norm(Xa.mean(axis=0) - Xb.mean(axis=0)))
        mahal_d = _mahalanobis(Xa, Xb)

        # Permutation test: reshuffle the two groups' membership.
        both = np.vstack([Xa, Xb])
        na = len(ia)
        proc_ge = 0
        mahal_ge = 0
        for _ in range(permutations):
            perm = rng.permutation(both.shape[0])
            Pa, Pb = both[perm[:na]], both[perm[na:]]
            if float(np.linalg.norm(Pa.mean(axis=0) - Pb.mean(axis=0))) >= proc_d:
                proc_ge += 1
            if _mahalanobis(Pa, Pb) >= mahal_d:
                mahal_ge += 1

        loo_acc, loo_cm = _loo_accuracy(Xa, Xb)

        pairs.append({
            "group1": g1,
            "group2": g2,
            "n1": int(na),
            "n2": int(len(ib)),
            "procrustes_distance": proc_d,
            "mahalanobis_distance": mahal_d,
            "p_procrustes": (proc_ge + 1) / (permutations + 1),
            "p_mahalanobis": (mahal_ge + 1) / (permutations + 1),
            "loo_accuracy": loo_acc,
            "loo_confusion_matrix": loo_cm,
        })

    return {
        "pairs": pairs,
        "groups": unique,
        "permutations": permutations,
        "n_specimens": int(X.shape[0]),
    }

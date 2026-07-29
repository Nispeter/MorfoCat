"""Canonical Variate Analysis (CVA)."""
from __future__ import annotations
import numpy as np
from typing import Any


def run_cva(
    aligned: list,
    groups: list[str],
    permutations: int = 999,
) -> dict[str, Any]:
    arr = np.array(aligned, dtype=float)
    n_spec = arr.shape[0]
    X = arr.reshape(n_spec, -1)

    group_arr = np.array(groups)
    unique_groups, group_idx = np.unique(group_arr, return_inverse=True)
    n_groups = len(unique_groups)

    grand_mean = X.mean(axis=0)

    # Within-group (W) and between-group (B) scatter matrices
    W = np.zeros((X.shape[1], X.shape[1]))
    B = np.zeros((X.shape[1], X.shape[1]))

    for g in range(n_groups):
        mask = group_idx == g
        Xg = X[mask]
        ng = Xg.shape[0]
        gm = Xg.mean(axis=0)
        diff = gm - grand_mean
        B += ng * np.outer(diff, diff)
        Wg = np.cov(Xg, rowvar=False) * (ng - 1)
        W += Wg

    # Solve generalized eigenvalue problem: B v = λ W v
    try:
        W_inv = np.linalg.pinv(W)
        M = W_inv @ B
        eigenvalues, eigenvectors = np.linalg.eig(M)
    except np.linalg.LinAlgError:
        raise ValueError("CVA failed: singular within-group matrix.")

    # Sort real eigenvalues descending
    real_idx = np.isreal(eigenvalues)
    eigenvalues = eigenvalues[real_idx].real
    eigenvectors = eigenvectors[:, real_idx].real
    order = np.argsort(eigenvalues)[::-1]
    eigenvalues = eigenvalues[order]
    eigenvectors = eigenvectors[:, order]

    n_cvs = min(n_groups - 1, X.shape[1])
    eigenvalues = eigenvalues[:n_cvs]
    eigenvectors = eigenvectors[:, :n_cvs]

    cv_scores = (X @ eigenvectors).tolist()

    # Mahalanobis distances between group centroids
    group_centroids = []
    for g in range(n_groups):
        mask = group_idx == g
        group_centroids.append((X[mask] @ eigenvectors).mean(axis=0))

    mahal_distances: list[dict] = []
    for i in range(n_groups):
        for j in range(i + 1, n_groups):
            diff = group_centroids[i] - group_centroids[j]
            d = float(np.sqrt(np.sum(diff ** 2)))
            mahal_distances.append({
                "group1": str(unique_groups[i]),
                "group2": str(unique_groups[j]),
                "distance": d,
            })

    # Permutation test on first eigenvalue
    rng = np.random.default_rng(None)
    ev1_obs = float(eigenvalues[0]) if len(eigenvalues) > 0 else 0.0
    null_ev1 = np.zeros(permutations)
    for i in range(permutations):
        perm = rng.permutation(n_spec)
        g_perm = group_idx[perm]
        W_p = np.zeros_like(W)
        B_p = np.zeros_like(B)
        for g in range(n_groups):
            mask = g_perm == g
            Xg = X[mask]
            if Xg.shape[0] < 2:
                continue
            ng = Xg.shape[0]
            gm = Xg.mean(axis=0)
            B_p += ng * np.outer(gm - grand_mean, gm - grand_mean)
            W_p += np.cov(Xg, rowvar=False) * (ng - 1)
        M_p = np.linalg.pinv(W_p) @ B_p
        ev_p = np.linalg.eigvals(M_p)
        null_ev1[i] = float(np.sort(ev_p.real)[-1])

    p_value = float((null_ev1 >= ev1_obs).mean())

    pct_variance = (eigenvalues / eigenvalues.sum() * 100).tolist() if eigenvalues.sum() > 0 else []

    return {
        "cv_scores": cv_scores,
        "eigenvalues": eigenvalues.tolist(),
        "pct_variance": pct_variance,
        "loadings": eigenvectors.tolist(),
        "group_centroids": [c.tolist() for c in group_centroids],
        "groups": unique_groups.tolist(),
        "mahalanobis_distances": mahal_distances,
        "p_value": p_value,
        "permutations": permutations,
        "n_cvs": n_cvs,
    }

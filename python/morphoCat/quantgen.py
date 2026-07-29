"""Quantitative genetics of shape: G matrix and selection gradient."""
from __future__ import annotations
import numpy as np
from typing import Any


def run_g_matrix(
    aligned: list,
    sire_ids: list[str],
    dam_ids: list[str],
) -> dict[str, Any]:
    """
    Estimate the additive genetic variance-covariance matrix (G) using
    half-sib analysis (ANOVA method, Lynch & Walsh 1998).
    """
    arr = np.array(aligned, dtype=float)
    n_spec = arr.shape[0]
    X = arr.reshape(n_spec, -1)
    n_traits = X.shape[1]

    sires = np.array(sire_ids)
    unique_sires = np.unique(sires)
    n_sires = len(unique_sires)

    if n_sires < 2:
        return {"error": "At least 2 sires required for G matrix estimation."}

    # Between-sire (MS_S) and within-sire (MS_W) sums of squares
    sire_means = np.zeros((n_sires, n_traits))
    sire_n = np.zeros(n_sires, dtype=int)

    for i, s in enumerate(unique_sires):
        mask = sires == s
        sire_means[i] = X[mask].mean(axis=0)
        sire_n[i] = mask.sum()

    grand_mean = X.mean(axis=0)

    # MANOVA-style: compute between and within sire cross-product matrices
    CP_between = np.zeros((n_traits, n_traits))
    CP_within = np.zeros((n_traits, n_traits))
    df_between = n_sires - 1
    df_within = n_spec - n_sires

    for i, s in enumerate(unique_sires):
        mask = sires == s
        ng = sire_n[i]
        d = sire_means[i] - grand_mean
        CP_between += ng * np.outer(d, d)
        Xg = X[mask]
        for x in Xg:
            di = x - sire_means[i]
            CP_within += np.outer(di, di)

    MS_between = CP_between / df_between
    MS_within = CP_within / df_within

    n_bar = (n_spec - np.sum(sire_n ** 2) / n_spec) / (n_sires - 1)
    # G = (MS_between - MS_within) / (4 * n_bar)  [assuming full-sib half-sib design]
    # Half-sib design: sire component = VA/4, so G = 4 × (MS_sires - MS_within) / n_bar
    G = (MS_between - MS_within) / (4 * n_bar) if n_bar > 0 else np.zeros((n_traits, n_traits))

    # Eigendecomposition of G
    eigenvalues, eigenvectors = np.linalg.eigh(G)
    idx = np.argsort(eigenvalues)[::-1]

    return {
        "g_matrix": G.tolist(),
        "eigenvalues": eigenvalues[idx].tolist(),
        "eigenvectors": eigenvectors[:, idx].tolist(),
        "n_sires": n_sires,
        "n_specimens": n_spec,
    }


def run_selection_gradient(
    aligned: list,
    fitness: list[float],
) -> dict[str, Any]:
    """
    Estimate the directional selection gradient β = P^-1 * cov(w, z)
    where w = relative fitness, z = shape variables.
    """
    arr = np.array(aligned, dtype=float)
    n_spec = arr.shape[0]
    X = arr.reshape(n_spec, -1)
    w = np.array(fitness, dtype=float)
    w_rel = w / w.mean() if w.mean() != 0 else w  # relative fitness

    P = np.cov(X, rowvar=False)
    cov_wz = np.array([np.cov(X[:, j], w_rel)[0, 1] for j in range(X.shape[1])])

    try:
        beta = np.linalg.solve(P, cov_wz)
    except np.linalg.LinAlgError:
        beta = np.linalg.lstsq(P, cov_wz, rcond=None)[0]

    # Expected response to selection: R = G * beta (requires G, approximated by P here)
    response = (P @ beta).tolist()

    return {
        "selection_gradient": beta.tolist(),
        "response_to_selection": response,
        "n_specimens": n_spec,
        "mean_fitness": float(w.mean()),
    }

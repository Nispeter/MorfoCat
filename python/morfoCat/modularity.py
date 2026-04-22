"""Modularity hypothesis testing.

Implements:
- RV coefficient (Escoufier 1973) between landmark blocks
- Covariance ratio (CR) test (Adams 2016)
"""
from __future__ import annotations
import numpy as np
from typing import Any


def _rv(A: np.ndarray, B: np.ndarray) -> float:
    """RV coefficient between two data matrices."""
    Saa = A.T @ A
    Sbb = B.T @ B
    Sab = A.T @ B
    return float(np.trace(Sab @ Sab.T) / np.sqrt(np.trace(Saa @ Saa) * np.trace(Sbb @ Sbb)))


def _cr(blocks: list[np.ndarray]) -> float:
    """Covariance ratio: Adams (2016) CR statistic."""
    n_blocks = len(blocks)
    Slist = [b.T @ b for b in blocks]
    num = 0.0
    denom = 0.0
    for i in range(n_blocks):
        for j in range(i + 1, n_blocks):
            Sij = blocks[i].T @ blocks[j]
            num += np.trace(Sij @ Sij.T)
        denom += np.trace(Slist[i] @ Slist[i])
    return float(num / np.sqrt(denom)) if denom > 0 else 0.0


def test_modularity(
    aligned: list,
    hypothesis: list[list[int]],
    permutations: int = 999,
) -> dict[str, Any]:
    """
    Test a modularity hypothesis.

    Parameters
    ----------
    aligned : Procrustes-aligned coordinates (n_spec, n_lm, n_dim)
    hypothesis : list of landmark index groups defining modules, e.g. [[0,1,2],[3,4,5]]
    """
    arr = np.array(aligned, dtype=float)
    n_spec = arr.shape[0]
    X = arr.reshape(n_spec, -1)
    Xc = X - X.mean(axis=0)

    n_lm = arr.shape[1]
    n_dim = arr.shape[2]

    # Build blocks from an arbitrary hypothesis (landmark index groups)
    def make_blocks(configs_flat: np.ndarray, hyp: list) -> list[np.ndarray]:
        blocks = []
        for module_lms in hyp:
            col_idx = [lm * n_dim + d for lm in module_lms for d in range(n_dim)]
            blocks.append(configs_flat[:, col_idx])
        return blocks

    obs_blocks = make_blocks(Xc, hypothesis)
    obs_rv = _rv(obs_blocks[0], obs_blocks[1]) if len(obs_blocks) == 2 else float("nan")
    obs_cr = _cr(obs_blocks)

    # Permutation test: randomly reassign landmarks to modules (preserving sizes)
    rng = np.random.default_rng(None)
    null_rv = np.zeros(permutations)
    null_cr = np.zeros(permutations)
    module_sizes = [len(m) for m in hypothesis]

    for i in range(permutations):
        perm_lms = rng.permutation(n_lm)
        perm_hyp = []
        start = 0
        for sz in module_sizes:
            perm_hyp.append(perm_lms[start: start + sz].tolist())
            start += sz
        perm_blocks = make_blocks(Xc, perm_hyp)
        null_rv[i] = _rv(perm_blocks[0], perm_blocks[1]) if len(perm_blocks) == 2 else 0.0
        null_cr[i] = _cr(perm_blocks)

    p_rv = float((null_rv <= obs_rv).mean())
    p_cr = float((null_cr <= obs_cr).mean())

    return {
        "rv_coefficient": obs_rv,
        "cr_statistic": obs_cr,
        "p_value_rv": p_rv,
        "p_value_cr": p_cr,
        "permutations": permutations,
        "null_rv": null_rv.tolist(),
        "null_cr": null_cr.tolist(),
        "n_modules": len(hypothesis),
        "module_sizes": module_sizes,
    }

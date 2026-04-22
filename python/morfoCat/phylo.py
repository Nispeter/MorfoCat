"""Phylogenetic comparative methods.

- Mapping shape variables onto a phylogeny (ancestral state reconstruction)
- Phylogenetic independent contrasts (Felsenstein 1985)
"""
from __future__ import annotations
import numpy as np
from typing import Any


def _parse_newick_simple(newick: str) -> dict:
    """Minimal Newick parser returning {name: branch_length} for tips."""
    import re
    tips = {}
    for match in re.finditer(r"([A-Za-z0-9_]+):([0-9.eE+\-]+)", newick):
        tips[match.group(1)] = float(match.group(2))
    return tips


def run_phylo_mapping(
    aligned: list,
    tree_newick: str,
    ids: list[str],
) -> dict[str, Any]:
    """
    Map shape variables onto a phylogeny using squared-change parsimony
    (equal-weights ancestral reconstruction for continuous traits).
    Requires ete3 for full tree topology; falls back to tip data only.
    """
    arr = np.array(aligned, dtype=float)
    n_spec = arr.shape[0]
    X = arr.reshape(n_spec, -1)

    try:
        from ete3 import Tree
        t = Tree(tree_newick, format=1)
        tip_data: dict[str, np.ndarray] = {}
        for i, sp_id in enumerate(ids):
            tip_data[sp_id] = X[i]

        node_values: dict[str, list[float]] = {}

        def _ancestral(node: "Tree") -> np.ndarray:
            if node.is_leaf():
                val = tip_data.get(node.name, np.zeros(X.shape[1]))
                node_values[node.name] = val.tolist()
                return val
            child_vals = [_ancestral(c) for c in node.children]
            if child_vals:
                anc = np.mean(child_vals, axis=0)
            else:
                anc = np.zeros(X.shape[1])
            node_values[node.name or f"node_{id(node)}"] = anc.tolist()
            return anc

        _ancestral(t)

        return {
            "node_values": node_values,
            "tip_ids": ids,
            "method": "squared_change_parsimony",
        }

    except ImportError:
        # Without ete3, return tip values only
        return {
            "node_values": {ids[i]: X[i].tolist() for i in range(n_spec)},
            "tip_ids": ids,
            "method": "tips_only",
            "warning": "ete3 not installed; ancestral reconstruction unavailable.",
        }


def run_independent_contrasts(
    aligned: list,
    tree_newick: str,
    ids: list[str],
) -> dict[str, Any]:
    """Felsenstein's (1985) phylogenetic independent contrasts."""
    arr = np.array(aligned, dtype=float)
    n_spec = arr.shape[0]
    X = arr.reshape(n_spec, -1)

    try:
        from ete3 import Tree
        t = Tree(tree_newick, format=1)

        tip_map = {sp_id: X[i] for i, sp_id in enumerate(ids)}
        contrasts: list[dict] = []

        def _pic(node: "Tree") -> tuple[np.ndarray, float]:
            if node.is_leaf():
                return tip_map.get(node.name, np.zeros(X.shape[1])), 0.0
            child_results = [_pic(c) for c in node.children]
            if len(child_results) == 2:
                (v1, t1), (v2, t2) = child_results
                bl1 = node.children[0].dist or 1.0
                bl2 = node.children[1].dist or 1.0
                contrast = (v1 - v2) / np.sqrt(bl1 + bl2)
                contrasts.append({"contrast": contrast.tolist(), "variance": float(bl1 + bl2)})
                anc = (v1 * bl2 + v2 * bl1) / (bl1 + bl2)
                t_eff = (bl1 * bl2) / (bl1 + bl2)
                return anc, t_eff
            return child_results[0][0], child_results[0][1]

        _pic(t)

        return {
            "contrasts": contrasts,
            "n_contrasts": len(contrasts),
            "method": "felsenstein_pic",
        }

    except ImportError:
        return {
            "contrasts": [],
            "n_contrasts": 0,
            "method": "unavailable",
            "warning": "ete3 not installed.",
        }

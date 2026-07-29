"""Phylogenetic comparative methods.

- Mapping shape variables onto a phylogeny (ancestral state reconstruction)
- Phylogenetic independent contrasts (Felsenstein 1985)
- Multivariate phylogenetic signal, Kmult (Adams 2014)
"""
from __future__ import annotations
import numpy as np
from typing import Any


# ── Minimal Newick parsing ───────────────────────────────────────────────────
# Self-contained so the phylogenetic-signal test works without ete3 installed.

class _Node:
    __slots__ = ("name", "dist", "children")

    def __init__(self, name: str = "", dist: float = 0.0):
        self.name = name
        self.dist = dist
        self.children: list["_Node"] = []


def _parse_newick(text: str) -> _Node:
    """Parse a Newick string into a tree of _Node. Raises ValueError if malformed."""
    s = text.strip()
    if not s:
        raise ValueError("Empty Newick string.")
    s = s.rstrip(";")
    pos = 0

    def parse_node() -> _Node:
        nonlocal pos
        node = _Node()
        if pos < len(s) and s[pos] == "(":
            pos += 1
            while True:
                node.children.append(parse_node())
                if pos < len(s) and s[pos] == ",":
                    pos += 1
                    continue
                if pos < len(s) and s[pos] == ")":
                    pos += 1
                    break
                raise ValueError("Unbalanced parentheses in Newick string.")
        start = pos
        while pos < len(s) and s[pos] not in ",():":
            pos += 1
        node.name = s[start:pos].strip().strip("'\"")
        if pos < len(s) and s[pos] == ":":
            pos += 1
            start = pos
            while pos < len(s) and s[pos] not in ",()":
                pos += 1
            try:
                node.dist = float(s[start:pos])
            except ValueError:
                node.dist = 0.0
        return node

    root = parse_node()
    if pos < len(s):
        raise ValueError("Trailing characters in Newick string.")
    return root


def _phylo_covariance(root: _Node) -> tuple[np.ndarray, list[str]]:
    """
    Expected covariance under Brownian motion: C[i][j] is the shared path
    length from the root to the most recent common ancestor of tips i and j.
    """
    tips: list[str] = []

    def collect(node: _Node) -> None:
        if not node.children:
            tips.append(node.name)
        else:
            for c in node.children:
                collect(c)

    collect(root)
    n = len(tips)
    if n < 3:
        raise ValueError("Tree needs at least 3 tips.")
    index = {name: i for i, name in enumerate(tips)}
    C = np.zeros((n, n))

    def fill(node: _Node, depth: float) -> list[int]:
        """Fill C for this node's subtree; returns the tip indices below it."""
        if not node.children:
            i = index[node.name]
            C[i, i] = depth
            return [i]
        blocks = [fill(c, depth + c.dist) for c in node.children]
        # Any two tips in different child subtrees meet exactly at this node.
        for a in range(len(blocks)):
            for b in range(a + 1, len(blocks)):
                for i in blocks[a]:
                    for j in blocks[b]:
                        C[i, j] = C[j, i] = depth
        return [i for block in blocks for i in block]

    fill(root, root.dist)
    return C, tips


def run_phylogenetic_signal(
    aligned: list,
    tree_newick: str,
    ids: list[str],
    permutations: int = 999,
    seed: int | None = None,
) -> dict[str, Any]:
    """
    Multivariate phylogenetic signal Kmult (Adams 2014).

    K = 1 means shape varies exactly as Brownian motion on the tree predicts;
    K < 1 means less signal than expected, K > 1 means close relatives resemble
    each other more than Brownian motion predicts. The p-value comes from
    shuffling shapes across the tips.
    """
    arr = np.array(aligned, dtype=float)
    X = arr.reshape(arr.shape[0], -1)

    C, tips = _phylo_covariance(_parse_newick(tree_newick))

    missing = [t for t in tips if t not in ids]
    if missing:
        raise ValueError(
            f"{len(missing)} tip(s) have no matching specimen ID, e.g. {missing[0]!r}."
        )
    order = [ids.index(t) for t in tips]
    Y = X[order]
    n = len(tips)

    Cinv = np.linalg.pinv(C)
    ones = np.ones((n, 1))
    denom = float((ones.T @ Cinv @ ones).item())
    if denom == 0:
        raise ValueError("Degenerate tree covariance matrix.")

    def kmult(data: np.ndarray) -> float:
        # Phylogenetic mean, then sums of squares with and without the tree.
        a = (ones.T @ Cinv @ data) / denom
        D = data - ones @ a
        mse0 = float(np.trace(D.T @ D))
        mse = float(np.trace(D.T @ Cinv @ D))
        if mse <= 0:
            return 0.0
        expected = (float(np.trace(C)) - n / denom) / (n - 1)
        if expected <= 0:
            return 0.0
        return (mse0 / mse) / expected

    observed = kmult(Y)

    rng = np.random.default_rng(seed)
    null = np.empty(permutations)
    for i in range(permutations):
        null[i] = kmult(Y[rng.permutation(n)])
    p_value = float((np.sum(null >= observed) + 1) / (permutations + 1))

    return {
        "k_mult": observed,
        "p_value": p_value,
        "permutations": permutations,
        "null_distribution": null.tolist(),
        "n_tips": n,
        "tip_ids": tips,
        "method": "kmult_adams_2014",
    }


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

"""MorfoCat Python sidecar — reads one JSON request from stdin, writes one JSON response to stdout."""
import sys
import json
import traceback

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))

from morfoCat.io.tps import parse_tps, write_tps
from morfoCat.io.nts import parse_nts, write_nts
from morfoCat.io.morphologika import parse_morphologika, write_morphologika
from morfoCat.procrustes import procrustes_gpa
from morfoCat.outliers import detect_outliers
from morfoCat.covariance import compute_covariance
from morfoCat.pca import run_pca
from morfoCat.matrix_corr import matrix_correlation
from morfoCat.pls import two_block_pls
from morfoCat.regression import run_regression
from morfoCat.modularity import test_modularity
from morfoCat.cva import run_cva
from morfoCat.lda import run_lda
from morfoCat.phylo import run_phylo_mapping, run_independent_contrasts
from morfoCat.quantgen import run_g_matrix, run_selection_gradient

DISPATCH = {
    "parse_tps": lambda p: parse_tps(p["content"]),
    "write_tps": lambda p: write_tps(p["landmarks"], p.get("ids"), p.get("scale")),
    "parse_nts": lambda p: parse_nts(p["content"]),
    "write_nts": lambda p: write_nts(p["landmarks"], p.get("ids")),
    "parse_morphologika": lambda p: parse_morphologika(p["content"]),
    "write_morphologika": lambda p: write_morphologika(p["landmarks"], p.get("ids")),
    "procrustes_gpa": lambda p: procrustes_gpa(
        p["landmarks"], p.get("symmetry", False),
        p.get("sym_pairs"), p.get("midline_lms")
    ),
    "detect_outliers": lambda p: detect_outliers(p["aligned"]),
    "compute_covariance": lambda p: compute_covariance(
        p["aligned"], p.get("groups"), p.get("pooled", False)
    ),
    "run_pca": lambda p: run_pca(p["aligned"], p.get("cov_matrix")),
    "matrix_correlation": lambda p: matrix_correlation(
        p["matrix_a"], p["matrix_b"], p.get("permutations", 999)
    ),
    "two_block_pls": lambda p: two_block_pls(
        p["block1"], p["block2"], p.get("permutations", 999)
    ),
    "run_regression": lambda p: run_regression(
        p["dependent"], p["independent"],
        p.get("groups"), p.get("pooled", False)
    ),
    "test_modularity": lambda p: test_modularity(
        p["aligned"], p["hypothesis"], p.get("permutations", 999)
    ),
    "run_cva": lambda p: run_cva(
        p["aligned"], p["groups"], p.get("permutations", 999)
    ),
    "run_lda": lambda p: run_lda(p["aligned"], p["groups"]),
    "run_phylo_mapping": lambda p: run_phylo_mapping(
        p["aligned"], p["tree_newick"], p["ids"]
    ),
    "run_independent_contrasts": lambda p: run_independent_contrasts(
        p["aligned"], p["tree_newick"], p["ids"]
    ),
    "run_g_matrix": lambda p: run_g_matrix(
        p["aligned"], p["sire_ids"], p["dam_ids"]
    ),
    "run_selection_gradient": lambda p: run_selection_gradient(
        p["aligned"], p["fitness"]
    ),
}


def main() -> None:
    raw = sys.stdin.buffer.read()
    try:
        request = json.loads(raw)
        method = request["method"]
        params = request.get("params", {})
        if method not in DISPATCH:
            raise ValueError(f"Unknown method: {method}")
        result = DISPATCH[method](params)
        sys.stdout.write(json.dumps({"result": result}))
    except Exception as exc:
        sys.stdout.write(json.dumps({
            "error": str(exc),
            "traceback": traceback.format_exc(),
        }))
    sys.stdout.flush()


if __name__ == "__main__":
    main()

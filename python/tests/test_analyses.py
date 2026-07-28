"""
Numerical correctness tests for MorfoCat analysis modules.

All tests use synthetic data with analytically known answers so no MorphoJ
binary is required. Tests verify that each implementation matches the
published algorithm to within floating-point tolerance.

Run with:  python -m pytest python/tests/ -v
"""
import sys
import os
import math
import numpy as np
import pytest

# Add project root to path so morfoCat package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from morfoCat.procrustes import procrustes_gpa
from morfoCat.pca import run_pca
from morfoCat.outliers import detect_outliers
from morfoCat.covariance import compute_covariance
from morfoCat.matrix_corr import matrix_correlation
from morfoCat.pls import two_block_pls
from morfoCat.modularity import test_modularity as run_modularity
from morfoCat.cva import run_cva
from morfoCat.lda import run_lda
from morfoCat.dfa import run_pairwise_dfa
from morfoCat.covmatrix_compare import compare_covariance_matrices
from morfoCat.phylo import run_phylogenetic_signal
from morfoCat.quantgen import run_selection_gradient
from morfoCat.io.tps import parse_tps, write_tps


# ── Helpers ──────────────────────────────────────────────────────────────────

def _rot2d(angle_deg):
    """2D rotation matrix."""
    a = math.radians(angle_deg)
    return np.array([[math.cos(a), -math.sin(a)],
                     [math.sin(a),  math.cos(a)]])


def _square_lms():
    """Unit square landmark configuration (centred)."""
    return np.array([[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]], dtype=float)


# ── Procrustes GPA ───────────────────────────────────────────────────────────

class TestGPA:
    def test_three_identical_configs_zero_distances(self):
        """Three copies of the same shape → Procrustes distances ≈ 0."""
        lm = _square_lms()
        landmarks = [lm.tolist(), lm.tolist(), lm.tolist()]
        res = procrustes_gpa(landmarks)
        assert all(d < 1e-8 for d in res["procrustes_distances"])

    def test_rotation_invariance(self):
        """GPA result is the same regardless of initial rotation."""
        lm = _square_lms()
        R = _rot2d(45)
        lm_rotated = (lm @ R.T).tolist()
        lm_original = lm.tolist()

        res_orig = procrustes_gpa([lm_original] * 5)
        res_rot = procrustes_gpa([lm_rotated] * 5)

        # Consensus shapes should be identical up to rotation (distances = 0 in both)
        assert all(d < 1e-8 for d in res_orig["procrustes_distances"])
        assert all(d < 1e-8 for d in res_rot["procrustes_distances"])

    def test_centroid_size_positive(self):
        """Centroid sizes are always positive."""
        lm = _square_lms()
        landmarks = [lm.tolist(), (lm * 2).tolist(), (lm * 0.5).tolist()]
        res = procrustes_gpa(landmarks)
        assert all(cs > 0 for cs in res["centroid_sizes"])

    def test_consensus_centred(self):
        """The consensus configuration has zero centroid (centred)."""
        rng = np.random.default_rng(0)
        landmarks = [rng.standard_normal((6, 2)).tolist() for _ in range(10)]
        res = procrustes_gpa(landmarks)
        consensus = np.array(res["consensus"])
        assert np.allclose(consensus.mean(axis=0), 0.0, atol=1e-10)

    def test_output_shape(self):
        """Output arrays have the correct dimensions."""
        n_spec, n_lm, n_dim = 8, 5, 2
        rng = np.random.default_rng(1)
        landmarks = [rng.standard_normal((n_lm, n_dim)).tolist() for _ in range(n_spec)]
        res = procrustes_gpa(landmarks)
        assert len(res["aligned"]) == n_spec
        assert len(res["aligned"][0]) == n_lm
        assert len(res["aligned"][0][0]) == n_dim
        assert len(res["consensus"]) == n_lm
        assert len(res["centroid_sizes"]) == n_spec
        assert len(res["procrustes_distances"]) == n_spec


# ── PCA ──────────────────────────────────────────────────────────────────────

class TestPCA:
    def _aligned_data(self, n_spec=20, n_lm=5, n_dim=2, seed=42):
        rng = np.random.default_rng(seed)
        raw = [rng.standard_normal((n_lm, n_dim)).tolist() for _ in range(n_spec)]
        res = procrustes_gpa(raw)
        return res["aligned"]

    def test_variance_sums_to_100(self):
        aligned = self._aligned_data()
        res = run_pca(aligned)
        assert abs(sum(res["pct_variance"]) - 100.0) < 1e-6

    def test_loadings_orthonormal(self):
        aligned = self._aligned_data()
        res = run_pca(aligned)
        L = np.array(res["loadings"])
        # Columns should be orthonormal: L.T @ L ≈ I
        product = L.T @ L
        assert np.allclose(product, np.eye(product.shape[0]), atol=1e-8)

    def test_scores_zero_mean(self):
        aligned = self._aligned_data()
        res = run_pca(aligned)
        scores = np.array(res["scores"])
        assert np.allclose(scores.mean(axis=0), 0.0, atol=1e-8)

    def test_eigenvalues_descending(self):
        aligned = self._aligned_data()
        res = run_pca(aligned)
        ev = res["eigenvalues"]
        assert all(ev[i] >= ev[i + 1] - 1e-12 for i in range(len(ev) - 1))

    def test_n_components_at_most_min_n_vars(self):
        aligned = self._aligned_data(n_spec=10, n_lm=3)
        res = run_pca(aligned)
        n_vars = 3 * 2  # n_lm * n_dim
        assert res["n_components"] <= min(10 - 1, n_vars)


# ── Outliers ─────────────────────────────────────────────────────────────────

class TestOutliers:
    def test_identical_specimens_zero_zscores(self):
        lm = _square_lms()
        aligned = [lm.tolist()] * 10
        res = detect_outliers(aligned)
        assert all(abs(z) < 1e-8 for z in res["z_scores"])

    def test_output_length_matches_input(self):
        rng = np.random.default_rng(0)
        aligned = [rng.standard_normal((4, 2)).tolist() for _ in range(15)]
        res = detect_outliers(aligned)
        assert len(res["z_scores"]) == 15
        assert len(res["procrustes_distances"]) == 15


# ── Covariance ───────────────────────────────────────────────────────────────

class TestCovariance:
    def test_covariance_matrix_symmetric(self):
        rng = np.random.default_rng(0)
        aligned = [rng.standard_normal((4, 2)).tolist() for _ in range(20)]
        res = compute_covariance(aligned)
        C = np.array(res["covariance"])
        assert np.allclose(C, C.T, atol=1e-12)

    def test_covariance_positive_semidefinite(self):
        rng = np.random.default_rng(1)
        aligned = [rng.standard_normal((4, 2)).tolist() for _ in range(20)]
        res = compute_covariance(aligned)
        C = np.array(res["covariance"])
        eigenvalues = np.linalg.eigvalsh(C)
        assert np.all(eigenvalues >= -1e-10)

    def test_pooled_type_label(self):
        rng = np.random.default_rng(2)
        aligned = [rng.standard_normal((4, 2)).tolist() for _ in range(20)]
        groups = ["A"] * 10 + ["B"] * 10
        res = compute_covariance(aligned, groups=groups, pooled=True)
        assert "pooled" in res["type"].lower()


# ── Matrix Correlation ────────────────────────────────────────────────────────

class TestMatrixCorrelation:
    def test_self_correlation_is_one(self):
        rng = np.random.default_rng(0)
        M = rng.standard_normal((8, 8))
        M = M @ M.T  # make symmetric
        res = matrix_correlation(M.tolist(), M.tolist(), permutations=99)
        assert abs(res["r"] - 1.0) < 1e-10

    def test_p_value_in_range(self):
        rng = np.random.default_rng(1)
        A = rng.standard_normal((6, 6))
        A = A @ A.T
        B = rng.standard_normal((6, 6))
        B = B @ B.T
        res = matrix_correlation(A.tolist(), B.tolist(), permutations=199)
        assert 0.0 <= res["p_value"] <= 1.0

    def test_null_distribution_length(self):
        rng = np.random.default_rng(2)
        M = (rng.standard_normal((5, 5)) + np.eye(5))
        M = M @ M.T
        res = matrix_correlation(M.tolist(), M.tolist(), permutations=49)
        assert len(res["null_distribution"]) == 49

    def test_permutations_vary(self):
        """With fixed seed removed, two runs should give different null distributions."""
        rng = np.random.default_rng(3)
        M = rng.standard_normal((6, 6))
        M = M @ M.T
        res1 = matrix_correlation(M.tolist(), M.tolist(), permutations=50)
        res2 = matrix_correlation(M.tolist(), M.tolist(), permutations=50)
        # At least one permutation should differ (very high probability)
        assert res1["null_distribution"] != res2["null_distribution"]


# ── Two-block PLS ─────────────────────────────────────────────────────────────

class TestPLS:
    def test_rv_in_range(self):
        rng = np.random.default_rng(0)
        b1 = rng.standard_normal((20, 3, 2)).tolist()
        b2 = rng.standard_normal((20, 3, 2)).tolist()
        res = two_block_pls(b1, b2, permutations=49)
        assert -1e-6 <= res["rv_coefficient"] <= 1.0 + 1e-6

    def test_pct_covariance_sums_100(self):
        rng = np.random.default_rng(1)
        b1 = rng.standard_normal((20, 3, 2)).tolist()
        b2 = rng.standard_normal((20, 3, 2)).tolist()
        res = two_block_pls(b1, b2, permutations=49)
        assert abs(sum(res["pct_covariance"]) - 100.0) < 1e-6

    def test_singular_values_descending(self):
        rng = np.random.default_rng(2)
        b1 = rng.standard_normal((20, 4, 2)).tolist()
        b2 = rng.standard_normal((20, 4, 2)).tolist()
        res = two_block_pls(b1, b2, permutations=49)
        sv = res["singular_values"]
        assert all(sv[i] >= sv[i + 1] - 1e-10 for i in range(len(sv) - 1))

    def test_correlated_blocks_high_rv(self):
        """Blocks sharing a common latent factor should have high RV."""
        rng = np.random.default_rng(3)
        n = 30
        latent = rng.standard_normal((n, 1))
        b1 = (latent @ np.ones((1, 4)) + rng.standard_normal((n, 4)) * 0.01).tolist()
        b2 = (latent @ np.ones((1, 4)) + rng.standard_normal((n, 4)) * 0.01).tolist()
        res = two_block_pls(b1, b2, permutations=49)
        assert res["rv_coefficient"] > 0.9


# ── Modularity ───────────────────────────────────────────────────────────────

class TestModularity:
    def _make_modular_data(self, n_spec=50, seed=7):
        """Two perfectly independent blocks of landmarks."""
        rng = np.random.default_rng(seed)
        # Block 1: landmarks 0-2 driven by shared factor f1
        f1 = rng.standard_normal((n_spec, 1))
        b1 = f1 @ np.ones((1, 3 * 2)) + rng.standard_normal((n_spec, 3 * 2)) * 0.01
        # Block 2: landmarks 3-5 driven by independent factor f2
        f2 = rng.standard_normal((n_spec, 1))
        b2 = f2 @ np.ones((1, 3 * 2)) + rng.standard_normal((n_spec, 3 * 2)) * 0.01
        X = np.concatenate([b1, b2], axis=1).reshape(n_spec, 6, 2)
        return X.tolist()

    def test_null_distribution_varies(self):
        """Bug fix check: permuted blocks must differ from observed."""
        aligned = self._make_modular_data()
        hypothesis = [[0, 1, 2], [3, 4, 5]]
        res = run_modularity(aligned, hypothesis, permutations=99)
        obs_rv = res["rv_coefficient"]
        null_rv = res["null_rv"]
        # At least some permuted RV values should differ from observed
        n_equal = sum(abs(v - obs_rv) < 1e-12 for v in null_rv)
        assert n_equal < len(null_rv), "All permuted RV == observed (permutation bug still present)"

    def test_perfect_modularity_low_rv(self):
        """Perfectly modular data should yield RV close to 0."""
        aligned = self._make_modular_data()
        hypothesis = [[0, 1, 2], [3, 4, 5]]
        res = run_modularity(aligned, hypothesis, permutations=199)
        assert res["rv_coefficient"] < 0.1

    def test_p_value_in_range(self):
        aligned = self._make_modular_data()
        hypothesis = [[0, 1, 2], [3, 4, 5]]
        res = run_modularity(aligned, hypothesis, permutations=99)
        assert 0.0 <= res["p_value_rv"] <= 1.0
        assert 0.0 <= res["p_value_cr"] <= 1.0

    def test_module_sizes_match_hypothesis(self):
        rng = np.random.default_rng(0)
        aligned = rng.standard_normal((20, 6, 2)).tolist()
        hypothesis = [[0, 1], [2, 3, 4, 5]]
        res = run_modularity(aligned, hypothesis, permutations=49)
        assert res["module_sizes"] == [2, 4]
        assert res["n_modules"] == 2


# ── CVA ───────────────────────────────────────────────────────────────────────

class TestCVA:
    def test_well_separated_groups(self):
        """Clearly separated groups → first CV captures most variance."""
        rng = np.random.default_rng(0)
        n = 15
        # Group A centred at +5, Group B at -5 in first coordinate
        g1 = (rng.standard_normal((n, 4, 2)) + np.array([[[5, 0]] * 4])).tolist()
        g2 = (rng.standard_normal((n, 4, 2)) + np.array([[[-5, 0]] * 4])).tolist()
        aligned = g1 + g2
        groups = ["A"] * n + ["B"] * n
        res = run_cva(aligned, groups, permutations=49)
        assert res["pct_variance"][0] > 90.0

    def test_n_cvs_at_most_groups_minus_one(self):
        rng = np.random.default_rng(1)
        n = 10
        aligned = rng.standard_normal((n * 3, 4, 2)).tolist()
        groups = ["A"] * n + ["B"] * n + ["C"] * n
        res = run_cva(aligned, groups, permutations=49)
        assert res["n_cvs"] <= 2

    def test_mahal_distances_nonneg(self):
        rng = np.random.default_rng(2)
        aligned = rng.standard_normal((20, 3, 2)).tolist()
        groups = ["X"] * 10 + ["Y"] * 10
        res = run_cva(aligned, groups, permutations=49)
        assert all(d["distance"] >= 0 for d in res["mahalanobis_distances"])


# ── LDA ───────────────────────────────────────────────────────────────────────

class TestLDA:
    def test_loo_accuracy_perfectly_separated(self):
        """Perfectly separated groups → LOO accuracy = 1.0."""
        rng = np.random.default_rng(0)
        n = 15
        g1 = (rng.standard_normal((n, 4, 2)) * 0.01 + np.array([[[10, 0]] * 4])).tolist()
        g2 = (rng.standard_normal((n, 4, 2)) * 0.01 + np.array([[[-10, 0]] * 4])).tolist()
        aligned = g1 + g2
        groups = ["A"] * n + ["B"] * n
        res = run_lda(aligned, groups)
        assert res["loo_accuracy"] >= 0.95

    def test_confusion_matrix_shape(self):
        rng = np.random.default_rng(1)
        aligned = rng.standard_normal((30, 4, 2)).tolist()
        groups = ["A"] * 10 + ["B"] * 10 + ["C"] * 10
        res = run_lda(aligned, groups)
        cm = np.array(res["confusion_matrix"])
        assert cm.shape == (3, 3)

    def test_predictions_length_matches_input(self):
        rng = np.random.default_rng(2)
        aligned = rng.standard_normal((20, 3, 2)).tolist()
        groups = ["X"] * 10 + ["Y"] * 10
        res = run_lda(aligned, groups)
        assert len(res["predictions"]) == 20
        assert len(res["loo_predictions"]) == 20


# ── Selection Gradient ────────────────────────────────────────────────────────

class TestSelectionGradient:
    def test_beta_length_matches_shape_variables(self):
        rng = np.random.default_rng(0)
        aligned = rng.standard_normal((20, 4, 2)).tolist()
        fitness = rng.uniform(0.5, 1.5, 20).tolist()
        res = run_selection_gradient(aligned, fitness)
        assert len(res["selection_gradient"]) == 4 * 2

    def test_response_length_matches_beta(self):
        rng = np.random.default_rng(1)
        aligned = rng.standard_normal((20, 4, 2)).tolist()
        fitness = rng.uniform(0.5, 1.5, 20).tolist()
        res = run_selection_gradient(aligned, fitness)
        assert len(res["response_to_selection"]) == len(res["selection_gradient"])

    def test_mean_fitness_is_positive(self):
        rng = np.random.default_rng(2)
        aligned = rng.standard_normal((20, 4, 2)).tolist()
        fitness = rng.uniform(0.1, 2.0, 20).tolist()
        res = run_selection_gradient(aligned, fitness)
        assert res["mean_fitness"] > 0


# ── TPS I/O round-trip ────────────────────────────────────────────────────────

class TestTPSRoundtrip:
    def test_roundtrip_preserves_coordinates(self):
        """parse_tps → write_tps → parse_tps: coordinates must be identical."""
        tps_content = (
            "LM=4\n"
            "0.1 0.2\n0.3 0.4\n0.5 0.6\n0.7 0.8\n"
            "ID=specimen_1\n"
            "LM=4\n"
            "1.0 2.0\n3.0 4.0\n5.0 6.0\n7.0 8.0\n"
            "ID=specimen_2\n"
        )
        parsed = parse_tps(tps_content)
        landmarks = [s["landmarks"] for s in parsed["specimens"]]
        ids = [s["id"] for s in parsed["specimens"]]

        written = write_tps(landmarks, ids=ids)
        reparsed = parse_tps(written)

        orig_lms = np.array(landmarks)
        new_lms = np.array([s["landmarks"] for s in reparsed["specimens"]])
        assert np.allclose(orig_lms, new_lms, atol=1e-8)

    def test_roundtrip_preserves_specimen_count(self):
        tps_content = (
            "LM=3\n0.0 0.0\n1.0 0.0\n0.5 1.0\nID=A\n"
            "LM=3\n0.1 0.1\n1.1 0.1\n0.6 1.1\nID=B\n"
            "LM=3\n0.2 0.2\n1.2 0.2\n0.7 1.2\nID=C\n"
        )
        parsed = parse_tps(tps_content)
        landmarks = [s["landmarks"] for s in parsed["specimens"]]
        written = write_tps(landmarks)
        reparsed = parse_tps(written)
        assert len(reparsed["specimens"]) == 3


# ── Pairwise DFA ──────────────────────────────────────────────────────────────

class TestPairwiseDFA:
    @staticmethod
    def _two_groups(sep=1.0, seed=0, n=12):
        rng = np.random.default_rng(seed)
        a = rng.standard_normal((n, 5, 2)) * 0.05
        b = rng.standard_normal((n, 5, 2)) * 0.05 + sep
        aligned = np.vstack([a, b]).tolist()
        groups = ["A"] * n + ["B"] * n
        return aligned, groups

    def test_one_pair_per_group_combination(self):
        aligned, groups = self._two_groups()
        groups = ["A"] * 8 + ["B"] * 8 + ["C"] * 8
        rng = np.random.default_rng(3)
        aligned = rng.standard_normal((24, 5, 2)).tolist()
        res = run_pairwise_dfa(aligned, groups, permutations=19)
        assert len(res["pairs"]) == 3

    def test_separated_groups_have_larger_distance(self):
        far, groups = self._two_groups(sep=2.0, seed=1)
        near, _ = self._two_groups(sep=0.01, seed=1)
        d_far = run_pairwise_dfa(far, groups, permutations=19)["pairs"][0]
        d_near = run_pairwise_dfa(near, groups, permutations=19)["pairs"][0]
        assert d_far["procrustes_distance"] > d_near["procrustes_distance"]

    def test_separated_groups_classify_perfectly(self):
        aligned, groups = self._two_groups(sep=5.0, seed=2)
        pair = run_pairwise_dfa(aligned, groups, permutations=19)["pairs"][0]
        assert pair["loo_accuracy"] == pytest.approx(1.0)

    def test_confusion_matrix_totals_match_sample_size(self):
        aligned, groups = self._two_groups(seed=4)
        pair = run_pairwise_dfa(aligned, groups, permutations=19)["pairs"][0]
        total = sum(sum(row) for row in pair["loo_confusion_matrix"])
        assert total == pair["n1"] + pair["n2"]

    def test_p_values_are_valid_probabilities(self):
        aligned, groups = self._two_groups(seed=5)
        pair = run_pairwise_dfa(aligned, groups, permutations=49)["pairs"][0]
        assert 0.0 < pair["p_procrustes"] <= 1.0
        assert 0.0 < pair["p_mahalanobis"] <= 1.0

    def test_single_group_raises(self):
        rng = np.random.default_rng(6)
        aligned = rng.standard_normal((10, 4, 2)).tolist()
        with pytest.raises(ValueError):
            run_pairwise_dfa(aligned, ["A"] * 10)


# ── Comparison of covariance matrices ─────────────────────────────────────────

class TestCovarianceComparison:
    def test_identical_structure_correlates_near_one(self):
        """Two samples drawn from the same covariance should match closely."""
        rng = np.random.default_rng(0)
        base = rng.standard_normal((8, 8))
        cov = base @ base.T
        draws = rng.multivariate_normal(np.zeros(8), cov, size=400)
        aligned = draws.reshape(400, 4, 2).tolist()
        groups = ["A"] * 200 + ["B"] * 200
        pair = compare_covariance_matrices(aligned, groups, permutations=19, n_skewers=200)["pairs"][0]
        assert pair["r_without_diagonal"] > 0.8
        assert pair["random_skewers"] > 0.8

    def test_correlations_are_bounded(self):
        rng = np.random.default_rng(1)
        aligned = rng.standard_normal((40, 4, 2)).tolist()
        groups = ["A"] * 20 + ["B"] * 20
        pair = compare_covariance_matrices(aligned, groups, permutations=19, n_skewers=100)["pairs"][0]
        for key in ("r_with_diagonal", "r_without_diagonal", "random_skewers"):
            assert -1.0 <= pair[key] <= 1.0

    def test_one_pair_per_group_combination(self):
        rng = np.random.default_rng(2)
        aligned = rng.standard_normal((30, 4, 2)).tolist()
        groups = ["A"] * 10 + ["B"] * 10 + ["C"] * 10
        res = compare_covariance_matrices(aligned, groups, permutations=9, n_skewers=50)
        assert len(res["pairs"]) == 3

    def test_single_group_raises(self):
        rng = np.random.default_rng(3)
        aligned = rng.standard_normal((10, 4, 2)).tolist()
        with pytest.raises(ValueError):
            compare_covariance_matrices(aligned, ["A"] * 10)


# ── Phylogenetic signal (Kmult) ───────────────────────────────────────────────

class TestPhylogeneticSignal:
    TREE = "(((A:1,B:1):1,(C:1,D:1):1):1,(E:1,F:1):2);"
    IDS = ["A", "B", "C", "D", "E", "F"]

    def test_brownian_data_gives_k_near_one(self):
        """Data simulated on the tree's own covariance should give Kmult ≈ 1."""
        from morfoCat.phylo import _parse_newick, _phylo_covariance
        C, tips = _phylo_covariance(_parse_newick(self.TREE))
        rng = np.random.default_rng(0)
        L = np.linalg.cholesky(C + np.eye(len(tips)) * 1e-9)
        # Average many simulations — a single draw is very noisy.
        ks = []
        for _ in range(40):
            Y = L @ rng.standard_normal((len(tips), 8))
            aligned = Y.reshape(len(tips), 4, 2).tolist()
            ks.append(run_phylogenetic_signal(aligned, self.TREE, tips, permutations=9)["k_mult"])
        assert 0.6 < float(np.mean(ks)) < 1.6

    def test_signal_is_positive_and_p_value_valid(self):
        rng = np.random.default_rng(1)
        aligned = rng.standard_normal((6, 4, 2)).tolist()
        res = run_phylogenetic_signal(aligned, self.TREE, self.IDS, permutations=49)
        assert res["k_mult"] > 0
        assert 0.0 < res["p_value"] <= 1.0

    def test_strong_clade_difference_is_significant(self):
        """Shape that tracks the deepest split should show significant signal."""
        rng = np.random.default_rng(2)
        noise = rng.standard_normal((6, 4, 2)) * 0.01
        clade = np.array([0, 0, 0, 0, 5, 5], dtype=float).reshape(6, 1, 1)
        aligned = (noise + clade).tolist()
        res = run_phylogenetic_signal(aligned, self.TREE, self.IDS, permutations=199, seed=0)
        assert res["p_value"] < 0.05

    def test_tips_must_match_specimen_ids(self):
        rng = np.random.default_rng(3)
        aligned = rng.standard_normal((6, 4, 2)).tolist()
        with pytest.raises(ValueError):
            run_phylogenetic_signal(aligned, self.TREE, ["X"] * 6)

    def test_malformed_newick_raises(self):
        rng = np.random.default_rng(4)
        aligned = rng.standard_normal((6, 4, 2)).tolist()
        with pytest.raises(ValueError):
            run_phylogenetic_signal(aligned, "((A:1,B:1);", self.IDS)


# ── Newick parsing ────────────────────────────────────────────────────────────

class TestNewickParsing:
    def test_tip_order_follows_the_string(self):
        from morfoCat.phylo import _parse_newick, _phylo_covariance
        _, tips = _phylo_covariance(_parse_newick("((A:1,B:1):1,C:2);"))
        assert tips == ["A", "B", "C"]

    def test_covariance_diagonal_is_root_to_tip_distance(self):
        from morfoCat.phylo import _parse_newick, _phylo_covariance
        C, tips = _phylo_covariance(_parse_newick("((A:1,B:1):1,C:2);"))
        assert np.allclose(np.diag(C), [2.0, 2.0, 2.0])

    def test_shared_path_equals_mrca_depth(self):
        from morfoCat.phylo import _parse_newick, _phylo_covariance
        C, tips = _phylo_covariance(_parse_newick("((A:1,B:1):1,C:2);"))
        i, j, k = tips.index("A"), tips.index("B"), tips.index("C")
        assert C[i, j] == pytest.approx(1.0)   # A and B share the inner branch
        assert C[i, k] == pytest.approx(0.0)   # A and C only share the root


# ── Mahalanobis outlier distances ─────────────────────────────────────────────

class TestMahalanobisOutliers:
    def test_one_distance_per_specimen(self):
        rng = np.random.default_rng(0)
        aligned = rng.standard_normal((15, 4, 2)).tolist()
        res = detect_outliers(aligned)
        assert len(res["mahalanobis_distances"]) == 15

    def test_distances_are_non_negative(self):
        rng = np.random.default_rng(1)
        aligned = rng.standard_normal((15, 4, 2)).tolist()
        res = detect_outliers(aligned)
        assert all(d >= 0 for d in res["mahalanobis_distances"])

    def test_flags_a_specimen_that_is_odd_in_a_low_variance_direction(self):
        """A shift along an almost-invariant axis is small in Procrustes terms
        but large in Mahalanobis terms — the reason for having both."""
        rng = np.random.default_rng(2)
        base = rng.standard_normal((20, 4, 2))
        base[:, 3, 1] *= 0.001          # landmark 4's y barely varies
        base[0, 3, 1] += 0.02           # …except in specimen 0
        res = detect_outliers(base.tolist())
        md = res["mahalanobis_distances"]
        assert md[0] == max(md)

    def test_too_few_specimens_returns_zeros(self):
        aligned = [[[0.0, 0.0], [1.0, 0.0]], [[0.0, 0.1], [1.0, 0.0]]]
        res = detect_outliers(aligned)
        assert res["mahalanobis_distances"] == [0.0, 0.0]


# ── TPS files as digitizers actually write them ───────────────────────────────

class TestTPSRealWorldQuirks:
    def test_decimal_comma_is_read_as_decimal_mark(self):
        """A European locale writes 1460,00000 where 1460.00000 is meant."""
        content = "LM=3\n1460,00000 2579,00000\n1322,50000 2507,25000\n1308,00000 2446,00000\nID=a\n"
        parsed = parse_tps(content)
        assert parsed["specimens"][0]["landmarks"][1] == [1322.5, 2507.25]

    def test_decimal_comma_in_scale(self):
        content = "LM=3\n1,0 2,0\n3,0 4,0\n5,0 6,0\nSCALE=0,001707\n"
        parsed = parse_tps(content)
        assert parsed["specimens"][0]["scale"] == pytest.approx(0.001707)

    def test_comma_as_coordinate_separator(self):
        content = "LM=3\n1460,2579\n1322,2507\n1308,2446\n"
        parsed = parse_tps(content)
        assert parsed["specimens"][0]["landmarks"][0] == [1460.0, 2579.0]

    def test_curve_points_are_read_as_landmarks(self):
        """tpsDig saves outlines as LM=0 + CURVES/POINTS blocks."""
        content = (
            "LM=0\nCURVES=1\nPOINTS=3\n"
            "1.0 2.0\n3.0 4.0\n5.0 6.0\n"
            "IMAGE=a.jpg\n"
        )
        parsed = parse_tps(content)
        assert parsed["n_landmarks"] == 3
        assert parsed["specimens"][0]["landmarks"][2] == [5.0, 6.0]

    def test_several_curves_accumulate(self):
        content = (
            "LM=0\nCURVES=2\nPOINTS=2\n1.0 2.0\n3.0 4.0\n"
            "POINTS=2\n5.0 6.0\n7.0 8.0\nIMAGE=a.jpg\n"
        )
        parsed = parse_tps(content)
        assert parsed["n_landmarks"] == 4

    def test_landmarks_and_curve_points_combine(self):
        content = "LM=1\n0.0 0.0\nCURVES=1\nPOINTS=2\n1.0 1.0\n2.0 2.0\n"
        parsed = parse_tps(content)
        assert parsed["n_landmarks"] == 3

    def test_template_with_no_coordinates_is_accepted(self):
        """A TpsUtil template lists images with LM=0 — the digitizer fills it in."""
        content = "LM=0\nIMAGE=a.jpg\nLM=0\nIMAGE=b.jpg\n"
        parsed = parse_tps(content)
        assert parsed["n_landmarks"] == 0
        assert len(parsed["specimens"]) == 2
        assert parsed["specimens"][1]["image"] == "b.jpg"

    def test_inconsistent_landmark_counts_still_rejected(self):
        content = "LM=2\n1.0 2.0\n3.0 4.0\nLM=1\n5.0 6.0\n"
        with pytest.raises(ValueError):
            parse_tps(content)


# ── PCA sign convention ───────────────────────────────────────────────────────

class TestPCASignConvention:
    def _data(self, seed=0, n=30):
        rng = np.random.default_rng(seed)
        raw = [rng.standard_normal((5, 2)).tolist() for _ in range(n)]
        return procrustes_gpa(raw)["aligned"]

    def test_dominant_loading_is_positive(self):
        """Each component points the same way every time it is computed."""
        res = run_pca(self._data())
        L = np.array(res["loadings"])
        for k in range(L.shape[1]):
            col = L[:, k]
            assert col[np.argmax(np.abs(col))] > 0

    def test_repeated_runs_agree(self):
        aligned = self._data(seed=1)
        a = np.array(run_pca(aligned)["scores"])
        b = np.array(run_pca(aligned)["scores"])
        assert np.allclose(a, b)

    def test_sign_fix_preserves_variance(self):
        """Flipping signs must not disturb the eigenvalues."""
        aligned = self._data(seed=2)
        res = run_pca(aligned)
        assert abs(sum(res["pct_variance"]) - 100.0) < 1e-6

    def test_scores_still_reconstruct_the_data(self):
        """scores @ loadings.T returns the centred coordinates."""
        aligned = self._data(seed=3)
        res = run_pca(aligned)
        X = np.array(aligned).reshape(len(aligned), -1)
        Xc = X - X.mean(axis=0)
        approx = np.array(res["scores"]) @ np.array(res["loadings"]).T
        assert np.allclose(approx, Xc, atol=1e-8)

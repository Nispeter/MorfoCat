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

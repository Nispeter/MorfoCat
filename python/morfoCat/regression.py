"""Multiple regression of shape variables on arbitrary predictors."""
from __future__ import annotations
import numpy as np
from typing import Any


def run_regression(
    dependent: list,
    independent: list,
    groups: list[str] | None = None,
    pooled: bool = False,
) -> dict[str, Any]:
    Y = np.array(dependent, dtype=float)
    if Y.ndim == 3:
        Y = Y.reshape(Y.shape[0], -1)

    X_raw = np.array(independent, dtype=float)
    if X_raw.ndim == 1:
        X_raw = X_raw.reshape(-1, 1)

    n = Y.shape[0]

    if pooled and groups is not None:
        return _pooled_within_group_regression(Y, X_raw, groups)

    # Add intercept
    X = np.column_stack([np.ones(n), X_raw])
    p = X.shape[1]

    # OLS: B = (X'X)^-1 X'Y
    XtX = X.T @ X
    try:
        XtX_inv = np.linalg.inv(XtX)
    except np.linalg.LinAlgError:
        XtX_inv = np.linalg.pinv(XtX)

    B = XtX_inv @ X.T @ Y
    Y_hat = X @ B
    residuals = Y - Y_hat

    # Total and residual SS
    Y_mean = Y.mean(axis=0)
    SS_tot = np.sum((Y - Y_mean) ** 2)
    SS_res = np.sum(residuals ** 2)
    SS_reg = SS_tot - SS_res

    df_reg = p - 1
    df_res = n - p
    MS_reg = SS_reg / df_reg if df_reg > 0 else 0.0
    MS_res = SS_res / df_res if df_res > 0 else 0.0
    F_stat = MS_reg / MS_res if MS_res > 0 else 0.0

    from scipy import stats as spstats
    p_value = float(spstats.f.sf(F_stat, df_reg, df_res))
    r_squared = float(SS_reg / SS_tot) if SS_tot > 0 else 0.0

    # Regression scores (predicted shape scores along regression vector)
    reg_vec = B[1:]  # slope(s)
    reg_scores = (X_raw @ reg_vec).sum(axis=1).tolist() if reg_vec.ndim > 1 else (X_raw @ reg_vec).tolist()

    return {
        "coefficients": B.tolist(),
        "fitted": Y_hat.tolist(),
        "residuals": residuals.tolist(),
        "r_squared": r_squared,
        "f_statistic": float(F_stat),
        "p_value": p_value,
        "df_regression": df_reg,
        "df_residual": df_res,
        "regression_scores": reg_scores,
        "type": "standard",
    }


def _pooled_within_group_regression(
    Y: np.ndarray, X: np.ndarray, groups: list[str]
) -> dict[str, Any]:
    group_arr = np.array(groups)
    unique = np.unique(group_arr)

    Yc_list, Xc_list = [], []
    for g in unique:
        mask = group_arr == g
        Yg = Y[mask]
        Xg = X[mask]
        Yc_list.append(Yg - Yg.mean(axis=0))
        Xc_list.append(Xg - Xg.mean(axis=0))

    Yc = np.vstack(Yc_list)
    Xc = np.vstack(Xc_list)
    n = Yc.shape[0]

    X_des = np.column_stack([np.ones(n), Xc])
    B = np.linalg.lstsq(X_des, Yc, rcond=None)[0]
    Y_hat = X_des @ B
    residuals = Yc - Y_hat

    SS_res = np.sum(residuals ** 2)
    SS_tot = np.sum((Yc - Yc.mean(axis=0)) ** 2)
    r_squared = float(1 - SS_res / SS_tot) if SS_tot > 0 else 0.0

    return {
        "coefficients": B.tolist(),
        "fitted": Y_hat.tolist(),
        "residuals": residuals.tolist(),
        "r_squared": r_squared,
        "type": "pooled_within_group",
        "groups": unique.tolist(),
    }

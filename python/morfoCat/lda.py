"""Linear Discriminant Analysis with leave-one-out cross-validation."""
from __future__ import annotations
import numpy as np
from typing import Any


def run_lda(aligned: list, groups: list[str]) -> dict[str, Any]:
    from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
    from sklearn.model_selection import LeaveOneOut
    from sklearn.metrics import confusion_matrix

    arr = np.array(aligned, dtype=float)
    n_spec = arr.shape[0]
    X = arr.reshape(n_spec, -1)
    y = np.array(groups)

    unique_groups = np.unique(y)

    # Fit LDA
    lda = LinearDiscriminantAnalysis()
    lda.fit(X, y)

    scores = lda.transform(X).tolist()
    predictions = lda.predict(X).tolist()

    # Leave-one-out cross-validation
    loo = LeaveOneOut()
    loo_predictions = np.empty(n_spec, dtype=object)
    for train_idx, test_idx in loo.split(X):
        lda_loo = LinearDiscriminantAnalysis()
        lda_loo.fit(X[train_idx], y[train_idx])
        loo_predictions[test_idx] = lda_loo.predict(X[test_idx])

    loo_predictions = loo_predictions.tolist()
    loo_accuracy = float(np.mean(np.array(loo_predictions) == y))

    cm = confusion_matrix(y, predictions, labels=unique_groups).tolist()
    cm_loo = confusion_matrix(y, loo_predictions, labels=unique_groups).tolist()

    return {
        "ld_scores": scores,
        "predictions": predictions,
        "loo_predictions": loo_predictions,
        "loo_accuracy": loo_accuracy,
        "confusion_matrix": cm,
        "loo_confusion_matrix": cm_loo,
        "groups": unique_groups.tolist(),
        "explained_variance_ratio": lda.explained_variance_ratio_.tolist(),
    }

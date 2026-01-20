"""
Baseline helpers for rolling medians and deviations.
"""

from typing import Iterable

import numpy as np
from scipy.ndimage import median_filter, uniform_filter1d


def _ensure_odd(window_frames: int) -> int:
    if window_frames <= 1:
        return 1
    return window_frames if window_frames % 2 == 1 else window_frames + 1


def rolling_median(values: Iterable[float], window_frames: int) -> np.ndarray:
    """
    Compute a rolling median using a fixed-size window.
    """
    values = np.asarray(values, dtype=float)
    if values.size == 0:
        return values
    window_frames = _ensure_odd(int(window_frames))
    if window_frames == 1:
        return values.copy()
    return median_filter(values, size=window_frames, mode="nearest")


def rolling_mean(values: Iterable[float], window_frames: int) -> np.ndarray:
    """
    Compute a rolling mean using a fixed-size window.
    """
    values = np.asarray(values, dtype=float)
    if values.size == 0:
        return values
    window_frames = max(1, int(window_frames))
    if window_frames == 1:
        return values.copy()
    return uniform_filter1d(values, size=window_frames, mode="nearest")


def deviation_from_baseline(values: Iterable[float], baseline: Iterable[float], eps: float = 1e-6) -> np.ndarray:
    """
    Compute relative deviation from a baseline signal.
    """
    values = np.asarray(values, dtype=float)
    baseline = np.asarray(baseline, dtype=float)
    if values.size == 0:
        return values
    return (values - baseline) / (baseline + eps)

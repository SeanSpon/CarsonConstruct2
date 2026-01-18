"""
Feature cache for audio detection.
"""

from typing import Any, Dict, Optional

import numpy as np
import librosa
from scipy.ndimage import uniform_filter1d

from utils.baseline import rolling_median
from vad_utils import build_vad_mask, build_vad_segments


def _align_features(feature_map: Dict[str, Optional[np.ndarray]]) -> Dict[str, Optional[np.ndarray]]:
    lengths = [
        len(values)
        for values in feature_map.values()
        if isinstance(values, np.ndarray) and values.size > 0
    ]
    if not lengths:
        return feature_map
    min_len = min(lengths)
    for key, values in feature_map.items():
        if isinstance(values, np.ndarray) and values.size > 0:
            feature_map[key] = values[:min_len]
    return feature_map


def extract_features(
    y: np.ndarray,
    sr: int,
    hop_length: Optional[int] = None,
    settings: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Compute and cache all features used by detectors.
    """
    settings = settings or {}
    hop_length = hop_length or int(sr * 0.05)
    hop_length = max(1, hop_length)

    rms = librosa.feature.rms(y=y, hop_length=hop_length, center=False)[0]
    times = librosa.times_like(rms, sr=sr, hop_length=hop_length)

    smooth_frames = max(1, int(settings.get("rms_smoothing_s", 0.3) / (hop_length / sr)))
    rms_smooth = uniform_filter1d(rms, size=smooth_frames, mode="nearest") if rms.size else rms

    spectral_centroid = librosa.feature.spectral_centroid(
        y=y, sr=sr, hop_length=hop_length
    )[0]
    spectral_flatness = librosa.feature.spectral_flatness(y=y, hop_length=hop_length)[0]
    zcr = librosa.feature.zero_crossing_rate(y, hop_length=hop_length, center=False)[0]
    onset_strength = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)

    spectral_contrast = None
    if settings.get("spectral_contrast", False):
        contrast = librosa.feature.spectral_contrast(
            y=y, sr=sr, hop_length=hop_length
        )
        spectral_contrast = np.mean(contrast, axis=0)

    features: Dict[str, Any] = {
        "times": times,
        "rms": rms,
        "rms_smooth": rms_smooth,
        "spectral_centroid": spectral_centroid,
        "spectral_flatness": spectral_flatness,
        "spectral_contrast": spectral_contrast,
        "onset_strength": onset_strength,
        "zcr": zcr,
    }

    features = _align_features(features)

    times = features["times"]
    hop_s = hop_length / sr
    baseline_window_s = settings.get("baseline_window_s", 15.0)
    baseline_frames = max(3, int(baseline_window_s / hop_s))

    features["rms_baseline"] = rolling_median(features["rms_smooth"], baseline_frames)
    features["centroid_baseline"] = rolling_median(features["spectral_centroid"], baseline_frames)
    features["flatness_baseline"] = rolling_median(features["spectral_flatness"], baseline_frames)
    features["zcr_baseline"] = rolling_median(features["zcr"], baseline_frames)
    features["onset_baseline"] = rolling_median(features["onset_strength"], baseline_frames)

    vad_settings = settings.get("vad", {})
    vad_segments = build_vad_segments(
        y,
        sr,
        aggressiveness=vad_settings.get("aggressiveness", 2),
        frame_ms=vad_settings.get("frame_ms", 30),
        target_sr=vad_settings.get("target_sr", 16000),
        merge_gap_s=vad_settings.get("merge_gap_s", 0.25),
    )
    vad_mask = build_vad_mask(times, vad_segments)

    features["vad_segments"] = vad_segments
    features["vad_mask"] = vad_mask
    features["hop_length"] = hop_length
    features["frame_duration"] = hop_s

    return features

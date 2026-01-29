"""
Feature cache for audio detection.

MVP mode adds:
- 0.10s hop (10 fps feature timeline)
- dB conversion for RMS values
- 20s baseline window
- speech_mask from transcript segments
"""

from typing import Any, Dict, List, Optional

import numpy as np
import librosa
from scipy.ndimage import uniform_filter1d

from utils.baseline import rolling_median
from vad_utils import build_vad_mask, build_vad_segments


# MVP Default Parameters
MVP_DEFAULTS = {
    "hop_s": 0.10,                   # 10 fps feature timeline
    "rms_window_s": 0.40,            # RMS smoothing window
    "baseline_window_s": 20.0,       # Median baseline window
    "silence_threshold_db": -35,     # Absolute silence threshold
}


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


def rms_to_db(rms: np.ndarray, ref: float = 1.0, min_db: float = -80.0) -> np.ndarray:
    """
    Convert RMS amplitude to decibels.
    
    Args:
        rms: RMS amplitude values
        ref: Reference amplitude (1.0 for normalized audio)
        min_db: Minimum dB value to clamp to
    
    Returns:
        RMS values in decibels
    """
    # Avoid log of zero
    rms_safe = np.maximum(rms, 1e-10)
    db = 20 * np.log10(rms_safe / ref)
    return np.maximum(db, min_db)


def build_speech_mask_from_transcript(
    times: np.ndarray,
    transcript: Optional[Dict[str, Any]]
) -> np.ndarray:
    """
    Build speech mask from Whisper transcript segments.
    speech_flag(t) = 1 if t falls inside any Whisper segment
    
    Args:
        times: Array of frame timestamps
        transcript: Whisper transcript with 'segments' array
    
    Returns:
        Boolean mask where True = speech present
    """
    mask = np.zeros(len(times), dtype=bool)
    if transcript is None:
        return mask
    
    segments = transcript.get("segments", [])
    for seg in segments:
        seg_start = seg.get("start", 0)
        seg_end = seg.get("end", 0)
        mask |= (times >= seg_start) & (times <= seg_end)
    
    return mask


def build_silence_mask(
    rms_db: np.ndarray,
    threshold_db: float = -35.0
) -> np.ndarray:
    """
    Build silence mask from RMS dB values.
    
    Args:
        rms_db: RMS values in decibels
        threshold_db: Threshold below which is considered silence
    
    Returns:
        Boolean mask where True = silence
    """
    return rms_db < threshold_db


def extract_features(
    y: np.ndarray,
    sr: int,
    hop_length: Optional[int] = None,
    settings: Optional[Dict[str, Any]] = None,
    transcript: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Compute and cache all features used by detectors.
    
    Args:
        y: Audio time series
        sr: Sample rate
        hop_length: Hop length in samples (overrides settings)
        settings: Feature extraction settings
        transcript: Optional Whisper transcript for speech_mask
    
    Returns:
        Dictionary of extracted features
    """
    settings = settings or {}
    mvp_mode = settings.get("mvp_mode", False)
    
    # Determine hop length
    if hop_length is None:
        if mvp_mode:
            hop_s = settings.get("hop_s", MVP_DEFAULTS["hop_s"])
        else:
            hop_s = settings.get("hop_s", 0.05)
        hop_length = int(sr * hop_s)
    hop_length = max(1, hop_length)

    rms = librosa.feature.rms(y=y, hop_length=hop_length, center=False)[0]
    times = librosa.times_like(rms, sr=sr, hop_length=hop_length)

    # RMS smoothing window
    if mvp_mode:
        rms_window_s = settings.get("rms_window_s", MVP_DEFAULTS["rms_window_s"])
    else:
        rms_window_s = settings.get("rms_smoothing_s", 0.3)
    smooth_frames = max(1, int(rms_window_s / (hop_length / sr)))
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
    
    # Baseline window
    if mvp_mode:
        baseline_window_s = settings.get("baseline_window_s", MVP_DEFAULTS["baseline_window_s"])
    else:
        baseline_window_s = settings.get("baseline_window_s", 15.0)
    baseline_frames = max(3, int(baseline_window_s / hop_s))

    features["rms_baseline"] = rolling_median(features["rms_smooth"], baseline_frames)
    features["centroid_baseline"] = rolling_median(features["spectral_centroid"], baseline_frames)
    features["flatness_baseline"] = rolling_median(features["spectral_flatness"], baseline_frames)
    features["zcr_baseline"] = rolling_median(features["zcr"], baseline_frames)
    features["onset_baseline"] = rolling_median(features["onset_strength"], baseline_frames)

    # Convert to dB for MVP mode
    if mvp_mode:
        features["rms_db"] = rms_to_db(features["rms_smooth"])
        features["baseline_db"] = rms_to_db(features["rms_baseline"])
        
        # Silence mask based on absolute dB threshold
        silence_threshold_db = settings.get("silence_threshold_db", MVP_DEFAULTS["silence_threshold_db"])
        features["silence_mask"] = build_silence_mask(features["rms_db"], silence_threshold_db)
        
        # Speech mask from transcript (MVP truth source)
        features["speech_mask"] = build_speech_mask_from_transcript(times, transcript)

    # VAD segments (used for non-MVP mode and boundary snapping)
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
    features["duration"] = float(times[-1]) if len(times) > 0 else 0.0

    return features


def features_to_json(features: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert features dict to JSON-serializable format for persistence.
    
    Args:
        features: Features dictionary from extract_features
    
    Returns:
        JSON-serializable dictionary
    """
    result = {
        "hop": features.get("frame_duration", 0.1),
        "duration": features.get("duration", 0.0),
    }
    
    # Convert numpy arrays to lists
    times = features.get("times", np.array([]))
    rms_db = features.get("rms_db", np.array([]))
    baseline_db = features.get("baseline_db", np.array([]))
    silence_mask = features.get("silence_mask", np.array([]))
    speech_mask = features.get("speech_mask", np.array([]))
    
    # Store as frame array for efficiency
    frames = []
    for i in range(len(times)):
        frame = {
            "t": round(float(times[i]), 3),
        }
        if len(rms_db) > i:
            frame["rms_db"] = round(float(rms_db[i]), 1)
        if len(baseline_db) > i:
            frame["baseline_db"] = round(float(baseline_db[i]), 1)
        if len(silence_mask) > i:
            frame["silence"] = bool(silence_mask[i])
        if len(speech_mask) > i:
            frame["speech"] = bool(speech_mask[i])
        frames.append(frame)
    
    result["frames"] = frames
    
    # Store masks as compact boolean arrays
    if len(speech_mask) > 0:
        result["speech_mask"] = [bool(x) for x in speech_mask]
    if len(silence_mask) > 0:
        result["silence_mask"] = [bool(x) for x in silence_mask]
    
    return result


def features_from_json(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Load features from JSON format back to numpy arrays.
    
    Args:
        data: JSON data from features_to_json
    
    Returns:
        Features dictionary with numpy arrays
    """
    frames = data.get("frames", [])
    
    times = np.array([f["t"] for f in frames], dtype=float)
    rms_db = np.array([f.get("rms_db", -80.0) for f in frames], dtype=float)
    baseline_db = np.array([f.get("baseline_db", -80.0) for f in frames], dtype=float)
    silence_mask = np.array([f.get("silence", False) for f in frames], dtype=bool)
    speech_mask = np.array([f.get("speech", False) for f in frames], dtype=bool)
    
    # Also check for compact mask arrays
    if "speech_mask" in data:
        speech_mask = np.array(data["speech_mask"], dtype=bool)
    if "silence_mask" in data:
        silence_mask = np.array(data["silence_mask"], dtype=bool)
    
    return {
        "times": times,
        "rms_db": rms_db,
        "baseline_db": baseline_db,
        "silence_mask": silence_mask,
        "speech_mask": speech_mask,
        "frame_duration": data.get("hop", 0.1),
        "duration": data.get("duration", 0.0),
    }

"""
Audio utility functions
"""

import numpy as np

def generate_waveform(y: np.ndarray, num_points: int = 1000) -> list:
    """
    Generate a downsampled waveform for UI visualization.
    
    Args:
        y: Audio time series
        num_points: Number of points in output waveform
    
    Returns:
        List of amplitude values (0-1 normalized)
    """
    if len(y) == 0:
        return [0] * num_points
    
    # Downsample by taking max absolute value in each window
    window_size = len(y) // num_points
    if window_size < 1:
        window_size = 1
    
    waveform = []
    for i in range(num_points):
        start = i * window_size
        end = min(start + window_size, len(y))
        if start >= len(y):
            waveform.append(0)
        else:
            window = np.abs(y[start:end])
            waveform.append(float(np.max(window)) if len(window) > 0 else 0)
    
    # Normalize to 0-1
    max_val = max(waveform) if waveform else 1
    if max_val > 0:
        waveform = [v / max_val for v in waveform]
    
    return waveform


def calculate_hook_strength(
    y: np.ndarray,
    sr: int,
    start_time: float,
    end_time: float,
    features: dict = None,
) -> dict:
    """
    Calculate hook strength for the first 3 seconds of a clip.
    """
    if features:
        times = features["times"]
        rms = features["rms_smooth"]
        baseline = features["rms_baseline"]
        hook_end = min(start_time + 3, end_time)
        start_idx = int(np.searchsorted(times, start_time, side="left"))
        end_idx = int(np.searchsorted(times, hook_end, side="right"))
        if end_idx <= start_idx:
            return {"strength_score": 50, "multiplier": 1.0}
        hook_rms = float(np.mean(rms[start_idx:end_idx]))
        baseline_rms = float(np.mean(baseline[start_idx:end_idx]))
    else:
        import librosa

        hook_start = int(start_time * sr)
        hook_end = int(min(start_time + 3, end_time) * sr)
        hook_audio = y[hook_start:hook_end] if hook_end > hook_start else y[hook_start:]

        baseline_start = int(max(0, start_time - 30) * sr)
        baseline_end = int(start_time * sr)
        baseline_audio = y[baseline_start:baseline_end] if baseline_end > baseline_start else y[:hook_start]

        if len(hook_audio) == 0 or len(baseline_audio) == 0:
            return {"strength_score": 50, "multiplier": 1.0}

        hook_rms = np.sqrt(np.mean(hook_audio ** 2))
        baseline_rms = np.sqrt(np.mean(baseline_audio ** 2))

    ratio = hook_rms / (baseline_rms + 1e-6)

    strength_score = min(100, max(0, ratio * 50))
    multiplier = 0.85 + (ratio - 0.5) * 0.4
    multiplier = max(0.85, min(1.25, multiplier))

    return {
        "strength_score": round(strength_score, 1),
        "multiplier": round(multiplier, 2),
    }

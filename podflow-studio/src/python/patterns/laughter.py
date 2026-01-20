"""
Laughter Detection

Pattern: Burst clusters with high centroid + energy deviation.
Uses local baselines and peak clustering.
"""

from typing import Dict, List

import numpy as np
from scipy.signal import find_peaks

from utils.baseline import deviation_from_baseline


def _format_timestamp(seconds: float) -> str:
    """Format seconds as HH:MM:SS or MM:SS"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def detect_laughter_moments(
    features: Dict,
    bounds: Dict,
    settings: Dict,
) -> List[Dict]:
    """
    Find laughter moments using energy bursts and spectral analysis.
    """
    times = features["times"]
    rms = features["rms_smooth"]
    centroid = features["spectral_centroid"]
    zcr = features["zcr"]
    onset = features["onset_strength"]
    rms_baseline = features["rms_baseline"]
    centroid_baseline = features["centroid_baseline"]
    zcr_baseline = features["zcr_baseline"]
    onset_baseline = features["onset_baseline"]
    hop_s = features["frame_duration"]

    start_time = bounds["start_time"]
    end_time = bounds["end_time"]
    min_clip_duration = bounds["min_duration"]
    max_clip_duration = bounds["max_duration"]

    debug = settings.get("debug", False)

    if rms.size == 0:
        return []

    energy_dev = np.clip(deviation_from_baseline(rms, rms_baseline), 0.0, None)
    centroid_dev = np.clip(deviation_from_baseline(centroid, centroid_baseline), 0.0, None)
    zcr_dev = np.clip(deviation_from_baseline(zcr, zcr_baseline), 0.0, None)
    onset_dev = np.clip(deviation_from_baseline(onset, onset_baseline), 0.0, None)

    laughter_score = (
        0.35 * energy_dev
        + 0.25 * centroid_dev
        + 0.2 * zcr_dev
        + 0.2 * onset_dev
    )

    if laughter_score.size == 0:
        return []

    threshold = np.percentile(laughter_score, 85)
    peak_indices, _ = find_peaks(laughter_score, height=threshold, distance=max(1, int(0.2 / hop_s)))
    peak_times = times[peak_indices] if peak_indices.size else np.array([])

    clusters = []
    if peak_times.size:
        cluster_start = peak_times[0]
        cluster_peaks = [peak_times[0]]
        for peak in peak_times[1:]:
            if peak - cluster_start <= 3.0:
                cluster_peaks.append(float(peak))
            else:
                if len(cluster_peaks) >= 3:
                    clusters.append((cluster_peaks[0], cluster_peaks[-1], len(cluster_peaks)))
                cluster_start = peak
                cluster_peaks = [float(peak)]
        if len(cluster_peaks) >= 3:
            clusters.append((cluster_peaks[0], cluster_peaks[-1], len(cluster_peaks)))

    laughter_clips = []
    for cluster_start, cluster_end, peak_count in clusters:
        if cluster_end < start_time or cluster_start > end_time:
            continue
        if cluster_end - cluster_start < 1.0:
            continue

        region_start = max(start_time, cluster_start - 0.5)
        region_end = min(end_time, cluster_end + 0.8)
        region_duration = region_end - region_start

        if region_duration < 1.5 or region_duration > 15.0:
            continue

        start_idx = int(np.searchsorted(times, region_start, side="left"))
        end_idx = int(np.searchsorted(times, region_end, side="right"))
        peak_score = float(np.max(laughter_score[start_idx:end_idx]))

        clip_start = max(start_time, region_start - 10.0)
        clip_end = min(end_time, region_end + 3.0)
        clip_duration = clip_end - clip_start

        if clip_duration < min_clip_duration:
            extra = min_clip_duration - clip_duration
            clip_start = max(start_time, clip_start - extra / 2)
            clip_end = min(end_time, clip_end + extra / 2)
            clip_duration = clip_end - clip_start

        if clip_duration > max_clip_duration:
            clip_start = max(start_time, region_start - 8.0)
            clip_end = min(end_time, region_end + 3.0)
            clip_duration = clip_end - clip_start

        intensity_score = min(45.0, peak_score * 40.0)
        duration_score = min(25.0, (region_duration / 10.0) * 25.0)
        burst_score = min(30.0, (peak_count / 6.0) * 30.0)
        algorithm_score = intensity_score + duration_score + burst_score

        # Create unique ID with timestamp
        timestamp_str = _format_timestamp(clip_start)
        clip_id = f"laughter_{int(clip_start)}_{len(laughter_clips) + 1}"
        
        clip = {
            "id": clip_id,
            "startTime": round(clip_start, 2),
            "endTime": round(clip_end, 2),
            "duration": round(clip_duration, 2),
            "pattern": "laughter",
            "patternLabel": f"Laughter @ {timestamp_str}",
            "description": f"{region_duration:.1f}s laughter burst with {peak_count} peaks",
            "algorithmScore": round(min(100, algorithm_score), 1),
            # Pre-generate a unique title based on timing (AI will override if available)
            "title": f"Laughter Moment at {timestamp_str}",
            "hookText": f"Watch what happens at {timestamp_str}",
        }

        if debug:
            clip["debug"] = {
                "baseline_used": "rms/centroid/zcr/onset",
                "peakScore": round(peak_score, 3),
                "clusterPeaks": peak_count,
            }

        laughter_clips.append(clip)

    return laughter_clips

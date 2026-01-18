"""
Debate / Turn-taking Detection

Pattern: rapid alternation of speech segments with short gaps.
"""

from typing import Dict, List

import numpy as np

from utils.baseline import deviation_from_baseline


def detect_debate_moments(
    features: Dict,
    bounds: Dict,
    settings: Dict,
) -> List[Dict]:
    segments = features.get("vad_segments", [])
    if not segments:
        return []

    times = features["times"]
    rms = features["rms_smooth"]
    rms_baseline = features["rms_baseline"]
    onset = features["onset_strength"]
    hop_s = features["frame_duration"]

    start_time = bounds["start_time"]
    end_time = bounds["end_time"]
    min_clip_duration = bounds["min_duration"]
    max_clip_duration = bounds["max_duration"]

    max_gap_s = settings.get("debate_gap_s", 0.25)
    min_window_s = settings.get("debate_min_window_s", 6.0)
    min_turns = settings.get("debate_min_turns", 6)
    debug = settings.get("debug", False)

    filtered_segments = [
        seg for seg in segments if seg[1] >= start_time and seg[0] <= end_time
    ]

    clusters: List[Dict] = []
    cluster_start = None
    last_end = None
    cluster_segments: List = []

    for seg_start, seg_end in filtered_segments:
        if cluster_start is None:
            cluster_start = seg_start
            last_end = seg_end
            cluster_segments = [(seg_start, seg_end)]
            continue

        gap = seg_start - last_end
        if gap <= max_gap_s:
            cluster_segments.append((seg_start, seg_end))
            last_end = seg_end
        else:
            duration = last_end - cluster_start
            if duration >= min_window_s and len(cluster_segments) >= min_turns:
                clusters.append(
                    {
                        "start": cluster_start,
                        "end": last_end,
                        "segments": cluster_segments,
                    }
                )
            cluster_start = seg_start
            last_end = seg_end
            cluster_segments = [(seg_start, seg_end)]

    if cluster_start is not None and last_end is not None:
        duration = last_end - cluster_start
        if duration >= min_window_s and len(cluster_segments) >= min_turns:
            clusters.append(
                {
                    "start": cluster_start,
                    "end": last_end,
                    "segments": cluster_segments,
                }
            )

    debate_clips = []
    for cluster in clusters:
        region_start = max(start_time, cluster["start"] - 1.0)
        region_end = min(end_time, cluster["end"] + 1.0)
        region_duration = region_end - region_start

        if region_duration < min_clip_duration:
            region_end = min(end_time, region_start + min_clip_duration)
            region_duration = region_end - region_start

        if region_duration > max_clip_duration:
            region_end = region_start + max_clip_duration
            region_duration = max_clip_duration

        start_idx = int(np.searchsorted(times, region_start, side="left"))
        end_idx = int(np.searchsorted(times, region_end, side="right"))
        onset_window = onset[start_idx:end_idx]
        energy_dev = deviation_from_baseline(rms[start_idx:end_idx], rms_baseline[start_idx:end_idx])

        turn_count = len(cluster["segments"])
        gaps = [
            cluster["segments"][i + 1][0] - cluster["segments"][i][1]
            for i in range(len(cluster["segments"]) - 1)
        ]
        avg_gap = float(np.mean(gaps)) if gaps else 0.0

        turn_score = min(40.0, (turn_count / 10.0) * 40.0)
        gap_score = min(20.0, max(0.0, (1.0 - (avg_gap / max_gap_s))) * 20.0)
        energy_score = min(20.0, max(0.0, float(np.mean(energy_dev))) * 20.0)
        onset_var = float(np.var(onset_window)) if onset_window.size else 0.0
        onset_mean = float(np.mean(onset_window)) if onset_window.size else 1.0
        variance_score = min(20.0, min(1.0, onset_var / (onset_mean + 1e-6)) * 20.0)
        algorithm_score = turn_score + gap_score + energy_score + variance_score

        clip = {
            "id": f"debate_{len(debate_clips) + 1}",
            "startTime": round(region_start, 2),
            "endTime": round(region_end, 2),
            "duration": round(region_duration, 2),
            "pattern": "debate",
            "patternLabel": "Debate / Turn-Taking",
            "description": f"{turn_count} rapid turn-takes over {region_duration:.0f}s",
            "algorithmScore": round(min(100, algorithm_score), 1),
        }

        if debug:
            clip["debug"] = {
                "baseline_used": "rms_baseline/onset_baseline",
                "turnCount": turn_count,
                "avgGap": round(avg_gap, 3),
                "onsetVariance": round(onset_var, 3),
            }

        debate_clips.append(clip)

    return debate_clips

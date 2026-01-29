"""
Energy Monologue Detection

Pattern: Sustained high energy + high speech density.
Uses rolling local baselines and VAD speech density.
"""

from typing import Dict, List

import numpy as np

from utils.baseline import deviation_from_baseline, rolling_mean


def _format_timestamp(seconds: float) -> str:
    """Format seconds as HH:MM:SS or MM:SS"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def detect_energy_monologues(
    features: Dict,
    bounds: Dict,
    settings: Dict,
) -> List[Dict]:
    """
    Find sustained high-energy speech segments.
    """
    times = features["times"]
    rms = features["rms_smooth"]
    rms_baseline = features["rms_baseline"]
    onset = features["onset_strength"]
    onset_baseline = features["onset_baseline"]
    vad_mask = features.get("vad_mask", np.zeros_like(times, dtype=bool))
    hop_s = features["frame_duration"]

    start_time = bounds["start_time"]
    end_time = bounds["end_time"]
    min_clip_duration = bounds["min_duration"]
    max_clip_duration = bounds["max_duration"]

    debug = settings.get("debug", False)

    if rms.size == 0:
        return []

    energy_dev = deviation_from_baseline(rms, rms_baseline)
    onset_dev = deviation_from_baseline(onset, onset_baseline)

    density_window_frames = max(1, int(settings.get("speech_density_window_s", 2.0) / hop_s))
    speech_density = rolling_mean(vad_mask.astype(float), density_window_frames)

    energy_threshold = settings.get("monologue_energy_deviation", 0.35)
    density_threshold = settings.get("monologue_speech_density", 0.75)
    min_duration_frames = int(min_clip_duration / hop_s)
    gap_tolerance_frames = int(settings.get("monologue_gap_s", 1.0) / hop_s)

    active = (energy_dev >= energy_threshold) & (speech_density >= density_threshold)

    regions = []
    region_start = None
    last_active = None

    for i, time in enumerate(times):
        if time < start_time or time > end_time:
            if region_start is not None and last_active is not None:
                region_end_idx = last_active
                if region_end_idx - region_start >= min_duration_frames:
                    regions.append((region_start, region_end_idx))
            region_start = None
            last_active = None
            continue

        if active[i]:
            if region_start is None:
                region_start = i
            last_active = i
        elif region_start is not None and last_active is not None:
            if i - last_active <= gap_tolerance_frames:
                continue
            region_end_idx = last_active
            if region_end_idx - region_start >= min_duration_frames:
                regions.append((region_start, region_end_idx))
            region_start = None
            last_active = None

    if region_start is not None and last_active is not None:
        if last_active - region_start >= min_duration_frames:
            regions.append((region_start, last_active))

    monologue_clips = []
    for start_idx, end_idx in regions:
        region_start_time = float(times[start_idx])
        region_end_time = float(times[end_idx])
        region_duration = region_end_time - region_start_time

        region_energy = energy_dev[start_idx:end_idx]
        region_onset = onset_dev[start_idx:end_idx]
        region_density = speech_density[start_idx:end_idx]

        if region_energy.size == 0:
            continue

        energy_score = min(35.0, max(0.0, float(np.mean(region_energy))) * 35.0)
        pace_score = min(25.0, max(0.0, float(np.mean(region_onset))) * 20.0)
        density_score = min(20.0, float(np.mean(region_density)) * 20.0)
        duration_score = min(20.0, (region_duration / 45.0) * 20.0)
        algorithm_score = energy_score + pace_score + density_score + duration_score

        clip_start = max(start_time, region_start_time - 2.0)
        clip_end = min(end_time, region_end_time + 2.0)
        clip_duration = clip_end - clip_start

        if clip_duration < min_clip_duration:
            extra = min_clip_duration - clip_duration
            clip_start = max(start_time, clip_start - extra / 2)
            clip_end = min(end_time, clip_end + extra / 2)
            clip_duration = clip_end - clip_start

        if clip_duration > max_clip_duration:
            clip_end = clip_start + max_clip_duration
            clip_duration = max_clip_duration

        # Create unique ID with timestamp
        timestamp_str = _format_timestamp(clip_start)
        clip_id = f"monologue_{int(clip_start)}_{len(monologue_clips) + 1}"
        
        clip = {
            "id": clip_id,
            "startTime": round(clip_start, 2),
            "endTime": round(clip_end, 2),
            "duration": round(clip_duration, 2),
            "pattern": "monologue",
            "patternLabel": f"Rant @ {timestamp_str}",
            "description": f"{region_duration:.0f}s sustained energy, dense speech",
            "algorithmScore": round(min(100, algorithm_score), 1),
            # Pre-generate a unique title based on timing (AI will override if available)
            "title": f"Hot Take at {timestamp_str}",
            "hookText": f"Listen to this rant starting at {timestamp_str}",
        }

        if debug:
            clip["debug"] = {
                "baseline_used": "rms_baseline/onset_baseline",
                "energyDeviationMean": round(float(np.mean(region_energy)), 3),
                "speechDensityMean": round(float(np.mean(region_density)), 3),
            }

        monologue_clips.append(clip)

    return monologue_clips

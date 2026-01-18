"""
Payoff Moment Detection

Pattern: [Silence/Low Energy 1.5-5 sec] → [Energy Spike]
Uses rolling local baselines for robustness.
"""

from typing import Dict, List

import numpy as np

from utils.baseline import deviation_from_baseline


def detect_payoff_moments(
    features: Dict,
    bounds: Dict,
    settings: Dict,
) -> List[Dict]:
    """
    Find moments where silence/low-energy is followed by energy spike.
    """

    times = features["times"]
    rms = features["rms_smooth"]
    baseline = features["rms_baseline"]
    hop_s = features["frame_duration"]

    start_time = bounds["start_time"]
    end_time = bounds["end_time"]
    min_clip_duration = bounds["min_duration"]
    max_clip_duration = bounds["max_duration"]

    debug = settings.get("debug", False)
    silence_threshold = settings.get("payoff_silence_deviation", -0.35)
    spike_threshold = settings.get("payoff_spike_deviation", 0.6)
    min_silence_s = settings.get("payoff_min_silence", 1.5)
    max_silence_s = settings.get("payoff_max_silence", 5.0)

    if rms.size == 0:
        return []

    deviation = deviation_from_baseline(rms, baseline)
    silence_regions = []
    in_silence = False
    silence_start = 0.0
    silence_start_idx = 0

    for i, time in enumerate(times):
        if time < start_time or time > end_time:
            if in_silence:
                silence_end = time
                duration = silence_end - silence_start
                if min_silence_s <= duration <= max_silence_s:
                    silence_regions.append(
                        {
                            "start": silence_start,
                            "end": silence_end,
                            "duration": duration,
                            "start_idx": silence_start_idx,
                            "end_idx": i,
                        }
                    )
                in_silence = False
            continue

        is_silent = deviation[i] <= silence_threshold
        if is_silent and not in_silence:
            in_silence = True
            silence_start = float(time)
            silence_start_idx = i
        elif not is_silent and in_silence:
            silence_end = float(time)
            duration = silence_end - silence_start
            if min_silence_s <= duration <= max_silence_s:
                silence_regions.append(
                    {
                        "start": silence_start,
                        "end": silence_end,
                        "duration": duration,
                        "start_idx": silence_start_idx,
                        "end_idx": i,
                    }
                )
            in_silence = False

    if in_silence:
        silence_end = min(end_time, float(times[-1]))
        duration = silence_end - silence_start
        if min_silence_s <= duration <= max_silence_s:
            silence_regions.append(
                {
                    "start": silence_start,
                    "end": silence_end,
                    "duration": duration,
                    "start_idx": silence_start_idx,
                    "end_idx": len(times) - 1,
                }
            )

    payoff_moments = []
    for silence in silence_regions:
        silence_end_idx = silence["end_idx"]
        check_end_idx = min(len(rms), silence_end_idx + int(3.0 / hop_s))
        if silence_end_idx >= check_end_idx:
            continue

        post_dev = deviation[silence_end_idx:check_end_idx]
        if post_dev.size < 5:
            continue

        max_dev_idx = int(np.argmax(post_dev))
        max_dev = float(post_dev[max_dev_idx])
        if max_dev <= spike_threshold:
            continue

        sustained_frames = int(np.sum(post_dev > spike_threshold * 0.8))
        sustained_duration = sustained_frames * hop_s
        if sustained_duration < 0.5:
            continue

        peak_idx = silence_end_idx + max_dev_idx
        spike_intensity = float(rms[peak_idx] / (baseline[peak_idx] + 1e-6))

        silence_score = min(35.0, (silence["duration"] / 5.0) * 35.0)
        spike_score = min(45.0, max(0.0, (spike_intensity - 1.0)) * 22.0)
        sustain_score = min(20.0, sustained_duration * 10.0)
        algorithm_score = silence_score + spike_score + sustain_score

        clip_start = max(start_time, silence["start"] - 5.0)
        clip_end = min(end_time, silence["end"] + 5.0 + sustained_duration)

        clip_duration = clip_end - clip_start
        if clip_duration < min_clip_duration:
            extra = min_clip_duration - clip_duration
            clip_start = max(start_time, clip_start - extra / 2)
            clip_end = min(end_time, clip_end + extra / 2)
            clip_duration = clip_end - clip_start

        if clip_duration > max_clip_duration:
            clip_start = max(start_time, silence["end"] - max_clip_duration * 0.3)
            clip_end = clip_start + max_clip_duration
            clip_duration = max_clip_duration

        clip = {
            "id": f"payoff_{len(payoff_moments) + 1}",
            "startTime": round(clip_start, 2),
            "endTime": round(clip_end, 2),
            "duration": round(clip_duration, 2),
            "pattern": "payoff",
            "patternLabel": "Payoff Moment",
            "description": f"{silence['duration']:.1f}s pause → {sustained_duration:.1f}s energy spike",
            "algorithmScore": round(min(100, algorithm_score), 1),
            "silenceDuration": round(silence["duration"], 2),
            "spikeIntensity": round(spike_intensity, 2),
        }

        if debug:
            clip["debug"] = {
                "baseline_used": "rms_baseline",
                "silenceDeviationThreshold": silence_threshold,
                "spikeDeviationThreshold": spike_threshold,
                "sustainedDuration": round(sustained_duration, 2),
            }

        payoff_moments.append(clip)

    return payoff_moments

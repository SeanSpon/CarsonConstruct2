"""
Dead Space Detection

Finds silence regions > threshold for auto-edit feature.
"""

from typing import Dict, List

import numpy as np

from utils.baseline import deviation_from_baseline


def detect_dead_spaces(
    features: Dict,
    bounds: Dict,
    settings: Dict,
) -> List[Dict]:
    """
    Find dead space (silence/very low energy) regions.
    """
    times = features["times"]
    rms = features["rms_smooth"]
    baseline = features["rms_baseline"]

    min_silence = settings.get("min_silence", 3.0)
    max_silence = settings.get("max_silence", 30.0)
    silence_deviation = settings.get("silence_deviation", -0.45)

    start_time = bounds["start_time"]
    end_time = bounds["end_time"]

    if rms.size == 0:
        return []

    deviation = deviation_from_baseline(rms, baseline)

    dead_spaces = []
    in_silence = False
    silence_start = 0.0

    for i, time in enumerate(times):
        if time < start_time or time > end_time:
            if in_silence:
                silence_end = float(time)
                silence_duration = silence_end - silence_start
                if silence_duration >= min_silence:
                    dead_spaces.extend(
                        _split_silence(
                            silence_start,
                            silence_end,
                            min_silence,
                            max_silence,
                            len(dead_spaces),
                        )
                    )
                in_silence = False
            continue

        if deviation[i] <= silence_deviation and not in_silence:
            in_silence = True
            silence_start = float(time)
        elif deviation[i] > silence_deviation and in_silence:
            in_silence = False
            silence_end = float(time)
            silence_duration = silence_end - silence_start
            if silence_duration >= min_silence:
                dead_spaces.extend(
                    _split_silence(
                        silence_start,
                        silence_end,
                        min_silence,
                        max_silence,
                        len(dead_spaces),
                    )
                )

    if in_silence:
        silence_end = min(end_time, float(times[-1]))
        silence_duration = silence_end - silence_start
        if silence_duration >= min_silence:
            dead_spaces.extend(
                _split_silence(
                    silence_start,
                    silence_end,
                    min_silence,
                    max_silence,
                    len(dead_spaces),
                )
            )

    return dead_spaces


def _split_silence(
    silence_start: float,
    silence_end: float,
    min_silence: float,
    max_silence: float,
    offset: int,
) -> List[Dict]:
    silence_duration = silence_end - silence_start
    spaces = []
    if silence_duration > max_silence:
        num_splits = int(np.ceil(silence_duration / max_silence))
        split_duration = silence_duration / num_splits
        for j in range(num_splits):
            split_start = silence_start + j * split_duration
            split_end = split_start + split_duration
            spaces.append(
                {
                    "id": f"dead_{offset + len(spaces) + 1}",
                    "startTime": round(split_start, 2),
                    "endTime": round(split_end, 2),
                    "duration": round(split_duration, 2),
                    "remove": True,
                }
            )
    else:
        spaces.append(
            {
                "id": f"dead_{offset + 1}",
                "startTime": round(silence_start, 2),
                "endTime": round(silence_end, 2),
                "duration": round(silence_duration, 2),
                "remove": True,
            }
        )
    return spaces

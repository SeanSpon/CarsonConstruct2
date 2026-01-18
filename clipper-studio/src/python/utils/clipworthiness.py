"""
Clipworthiness scoring with hard gates and soft-score ensemble.
"""

from typing import Any, Dict, List, Tuple

import numpy as np

from utils.baseline import deviation_from_baseline


def _slice_for_window(times: np.ndarray, start_time: float, end_time: float) -> slice:
    start_idx = int(np.searchsorted(times, start_time, side="left"))
    end_idx = int(np.searchsorted(times, end_time, side="right"))
    return slice(max(0, start_idx), max(start_idx + 1, end_idx))


def _speech_metrics(features: Dict[str, Any], start_time: float, end_time: float) -> Dict[str, float]:
    times = features["times"]
    vad_mask = features.get("vad_mask", np.zeros_like(times, dtype=bool))
    flatness = features.get("spectral_flatness", np.zeros_like(times, dtype=float))
    frame_duration = features.get("frame_duration", 0.05)

    window = _slice_for_window(times, start_time, end_time)
    if window.stop <= window.start:
        return {"speech_ratio": 0.0, "speech_seconds": 0.0, "flatness_median": 1.0}

    speech_ratio = float(np.mean(vad_mask[window]))
    speech_seconds = speech_ratio * (window.stop - window.start) * frame_duration
    flatness_median = float(np.median(flatness[window])) if flatness.size else 1.0

    return {
        "speech_ratio": speech_ratio,
        "speech_seconds": speech_seconds,
        "flatness_median": flatness_median,
    }


def _hook_score(features: Dict[str, Any], start_time: float, end_time: float) -> Tuple[float, float, float]:
    times = features["times"]
    rms = features["rms_smooth"]
    baseline = features["rms_baseline"]
    onset = features["onset_strength"]
    onset_baseline = features["onset_baseline"]

    hook_end = min(end_time, start_time + 3.0)
    window = _slice_for_window(times, start_time, hook_end)
    if window.stop <= window.start:
        return 50.0, 1.0, 1.0

    rms_ratio = float(np.mean(rms[window]) / (np.mean(baseline[window]) + 1e-6))
    onset_dev = deviation_from_baseline(onset[window], onset_baseline[window])
    novelty = float(np.clip(np.mean(onset_dev), 0.0, 2.0))

    score = 50.0 + (rms_ratio - 1.0) * 35.0 + novelty * 15.0
    score = float(np.clip(score, 0.0, 100.0))
    multiplier = float(np.clip(0.85 + (score - 50.0) / 200.0, 0.85, 1.2))
    return score, multiplier, rms_ratio


def _coherence_score(features: Dict[str, Any], start_time: float, end_time: float) -> float:
    segments = features.get("vad_segments", [])
    if not segments:
        return 50.0

    start_gaps = [abs(start_time - seg_start) for seg_start, _ in segments]
    end_gaps = [abs(end_time - seg_end) for _, seg_end in segments]
    start_gap = min(start_gaps) if start_gaps else 1.0
    end_gap = min(end_gaps) if end_gaps else 1.0

    start_score = max(0.0, 1.0 - min(start_gap, 0.75) / 0.75)
    end_score = max(0.0, 1.0 - min(end_gap, 0.75) / 0.75)
    return float(np.clip((start_score + end_score) * 50.0, 0.0, 100.0))


def _default_weights() -> Dict[str, float]:
    return {
        "pattern": 0.7,
        "hook": 0.2,
        "coherence": 0.1,
    }


def apply_clipworthiness(
    clips: List[Dict[str, Any]],
    features: Dict[str, Any],
    settings: Dict[str, Any],
    debug: bool = False,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Filter and score clips using hard gates and a soft-score ensemble.
    """
    hard_gate_cfg = settings.get("hard_gates", {})
    speech_ratio_threshold = hard_gate_cfg.get("speech_ratio", 0.7)
    flatness_threshold = hard_gate_cfg.get("flatness_median", 0.45)
    min_speech_seconds = hard_gate_cfg.get("speech_seconds", 6.0)

    weights = settings.get("clipworthiness_weights", _default_weights())
    scored = []
    gated_out = []

    for clip in clips:
        metrics = _speech_metrics(features, clip["startTime"], clip["endTime"])

        hard_gates = {
            "speech_ratio": metrics["speech_ratio"] >= speech_ratio_threshold,
            "flatness": metrics["flatness_median"] <= flatness_threshold,
            "speech_seconds": metrics["speech_seconds"] >= min_speech_seconds,
        }

        gate_reasons = [
            reason
            for reason, passed in hard_gates.items()
            if not passed
        ]

        if gate_reasons:
            if debug:
                gated_clip = {**clip}
                gated_clip["gateReasons"] = gate_reasons
                gated_clip["gateMetrics"] = metrics
                gated_out.append(gated_clip)
            continue

        hook_score, hook_multiplier, hook_ratio = _hook_score(
            features, clip["startTime"], clip["endTime"]
        )
        coherence_score = _coherence_score(features, clip["startTime"], clip["endTime"])

        pattern_score = float(clip.get("algorithmScore", clip.get("score", 50)))
        soft_scores = {
            "payoff_score": pattern_score if clip["pattern"] == "payoff" else 0.0,
            "monologue_score": pattern_score if clip["pattern"] == "monologue" else 0.0,
            "hook_score": hook_score,
            "coherence_score": coherence_score,
        }

        total_weight = weights["pattern"] + weights["hook"] + weights["coherence"]
        final_score = (
            pattern_score * weights["pattern"]
            + hook_score * weights["hook"]
            + coherence_score * weights["coherence"]
        ) / total_weight

        clip["score"] = float(np.clip(final_score, 0.0, 100.0))
        clip["hookStrength"] = round(hook_score, 1)
        clip["hookMultiplier"] = round(hook_multiplier, 2)

        breakdown = {
            "hardGates": hard_gates,
            "softScores": soft_scores,
            "weights": weights,
            "finalScore": clip["score"],
        }

        if debug:
            breakdown["gateMetrics"] = metrics
            breakdown["hookRatio"] = hook_ratio

        clip["clipworthiness"] = breakdown
        scored.append(clip)

    debug_stats = {
        "candidates": len(clips),
        "gatedOut": len(gated_out),
    }
    if debug:
        debug_stats["gatedClips"] = gated_out
    return scored, debug_stats

"""
MVP Scoring Module - Deterministic clip scoring formula

This module implements the exact scoring formula from the MVP plan:
- energy_lift (0-35 pts): median dB lift vs previous 20s
- peak_strength (0-25 pts): peak dB delta from baseline
- speech_density (0-20 pts): transcript coverage ratio
- contrast_bonus (0-15 pts): silence_to_spike only
- length_penalty (-10 to 0): clips outside 15-30s range

Total score is clamped to 0-100.
"""

import numpy as np
from typing import Dict, Tuple, List, Optional


def build_speech_mask_from_transcript(
    times: np.ndarray,
    transcript: dict
) -> np.ndarray:
    """
    Build a speech mask from Whisper transcript segments.
    
    speech_flag(t) = 1 if t falls inside any Whisper segment
    
    Args:
        times: Array of frame timestamps
        transcript: Whisper transcript with 'segments' list
        
    Returns:
        Boolean mask where True = speech present at that time
    """
    mask = np.zeros(len(times), dtype=bool)
    segments = transcript.get("segments", [])
    
    for seg in segments:
        seg_start = seg.get("start", 0)
        seg_end = seg.get("end", 0)
        mask |= (times >= seg_start) & (times <= seg_end)
    
    return mask


def score_clip(
    clip_start: float,
    clip_end: float,
    candidate: dict,
    features: dict,
    transcript: dict
) -> Tuple[float, dict]:
    """
    Score a clip using the deterministic MVP formula.
    
    Returns (score, breakdown) where score is 0-100.
    
    The breakdown dict contains:
    - energy_lift: 0-35 pts
    - peak_strength: 0-25 pts
    - speech_density: 0-20 pts
    - contrast_bonus: 0-15 pts (silence_to_spike only)
    - length_penalty: -10 to 0 pts
    - speech_ratio: actual ratio (debug)
    - lift_db: actual dB lift (debug)
    """
    times = np.array(features.get("times", []))
    rms_db = np.array(features.get("rms_db", []))
    baseline_db = np.array(features.get("baseline_db", rms_db))  # Fallback to rms if no baseline
    speech_mask = np.array(features.get("speech_mask", np.ones(len(times), dtype=bool)))
    
    # If no speech mask in features, build from transcript
    if not features.get("speech_mask") and transcript:
        speech_mask = build_speech_mask_from_transcript(times, transcript)
    
    # Slice to clip window
    clip_mask = (times >= clip_start) & (times <= clip_end)
    clip_rms_db = rms_db[clip_mask]
    clip_baseline = baseline_db[clip_mask]
    clip_speech = speech_mask[clip_mask]
    
    # ============================================
    # 1. Energy lift (0-35 pts)
    # Compare median in clip vs median in prev 20s
    # ============================================
    prev_start = max(0, clip_start - 20.0)
    prev_mask = (times >= prev_start) & (times < clip_start)
    prev_median_db = float(np.median(rms_db[prev_mask])) if prev_mask.any() else -40.0
    clip_median_db = float(np.median(clip_rms_db)) if len(clip_rms_db) > 0 else -40.0
    lift_db = clip_median_db - prev_median_db
    
    # +10dB lift -> full 35 pts
    energy_lift = float(np.clip(lift_db / 10.0 * 35.0, 0, 35))
    
    # ============================================
    # 2. Peak strength (0-25 pts)
    # Max dB in clip minus baseline at that point
    # ============================================
    if len(clip_rms_db) > 0:
        peak_idx = int(np.argmax(clip_rms_db))
        peak_delta = float(clip_rms_db[peak_idx] - clip_baseline[peak_idx])
    else:
        peak_delta = 0.0
    
    # +8 dB -> 10 pts, +14 dB -> 25 pts
    peak_strength = float(np.clip((peak_delta - 8) / 6 * 15 + 10, 0, 25))
    
    # ============================================
    # 3. Speech density (0-20 pts)
    # Ratio of frames with speech
    # ============================================
    speech_ratio = float(np.mean(clip_speech)) if len(clip_speech) > 0 else 0.0
    
    # 60%+ -> full 20 points, <30% -> near zero
    if speech_ratio >= 0.6:
        speech_pts = 20.0
    elif speech_ratio < 0.3:
        speech_pts = speech_ratio / 0.3 * 5.0
    else:
        speech_pts = 5.0 + (speech_ratio - 0.3) / 0.3 * 15.0
    
    # ============================================
    # 4. Contrast bonus (0-15 pts) - only for silence_to_spike
    # ============================================
    contrast_bonus = 0.0
    candidate_type = candidate.get("type", "")
    
    if candidate_type == "silence_to_spike":
        silence_len = candidate.get("meta", {}).get("silence_len", 0)
        # 1.2s -> 10 pts, 2.5s+ -> 15 pts
        if silence_len >= 1.2:
            contrast_bonus = float(np.clip((silence_len - 1.2) / 1.3 * 5 + 10, 10, 15))
    
    # ============================================
    # 5. Length penalty (0 to -10 pts)
    # Ideal range: 15-30s
    # ============================================
    duration = clip_end - clip_start
    
    if duration < 10:
        length_penalty = -6.0
    elif duration > 40:
        length_penalty = -6.0
    elif 15 <= duration <= 30:
        length_penalty = 0.0
    elif duration < 15:
        length_penalty = -(15 - duration) / 5 * 6
    else:  # 30 < duration <= 40
        length_penalty = -(duration - 30) / 10 * 6
    
    length_penalty = float(length_penalty)
    
    # ============================================
    # Final score
    # ============================================
    score = energy_lift + peak_strength + speech_pts + contrast_bonus + length_penalty
    score = float(np.clip(score, 0, 100))
    
    breakdown = {
        "energy_lift": round(energy_lift, 1),
        "peak_strength": round(peak_strength, 1),
        "speech_density": round(speech_pts, 1),
        "contrast_bonus": round(contrast_bonus, 1),
        "length_penalty": round(length_penalty, 1),
        "speech_ratio": round(speech_ratio, 2),
        "lift_db": round(lift_db, 1),
    }
    
    return round(score, 1), breakdown


def compute_iou(a_start: float, a_end: float, b_start: float, b_end: float) -> float:
    """
    Intersection over Union for two time intervals.
    
    Args:
        a_start, a_end: First interval
        b_start, b_end: Second interval
        
    Returns:
        IoU value between 0.0 and 1.0
    """
    intersection = max(0, min(a_end, b_end) - max(a_start, b_start))
    union = (a_end - a_start) + (b_end - b_start) - intersection
    
    if union <= 0:
        return 0.0
    
    return intersection / union


def nms_clips(
    clips: List[dict],
    iou_threshold: float = 0.6
) -> List[dict]:
    """
    Non-max suppression: sort by score desc, reject overlapping clips.
    
    Global de-dupe (all candidate types together).
    
    Args:
        clips: List of clip dicts with 'start', 'end', 'score' keys
        iou_threshold: Reject clips with IoU >= this threshold
        
    Returns:
        List of kept clips (non-overlapping, highest scores)
    """
    # Sort by score descending
    sorted_clips = sorted(clips, key=lambda c: c.get("score", 0), reverse=True)
    kept = []
    
    for clip in sorted_clips:
        dominated = False
        
        for existing in kept:
            iou = compute_iou(
                clip.get("start", clip.get("startTime", 0)),
                clip.get("end", clip.get("endTime", 0)),
                existing.get("start", existing.get("startTime", 0)),
                existing.get("end", existing.get("endTime", 0))
            )
            
            if iou >= iou_threshold:
                dominated = True
                break
        
        if not dominated:
            kept.append(clip)
    
    return kept


def score_and_select_clips(
    candidates: List[dict],
    features: dict,
    transcript: dict,
    settings: dict
) -> List[dict]:
    """
    Score all candidates, apply NMS, and select top N clips.
    
    This is the main entry point for the MVP scoring pipeline.
    
    Selection order:
    1. Score ALL proposed windows from ALL candidates
    2. NMS/IoU prune globally
    3. THEN take top_n
    
    Args:
        candidates: List of candidate dicts with 'type', 't_peak', 'start', 'end', 'meta'
        features: Feature dict with 'times', 'rms_db', 'baseline_db', 'speech_mask'
        transcript: Whisper transcript dict
        settings: Settings dict with 'top_n', 'iou_threshold', 'clip_lengths', etc.
        
    Returns:
        List of scored clip dicts with 'score', 'score_breakdown', etc.
    """
    from .mvp_candidates import propose_clip_windows
    
    top_n = settings.get("top_n", 10)
    iou_threshold = settings.get("iou_threshold", 0.6)
    clip_lengths = settings.get("clip_lengths", [12, 18, 24, 35])
    duration = features.get("duration", 0)
    
    all_scored_clips = []
    
    for candidate in candidates:
        # Propose multiple clip windows around this candidate
        windows = propose_clip_windows(
            candidate,
            transcript,
            duration,
            clip_lengths=clip_lengths,
            min_clip=settings.get("min_clip_s", 8),
            max_clip=settings.get("max_clip_s", 45),
        )
        
        for window_start, window_end, snapped, snap_reason in windows:
            # Score this window
            score, breakdown = score_clip(
                window_start,
                window_end,
                candidate,
                features,
                transcript
            )
            
            clip = {
                "id": f"clip_{candidate['type']}_{int(candidate.get('t_peak', 0) * 10)}_{int(window_start * 10)}",
                "startTime": round(window_start, 2),
                "endTime": round(window_end, 2),
                "start": round(window_start, 2),  # For NMS compatibility
                "end": round(window_end, 2),       # For NMS compatibility
                "duration": round(window_end - window_start, 2),
                "score": score,
                "finalScore": score,
                "algorithmScore": score,
                "score_breakdown": breakdown,
                "source_candidate": {
                    "type": candidate.get("type"),
                    "t_peak": candidate.get("t_peak"),
                },
                "snapped": snapped,
                "snap_reason": snap_reason,
                # Map candidate type to pattern
                "pattern": _candidate_type_to_pattern(candidate.get("type")),
                "patternLabel": _candidate_type_to_label(candidate.get("type")),
                "description": f"Peak at {candidate.get('t_peak', 0):.1f}s",
                "hookStrength": int(breakdown.get("energy_lift", 0) + breakdown.get("peak_strength", 0)),
                "hookMultiplier": 1.0,
                "trimStartOffset": 0,
                "trimEndOffset": 0,
                "status": "pending",
            }
            
            all_scored_clips.append(clip)
    
    # Apply NMS globally
    deduplicated = nms_clips(all_scored_clips, iou_threshold)
    
    # Sort by score and take top N
    deduplicated.sort(key=lambda c: c.get("score", 0), reverse=True)
    final_clips = deduplicated[:top_n]
    
    # Renumber clips
    for i, clip in enumerate(final_clips):
        clip["id"] = f"clip_{i + 1:03d}"
    
    return final_clips


def _candidate_type_to_pattern(candidate_type: str) -> str:
    """Map candidate type to pattern name."""
    mapping = {
        "energy_spike": "payoff",
        "silence_to_spike": "payoff",
        "laughter_like": "laughter",
    }
    return mapping.get(candidate_type, "monologue")


def _candidate_type_to_label(candidate_type: str) -> str:
    """Map candidate type to human-readable label."""
    mapping = {
        "energy_spike": "Energy Spike",
        "silence_to_spike": "Payoff Moment",
        "laughter_like": "Reaction/Laughter",
    }
    return mapping.get(candidate_type, "Highlight")

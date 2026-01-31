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


def classify_clip_mood(
    candidate_type: str,
    energy_lift: float,
    speech_density: float,
    contrast_bonus: float,
    transcript_text: str = ""
) -> str:
    """
    Classify clip mood based on audio characteristics and content.
    
    Returns one of: 'impactful', 'funny', 'serious', 'somber', 'energetic', 'revealing'
    """
    # Look for emotional keywords in transcript
    text_lower = transcript_text.lower()
    funny_keywords = ['haha', 'lol', 'laugh', 'funny', 'joke', 'hilarious', 'crazy']
    serious_keywords = ['important', 'critical', 'must', 'essential', 'need to', 'problem']
    somber_keywords = ['sad', 'difficult', 'hard', 'tough', 'unfortunate', 'tragedy', 'loss']
    revealing_keywords = ['realize', 'understand', 'suddenly', 'ah', 'oh', 'wait', 'actually']
    
    has_funny = any(kw in text_lower for kw in funny_keywords)
    has_serious = any(kw in text_lower for kw in serious_keywords)
    has_somber = any(kw in text_lower for kw in somber_keywords)
    has_revealing = any(kw in text_lower for kw in revealing_keywords)
    
    # High contrast = revealing/impactful
    if contrast_bonus > 10:
        if has_revealing:
            return 'revealing'
        return 'impactful'
    
    # Very high energy = energetic
    if energy_lift > 25:
        if has_funny:
            return 'funny'
        return 'energetic'
    
    # Medium-high energy with speech = likely funny or impactful
    if energy_lift > 18 and speech_density > 15:
        if has_funny:
            return 'funny'
        if has_serious:
            return 'serious'
        return 'impactful'
    
    # Low energy + high speech = serious or somber
    if energy_lift < 15 and speech_density > 12:
        if has_somber:
            return 'somber'
        return 'serious'
    
    # Silence-to-spike pattern = revealing
    if candidate_type == 'silence_to_spike':
        return 'revealing'
    
    # Default based on energy
    if energy_lift > 20:
        return 'energetic'
    elif energy_lift < 10:
        return 'somber'
    else:
        return 'impactful'


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
    - mood: clip mood classification
    """
    times = np.array(features.get("times", []))
    rms_db = np.array(features.get("rms_db", []))
    baseline_db = np.array(features.get("baseline_db", rms_db))  # Fallback to rms if no baseline
    
    # Build speech mask from features or transcript
    if features.get("speech_mask") is not None:
        speech_mask = np.array(features.get("speech_mask"))
    elif transcript:
        speech_mask = build_speech_mask_from_transcript(times, transcript)
    else:
        speech_mask = np.ones(len(times), dtype=bool)
    
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
    # Ideal range: 45-90s (updated from 15-30s)
    # ============================================
    duration = clip_end - clip_start
    
    if duration < 30:
        length_penalty = -8.0
    elif duration > 150:
        length_penalty = -8.0
    elif 45 <= duration <= 90:
        length_penalty = 0.0
    elif duration < 45:
        length_penalty = -(45 - duration) / 15 * 8
    else:  # 90 < duration <= 150
        length_penalty = -(duration - 90) / 60 * 8
    
    length_penalty = float(length_penalty)
    
    # ============================================
    # Final score
    # ============================================
    score = energy_lift + peak_strength + speech_pts + contrast_bonus + length_penalty
    score = float(np.clip(score, 0, 100))
    
    # ============================================
    # 6. Mood classification
    # Extract transcript text for this clip
    # ============================================
    transcript_text = ""
    if transcript and transcript.get("segments"):
        for seg in transcript["segments"]:
            seg_start = seg.get("start", 0)
            seg_end = seg.get("end", 0)
            # Include segments that overlap with clip
            if seg_end >= clip_start and seg_start <= clip_end:
                transcript_text += " " + seg.get("text", "")
    
    mood = classify_clip_mood(
        candidate.get("type", ""),
        energy_lift,
        speech_pts,
        contrast_bonus,
        transcript_text
    )
    
    breakdown = {
        "energy_lift": round(energy_lift, 1),
        "peak_strength": round(peak_strength, 1),
        "speech_density": round(speech_pts, 1),
        "contrast_bonus": round(contrast_bonus, 1),
        "length_penalty": round(length_penalty, 1),
        "speech_ratio": round(speech_ratio, 2),
        "lift_db": round(lift_db, 1),
        "mood": mood,
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


def compute_overlap_ratio(a_start: float, a_end: float, b_start: float, b_end: float) -> float:
    """
    Overlap ratio for two time intervals using min(duration) as denominator.
    
    This is stricter than IoU for clips of different lengths.
    Two clips covering the same moment but with different durations
    will have high overlap ratio even if IoU is low.
    
    Formula: intersection / min(duration_a, duration_b)
    
    Example:
        - ClipA: 0-30s (30s), ClipB: 0-60s (60s)
        - Intersection: 30s
        - IoU = 30/60 = 0.5 (would NOT be suppressed at 0.6 threshold)
        - Overlap ratio = 30/30 = 1.0 (WOULD be suppressed at 0.7 threshold)
    
    Args:
        a_start, a_end: First interval
        b_start, b_end: Second interval
        
    Returns:
        Overlap ratio between 0.0 and 1.0
    """
    intersection = max(0, min(a_end, b_end) - max(a_start, b_start))
    duration_a = a_end - a_start
    duration_b = b_end - b_start
    min_duration = min(duration_a, duration_b)
    
    if min_duration <= 0:
        return 0.0
    
    return intersection / min_duration


def nms_clips(
    clips: List[dict],
    iou_threshold: float = 0.6,
    overlap_threshold: float = 0.7,
    use_overlap_ratio: bool = True
) -> List[dict]:
    """
    Non-max suppression: sort by score desc, reject overlapping clips.
    
    Global de-dupe (all candidate types together).
    
    Uses overlap_ratio by default (stricter than IoU) to prevent the same
    moment from appearing multiple times with different clip lengths.
    
    Args:
        clips: List of clip dicts with 'start', 'end', 'score' keys
        iou_threshold: Reject clips with IoU >= this threshold (if use_overlap_ratio=False)
        overlap_threshold: Reject clips with overlap_ratio >= this threshold (default)
        use_overlap_ratio: If True, use stricter overlap_ratio; if False, use IoU
        
    Returns:
        List of kept clips (non-overlapping, highest scores)
    """
    # Sort by score descending
    sorted_clips = sorted(clips, key=lambda c: c.get("score", 0), reverse=True)
    kept = []
    
    for clip in sorted_clips:
        dominated = False
        
        clip_start = clip.get("start", clip.get("startTime", 0))
        clip_end = clip.get("end", clip.get("endTime", 0))
        
        for existing in kept:
            existing_start = existing.get("start", existing.get("startTime", 0))
            existing_end = existing.get("end", existing.get("endTime", 0))
            
            if use_overlap_ratio:
                # Use stricter overlap ratio (intersection / min_duration)
                overlap = compute_overlap_ratio(
                    clip_start, clip_end,
                    existing_start, existing_end
                )
                if overlap >= overlap_threshold:
                    dominated = True
                    break
            else:
                # Use IoU (intersection / union)
                iou = compute_iou(
                    clip_start, clip_end,
                    existing_start, existing_end
                )
                if iou >= iou_threshold:
                    dominated = True
                    break
        
        if not dominated:
            kept.append(clip)
    
    return kept


def select_with_temporal_diversity(
    clips: List[dict],
    top_n: int,
    duration: float,
    diversity_weight: float = 0.3,
    min_gap_ratio: float = 0.05,
) -> List[dict]:
    """
    Select top N clips with temporal diversity across the video.
    
    This algorithm balances score with temporal distribution to avoid
    clustering all clips in one section of the video.
    
    Algorithm:
    1. First, always take the highest-scoring clip
    2. For subsequent clips, apply a diversity penalty based on how close
       they are to already-selected clips
    3. The penalty reduces the effective score of clips that are too close
       to already-selected clips, encouraging spread across the video
    
    Args:
        clips: List of clip dicts with 'start', 'end', 'score' keys (already NMS-filtered)
        top_n: Number of clips to select
        duration: Total video duration (seconds)
        diversity_weight: Weight for diversity penalty (0=pure score, 1=pure diversity)
        min_gap_ratio: Minimum gap between clips as ratio of duration (e.g., 0.05 = 5%)
    
    Returns:
        List of selected clips with temporal diversity
    """
    if not clips or top_n <= 0:
        return []
    
    if duration <= 0:
        # Fallback: just return top by score
        return sorted(clips, key=lambda c: c.get("score", 0), reverse=True)[:top_n]
    
    # Minimum gap between clip centers (in seconds)
    min_gap_s = duration * min_gap_ratio
    
    # Work with copies to avoid modifying originals
    available = list(clips)
    selected = []
    
    while len(selected) < top_n and available:
        best_idx = -1
        best_adjusted_score = -float('inf')
        
        for i, clip in enumerate(available):
            clip_start = clip.get("start", clip.get("startTime", 0))
            clip_end = clip.get("end", clip.get("endTime", 0))
            clip_center = (clip_start + clip_end) / 2
            base_score = clip.get("score", 0)
            
            # Calculate diversity penalty based on distance to already-selected clips
            diversity_penalty = 0.0
            
            if selected:
                # Find minimum distance to any selected clip center
                min_distance = float('inf')
                for sel in selected:
                    sel_start = sel.get("start", sel.get("startTime", 0))
                    sel_end = sel.get("end", sel.get("endTime", 0))
                    sel_center = (sel_start + sel_end) / 2
                    distance = abs(clip_center - sel_center)
                    min_distance = min(min_distance, distance)
                
                # Penalty: clips closer than min_gap_s get penalized
                # Penalty decreases as distance increases
                if min_distance < min_gap_s:
                    # Strong penalty for very close clips
                    diversity_penalty = (1.0 - min_distance / min_gap_s) * diversity_weight * 100
                elif min_distance < min_gap_s * 3:
                    # Mild penalty for somewhat close clips
                    diversity_penalty = (1.0 - min_distance / (min_gap_s * 3)) * diversity_weight * 30
            
            adjusted_score = base_score - diversity_penalty
            
            if adjusted_score > best_adjusted_score:
                best_adjusted_score = adjusted_score
                best_idx = i
        
        if best_idx >= 0:
            selected.append(available.pop(best_idx))
        else:
            break
    
    # Sort selected clips by time for consistent output
    selected.sort(key=lambda c: c.get("start", c.get("startTime", 0)))
    
    return selected


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
    from vad_utils import snap_to_word_boundaries
    
    top_n = settings.get("top_n", 10)
    iou_threshold = settings.get("iou_threshold", 0.6)
    clip_lengths = settings.get("clip_lengths", [30, 45, 60, 90, 120])
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
            max_clip=settings.get("max_clip_s", 300),
        )
        
        for window_start, window_end, snapped, snap_reason in windows:
            # Ensure windows don't cut mid-word (Whisper word timestamps).
            # This is best-effort; if transcript lacks word timings, it becomes a no-op.
            new_start, new_end, word_snapped, word_reason = snap_to_word_boundaries(
                float(window_start),
                float(window_end),
                transcript,
                prefer_sentence_boundaries=True,
                max_adjustment=float(settings.get("word_snap_max_adjust_s", 1.0) or 1.0),
                add_breathing_room=True,
                head_padding_s=float(settings.get("head_padding_s", 0.15) or 0.15),
                tail_padding_s=float(settings.get("tail_padding_s", 0.3) or 0.3),
            )
            # Clamp to duration.
            new_start = max(0.0, min(float(duration), float(new_start)))
            new_end = max(new_start, min(float(duration), float(new_end)))

            if (new_end - new_start) >= float(settings.get("min_clip_s", 8) or 8):
                window_start, window_end = new_start, new_end
                if word_snapped:
                    snapped = True
                    snap_reason = f"{snap_reason}|word:{word_reason}"

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
    
    # Apply NMS globally to remove overlapping clips
    deduplicated = nms_clips(all_scored_clips, iou_threshold)
    
    # Use temporal diversity selection to spread clips across the video
    # This prevents all clips from clustering in one section
    diversity_weight = settings.get("diversity_weight", 0.35)
    min_gap_ratio = settings.get("min_gap_ratio", 0.08)  # 8% of video = ~5 min gap for 1hr podcast
    
    final_clips = select_with_temporal_diversity(
        deduplicated,
        top_n,
        duration,
        diversity_weight=diversity_weight,
        min_gap_ratio=min_gap_ratio,
    )
    
    # Renumber clips by time order
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

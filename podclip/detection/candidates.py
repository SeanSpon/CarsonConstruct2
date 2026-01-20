"""
Candidate Detection

Detects potential clip candidates using ONLY:
1. Speech density (words/sec from transcript)
2. Silence → speech spike (energy contrast)
3. Sentence boundaries
4. Length constraints (15-60s default)

NO AI, NO MACHINE LEARNING - pure deterministic rules.
"""

from dataclasses import dataclass
from typing import List, Optional
import numpy as np

from ..transcription import Transcript, Segment


@dataclass
class Candidate:
    """A potential clip candidate."""
    start: float          # Start time in seconds
    end: float            # End time in seconds
    reason: str           # Why this was detected (e.g., "high_speech_density")
    peak_time: float      # Time of the "peak" moment
    
    # Metrics used for detection
    speech_density: float = 0.0    # words/sec
    energy_contrast: float = 0.0   # dB change at peak
    
    @property
    def duration(self) -> float:
        return self.end - self.start


def calculate_speech_density(
    transcript: Transcript,
    start: float,
    end: float
) -> float:
    """
    Calculate speech density (words per second) for a time range.
    
    Higher density = more engaging content (usually).
    """
    words = transcript.get_words_in_range(start, end)
    duration = end - start
    
    if duration <= 0:
        return 0.0
    
    return len(words) / duration


def find_sentence_boundary(
    transcript: Transcript,
    target_time: float,
    direction: str,  # "before" or "after"
    max_distance: float = 3.0
) -> Optional[float]:
    """
    Find the nearest sentence boundary to a target time.
    
    Args:
        transcript: Transcript with segments
        target_time: Time to search from
        direction: "before" to find segment end before, "after" to find start after
        max_distance: Maximum seconds to search
        
    Returns:
        Time of nearest boundary, or None if not found
    """
    best_time = None
    best_distance = max_distance + 1
    
    for seg in transcript.segments:
        if direction == "before":
            # Find segment that ends before target
            if seg.end <= target_time:
                distance = target_time - seg.end
                if distance <= max_distance and distance < best_distance:
                    best_time = seg.end
                    best_distance = distance
        else:  # "after"
            # Find segment that starts after target
            if seg.start >= target_time:
                distance = seg.start - target_time
                if distance <= max_distance and distance < best_distance:
                    best_time = seg.start
                    best_distance = distance
    
    return best_time


def snap_to_sentence_boundaries(
    transcript: Transcript,
    start: float,
    end: float,
    snap_window: float = 2.0
) -> tuple[float, float, bool]:
    """
    Snap clip boundaries to nearest sentence boundaries.
    
    Args:
        transcript: Transcript with segments
        start: Original start time
        end: Original end time
        snap_window: How far to search for boundaries
        
    Returns:
        (new_start, new_end, was_snapped)
    """
    new_start = start
    new_end = end
    snapped = False
    
    # Snap start to sentence beginning
    sentence_start = find_sentence_boundary(transcript, start, "after", snap_window)
    if sentence_start is not None and sentence_start > start - snap_window:
        # Only snap if it makes the clip start at a sentence beginning
        for seg in transcript.segments:
            if abs(seg.start - sentence_start) < 0.1:
                new_start = seg.start
                snapped = True
                break
    
    # Snap end to sentence ending
    sentence_end = find_sentence_boundary(transcript, end, "before", snap_window)
    if sentence_end is not None and sentence_end < end + snap_window:
        for seg in transcript.segments:
            if abs(seg.end - sentence_end) < 0.1:
                new_end = seg.end
                snapped = True
                break
    
    return new_start, new_end, snapped


def detect_high_density_regions(
    transcript: Transcript,
    window_size: float = 15.0,
    min_density: float = 2.5,  # words/sec
    min_duration: float = 15.0,
    max_duration: float = 60.0,
    step_size: float = 5.0
) -> List[Candidate]:
    """
    Detect regions with high speech density.
    
    Slides a window across the transcript, finding regions where
    speech density exceeds the threshold.
    
    Args:
        transcript: Transcript with word timestamps
        window_size: Size of analysis window in seconds
        min_density: Minimum words/sec to consider
        min_duration: Minimum clip duration
        max_duration: Maximum clip duration
        step_size: How far to step between windows
        
    Returns:
        List of candidates
    """
    candidates = []
    
    if not transcript.words:
        return candidates
    
    duration = transcript.duration
    t = 0.0
    
    while t + window_size <= duration:
        density = calculate_speech_density(transcript, t, t + window_size)
        
        if density >= min_density:
            # Found high-density region - try to expand to natural boundaries
            start = t
            end = t + window_size
            
            # Try to expand if density stays high
            while end < duration and end - start < max_duration:
                extended_density = calculate_speech_density(transcript, start, end + step_size)
                if extended_density >= min_density * 0.8:  # Allow slight drop
                    end += step_size
                else:
                    break
            
            # Snap to sentence boundaries
            start, end, _ = snap_to_sentence_boundaries(transcript, start, end)
            
            # Enforce constraints
            clip_duration = end - start
            if clip_duration < min_duration:
                end = start + min_duration
            if clip_duration > max_duration:
                end = start + max_duration
            
            # Find peak (highest density point)
            best_density = 0.0
            peak_time = (start + end) / 2
            for check_t in np.arange(start, end - 5, 1.0):
                check_density = calculate_speech_density(transcript, check_t, check_t + 5)
                if check_density > best_density:
                    best_density = check_density
                    peak_time = check_t + 2.5
            
            candidates.append(Candidate(
                start=round(start, 2),
                end=round(end, 2),
                reason="high_speech_density",
                peak_time=round(peak_time, 2),
                speech_density=round(density, 2)
            ))
            
            # Skip past this region
            t = end
        else:
            t += step_size
    
    return candidates


def detect_silence_breaks(
    transcript: Transcript,
    min_silence: float = 1.5,
    max_silence: float = 5.0,
    context_before: float = 10.0,
    context_after: float = 15.0,
    min_duration: float = 15.0,
    max_duration: float = 60.0
) -> List[Candidate]:
    """
    Detect silence → speech breaks (payoff moments).
    
    Looks for gaps between words that indicate a pause,
    followed by continued speech (the "payoff").
    
    Args:
        transcript: Transcript with word timestamps
        min_silence: Minimum gap to consider a silence
        max_silence: Maximum gap to consider (longer = dead air)
        context_before: How much time before the silence to include
        context_after: How much time after to include
        min_duration: Minimum clip duration
        max_duration: Maximum clip duration
        
    Returns:
        List of candidates
    """
    candidates = []
    
    if len(transcript.words) < 2:
        return candidates
    
    # Find gaps between words
    for i in range(len(transcript.words) - 1):
        current_word = transcript.words[i]
        next_word = transcript.words[i + 1]
        
        gap = next_word.start - current_word.end
        
        if min_silence <= gap <= max_silence:
            # Found a silence break - create clip around it
            silence_start = current_word.end
            silence_end = next_word.start
            
            # Include context before and after
            clip_start = max(0, silence_start - context_before)
            clip_end = min(transcript.duration, silence_end + context_after)
            
            # Snap to sentence boundaries
            clip_start, clip_end, _ = snap_to_sentence_boundaries(
                transcript, clip_start, clip_end
            )
            
            # Enforce constraints
            clip_duration = clip_end - clip_start
            if clip_duration < min_duration:
                # Extend symmetrically
                extra = (min_duration - clip_duration) / 2
                clip_start = max(0, clip_start - extra)
                clip_end = min(transcript.duration, clip_end + extra)
            if clip_duration > max_duration:
                # Center on the payoff moment
                center = silence_end
                clip_start = max(0, center - max_duration * 0.4)
                clip_end = clip_start + max_duration
            
            # Calculate speech density after the break (the "payoff")
            payoff_density = calculate_speech_density(
                transcript, silence_end, min(silence_end + 10, clip_end)
            )
            
            candidates.append(Candidate(
                start=round(clip_start, 2),
                end=round(clip_end, 2),
                reason="silence_break",
                peak_time=round(silence_end, 2),
                speech_density=round(payoff_density, 2),
                energy_contrast=round(gap, 2)  # Using silence duration as proxy
            ))
    
    return candidates


def detect_candidates(
    transcript: Transcript,
    min_duration: float = 15.0,
    max_duration: float = 60.0,
    skip_intro: float = 30.0,
    skip_outro: float = 30.0
) -> List[Candidate]:
    """
    Main entry point - detect all clip candidates.
    
    Combines multiple detection methods:
    1. High speech density regions
    2. Silence → speech breaks
    
    Args:
        transcript: Transcript with word/segment timestamps
        min_duration: Minimum clip duration (default 15s)
        max_duration: Maximum clip duration (default 60s)
        skip_intro: Seconds to skip at start
        skip_outro: Seconds to skip at end
        
    Returns:
        List of candidates (not yet scored/ranked)
    """
    all_candidates = []
    
    # Adjust transcript time bounds
    effective_duration = transcript.duration - skip_outro
    
    # 1. High speech density regions
    density_candidates = detect_high_density_regions(
        transcript,
        min_duration=min_duration,
        max_duration=max_duration
    )
    all_candidates.extend(density_candidates)
    
    # 2. Silence → speech breaks
    silence_candidates = detect_silence_breaks(
        transcript,
        min_duration=min_duration,
        max_duration=max_duration
    )
    all_candidates.extend(silence_candidates)
    
    # Filter by time bounds
    filtered = []
    for c in all_candidates:
        if c.start >= skip_intro and c.end <= effective_duration:
            filtered.append(c)
    
    # Remove duplicates (overlapping candidates)
    deduplicated = remove_overlapping(filtered)
    
    return deduplicated


def remove_overlapping(
    candidates: List[Candidate],
    iou_threshold: float = 0.5
) -> List[Candidate]:
    """
    Remove overlapping candidates, keeping the one with higher speech density.
    
    Uses IoU (Intersection over Union) to detect overlaps.
    """
    if not candidates:
        return []
    
    # Sort by speech density (descending)
    sorted_candidates = sorted(
        candidates,
        key=lambda c: c.speech_density,
        reverse=True
    )
    
    kept = []
    
    for candidate in sorted_candidates:
        # Check if this overlaps with any kept candidate
        overlaps = False
        
        for existing in kept:
            # Calculate IoU
            intersection_start = max(candidate.start, existing.start)
            intersection_end = min(candidate.end, existing.end)
            intersection = max(0, intersection_end - intersection_start)
            
            union = (candidate.duration + existing.duration - intersection)
            
            iou = intersection / union if union > 0 else 0
            
            if iou >= iou_threshold:
                overlaps = True
                break
        
        if not overlaps:
            kept.append(candidate)
    
    return kept

"""
Angle Switching Rules

Determines when to cut between camera angles.

Rules (all deterministic):
1. Cut on sentence boundaries when possible
2. Otherwise cut every 3-5 seconds
3. NEVER cut mid-word
4. Alternate between angles (A → B → A → B)
"""

from dataclasses import dataclass
from typing import List, Optional
import random

from ..transcription import Transcript, Segment, Word


@dataclass
class AngleCut:
    """A single camera angle cut point."""
    time: float           # Cut time in seconds
    from_angle: int       # Angle index before cut (0-based)
    to_angle: int         # Angle index after cut
    reason: str           # Why cut here ("sentence_boundary", "interval", etc.)


def find_safe_cut_points(
    transcript: Transcript,
    clip_start: float,
    clip_end: float
) -> List[float]:
    """
    Find all safe cut points (between words, preferring sentence boundaries).
    
    A safe cut point is:
    1. At a sentence boundary (best)
    2. Between words with a gap (good)
    3. Never inside a word (forbidden)
    """
    safe_points = []
    
    # Get words in clip range
    words = transcript.get_words_in_range(clip_start, clip_end)
    
    if not words:
        return safe_points
    
    # Add sentence boundaries first (highest priority)
    for seg in transcript.segments:
        if clip_start < seg.end < clip_end:
            safe_points.append((seg.end, "sentence"))
        if clip_start < seg.start < clip_end:
            # Also mark sentence starts
            safe_points.append((seg.start, "sentence"))
    
    # Add gaps between words
    for i in range(len(words) - 1):
        gap_start = words[i].end
        gap_end = words[i + 1].start
        
        if gap_end - gap_start > 0.1:  # Meaningful gap
            # Put cut point in middle of gap
            cut_time = (gap_start + gap_end) / 2
            safe_points.append((cut_time, "word_gap"))
    
    # Sort by time and remove duplicates
    safe_points = sorted(set(safe_points), key=lambda x: x[0])
    
    return safe_points


def generate_angle_cuts(
    transcript: Transcript,
    clip_start: float,
    clip_end: float,
    num_angles: int = 2,
    min_interval: float = 3.0,
    max_interval: float = 5.0,
    prefer_sentence_cuts: bool = True
) -> List[AngleCut]:
    """
    Generate camera angle cuts for a clip.
    
    Args:
        transcript: Transcript with word/segment timestamps
        clip_start: Start time of clip
        clip_end: End time of clip
        num_angles: Number of camera angles available
        min_interval: Minimum seconds between cuts
        max_interval: Maximum seconds between cuts
        prefer_sentence_cuts: If True, prefer cutting on sentence boundaries
        
    Returns:
        List of AngleCut objects
    """
    if num_angles < 2:
        return []  # No cuts needed with single angle
    
    cuts = []
    
    # Find all safe cut points
    safe_points = find_safe_cut_points(transcript, clip_start, clip_end)
    
    if not safe_points:
        # No safe points - use simple interval cuts
        return generate_interval_cuts(
            clip_start, clip_end, num_angles, min_interval, max_interval
        )
    
    # Generate cuts at appropriate intervals
    current_time = clip_start
    current_angle = 0
    
    while current_time < clip_end - min_interval:
        # Target time for next cut
        target_time = current_time + (min_interval + max_interval) / 2
        
        # Find best safe cut point near target
        best_point = None
        best_distance = float('inf')
        best_type = None
        
        for point_time, point_type in safe_points:
            if point_time <= current_time + min_interval:
                continue  # Too soon
            if point_time >= clip_end - 1.0:
                continue  # Too close to end
            
            distance = abs(point_time - target_time)
            
            # Prefer sentence boundaries
            if prefer_sentence_cuts and point_type == "sentence":
                distance *= 0.5  # Reduce distance for sentence boundaries
            
            if distance < best_distance:
                best_distance = distance
                best_point = point_time
                best_type = point_type
        
        if best_point is None:
            break
        
        # Create cut
        next_angle = (current_angle + 1) % num_angles
        
        cuts.append(AngleCut(
            time=round(best_point - clip_start, 2),  # Relative to clip start
            from_angle=current_angle,
            to_angle=next_angle,
            reason=best_type or "interval"
        ))
        
        current_time = best_point
        current_angle = next_angle
    
    return cuts


def generate_interval_cuts(
    clip_start: float,
    clip_end: float,
    num_angles: int,
    min_interval: float,
    max_interval: float
) -> List[AngleCut]:
    """
    Fallback: Generate cuts at regular intervals when no transcript available.
    """
    cuts = []
    current_time = clip_start
    current_angle = 0
    
    # Use middle of interval range
    interval = (min_interval + max_interval) / 2
    
    while current_time + interval < clip_end - 1.0:
        current_time += interval
        next_angle = (current_angle + 1) % num_angles
        
        cuts.append(AngleCut(
            time=round(current_time - clip_start, 2),
            from_angle=current_angle,
            to_angle=next_angle,
            reason="interval"
        ))
        
        current_angle = next_angle
    
    return cuts


def cuts_to_ffmpeg_segments(
    cuts: List[AngleCut],
    clip_duration: float,
    angle_files: List[str]
) -> List[dict]:
    """
    Convert angle cuts to FFmpeg segment definitions.
    
    Args:
        cuts: List of angle cuts
        clip_duration: Total clip duration
        angle_files: List of video file paths for each angle
        
    Returns:
        List of segment dicts with 'file', 'start', 'end'
    """
    if not cuts:
        # No cuts - use first angle for entire clip
        return [{
            'file': angle_files[0],
            'start': 0,
            'end': clip_duration
        }]
    
    segments = []
    
    # First segment (before first cut)
    first_cut = cuts[0]
    segments.append({
        'file': angle_files[first_cut.from_angle],
        'start': 0,
        'end': first_cut.time
    })
    
    # Middle segments
    for i, cut in enumerate(cuts):
        end_time = cuts[i + 1].time if i + 1 < len(cuts) else clip_duration
        segments.append({
            'file': angle_files[cut.to_angle],
            'start': cut.time,
            'end': end_time
        })
    
    return segments

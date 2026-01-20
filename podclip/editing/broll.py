"""
B-Roll Overlay Rules

Determines when and where to overlay b-roll footage.

Rules (all deterministic):
1. Audio NEVER changes (main audio track preserved)
2. Only video is overlaid
3. B-roll triggers on silence, topic transitions, or manual marks
4. Duration: 2-5 seconds typically
"""

from dataclasses import dataclass
from typing import List, Optional

from ..transcription import Transcript


@dataclass
class BRollOverlay:
    """A single b-roll overlay segment."""
    start: float          # Start time relative to clip
    end: float            # End time relative to clip
    broll_file: str       # Path to b-roll video file
    broll_start: float    # Start time within b-roll file
    reason: str           # Why b-roll here ("silence", "transition", etc.)
    
    @property
    def duration(self) -> float:
        return self.end - self.start


def find_silence_regions(
    transcript: Transcript,
    clip_start: float,
    clip_end: float,
    min_silence: float = 1.5,
    max_silence: float = 5.0
) -> List[tuple]:
    """
    Find silence regions (gaps between words) suitable for b-roll.
    
    Returns list of (start, end) tuples relative to clip start.
    """
    silences = []
    
    words = transcript.get_words_in_range(clip_start, clip_end)
    
    if len(words) < 2:
        return silences
    
    for i in range(len(words) - 1):
        gap_start = words[i].end
        gap_end = words[i + 1].start
        gap_duration = gap_end - gap_start
        
        if min_silence <= gap_duration <= max_silence:
            # Convert to clip-relative times
            silences.append((
                gap_start - clip_start,
                gap_end - clip_start
            ))
    
    return silences


def find_topic_transitions(
    transcript: Transcript,
    clip_start: float,
    clip_end: float
) -> List[float]:
    """
    Find topic transition points (sentence boundaries with pauses).
    
    Returns list of times relative to clip start.
    """
    transitions = []
    
    words = transcript.get_words_in_range(clip_start, clip_end)
    segments = transcript.get_segments_in_range(clip_start, clip_end)
    
    # Look for sentence endings followed by pauses
    for seg in segments:
        if clip_start < seg.end < clip_end - 2:
            # Check if there's a pause after this sentence
            for word in words:
                if abs(word.start - seg.end) < 0.5:
                    # Next word starts close to sentence end
                    break
            else:
                # No immediate next word - this is a topic transition
                transitions.append(seg.end - clip_start)
    
    return transitions


def generate_broll_overlays(
    transcript: Transcript,
    clip_start: float,
    clip_end: float,
    broll_files: List[str],
    overlay_duration: float = 3.0,
    max_overlays: int = 3
) -> List[BRollOverlay]:
    """
    Generate b-roll overlay points for a clip.
    
    Args:
        transcript: Transcript with word timestamps
        clip_start: Start time of clip
        clip_end: End time of clip
        broll_files: List of available b-roll video files
        overlay_duration: Default duration for each overlay
        max_overlays: Maximum number of b-roll overlays per clip
        
    Returns:
        List of BRollOverlay objects
    """
    if not broll_files:
        return []
    
    overlays = []
    clip_duration = clip_end - clip_start
    
    # Find silence regions (best for b-roll)
    silences = find_silence_regions(transcript, clip_start, clip_end)
    
    # Find topic transitions
    transitions = find_topic_transitions(transcript, clip_start, clip_end)
    
    # Combine and sort potential overlay points
    candidates = []
    
    for start, end in silences:
        candidates.append({
            'time': start,
            'duration': min(end - start + 1, overlay_duration),
            'reason': 'silence',
            'priority': 1
        })
    
    for time in transitions:
        candidates.append({
            'time': time,
            'duration': overlay_duration,
            'reason': 'transition',
            'priority': 2
        })
    
    # Sort by priority then time
    candidates.sort(key=lambda x: (x['priority'], x['time']))
    
    # Select non-overlapping overlays
    broll_index = 0
    last_end = -float('inf')
    
    for candidate in candidates:
        if len(overlays) >= max_overlays:
            break
        
        start = candidate['time']
        duration = candidate['duration']
        end = min(start + duration, clip_duration)
        
        # Check for overlap with previous
        if start < last_end + 1.0:
            continue
        
        # Ensure within clip bounds
        if start < 0 or end > clip_duration:
            continue
        
        # Select b-roll file (round-robin)
        broll_file = broll_files[broll_index % len(broll_files)]
        broll_index += 1
        
        overlays.append(BRollOverlay(
            start=round(start, 2),
            end=round(end, 2),
            broll_file=broll_file,
            broll_start=0.0,  # Start from beginning of b-roll
            reason=candidate['reason']
        ))
        
        last_end = end
    
    return overlays


def overlays_to_ffmpeg_filter(
    overlays: List[BRollOverlay],
    main_stream: str = "[0:v]"
) -> str:
    """
    Generate FFmpeg filter_complex for b-roll overlays.
    
    Note: Audio is NOT modified - only video is overlaid.
    
    Args:
        overlays: List of b-roll overlays
        main_stream: FFmpeg stream label for main video
        
    Returns:
        FFmpeg filter_complex string
    """
    if not overlays:
        return ""
    
    filters = []
    
    # For each overlay, we need to:
    # 1. Trim the b-roll
    # 2. Overlay it on the main video at the right time
    
    current_stream = main_stream
    
    for i, overlay in enumerate(overlays):
        broll_input = f"[{i + 1}:v]"  # Assuming b-rolls are inputs 1, 2, 3, ...
        
        # Trim b-roll to duration
        trim_filter = f"{broll_input}trim=start={overlay.broll_start}:end={overlay.broll_start + overlay.duration},setpts=PTS-STARTPTS[broll{i}]"
        filters.append(trim_filter)
        
        # Overlay with enable filter for timing
        overlay_filter = (
            f"{current_stream}[broll{i}]overlay=enable='between(t,{overlay.start},{overlay.end})'"
        )
        
        if i < len(overlays) - 1:
            overlay_filter += f"[v{i}]"
            current_stream = f"[v{i}]"
        else:
            overlay_filter += "[vout]"
        
        filters.append(overlay_filter)
    
    return ";".join(filters)

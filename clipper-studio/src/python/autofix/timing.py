"""
Timing auto-fixer for Clipper Studio.

Fixes timing-related issues:
- Caption timing drift from transcript
- Audio/video sync issues
- Clip boundary alignment

IMPORTANT: Max timing shift is ±250ms to preserve intent.
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class TimingFixResult:
    """Result of a timing fix operation."""
    success: bool
    data: Dict | List
    shifts_applied: List[str]
    total_shift_ms: float


class TimingFixer:
    """Fixes timing synchronization issues."""
    
    def __init__(
        self,
        max_shift: float = 0.25,  # Maximum ±250ms shift
    ):
        self.max_shift = max_shift
    
    def fix_caption_drift(
        self,
        captions: List[Dict],
        transcript_words: List[Dict],
        max_drift: float = 0.5,
    ) -> TimingFixResult:
        """
        Fix caption timing drift by realigning to transcript.
        
        Args:
            captions: List of caption objects
            transcript_words: Original transcript words
            max_drift: Maximum drift that can be fixed
        
        Returns:
            TimingFixResult with corrected captions
        """
        if not captions or not transcript_words:
            return TimingFixResult(
                success=True,
                data=captions,
                shifts_applied=[],
                total_shift_ms=0,
            )
        
        # Build word lookup by text
        word_lookup = {}
        for word in transcript_words:
            text = word.get('word', word.get('text', '')).lower().strip()
            if text and text not in word_lookup:
                word_lookup[text] = word
        
        fixed_captions = []
        shifts_applied = []
        total_shift = 0.0
        
        for i, caption in enumerate(captions):
            fixed_caption = dict(caption)
            cap_text = caption.get('text', caption.get('word', '')).lower().strip()
            cap_start = caption.get('start', caption.get('startTime', 0))
            
            # Try to find matching word in transcript
            # For multi-word captions, use the first word
            first_word = cap_text.split()[0] if cap_text else ''
            
            if first_word in word_lookup:
                trans_word = word_lookup[first_word]
                trans_start = trans_word.get('start', trans_word.get('startTime', 0))
                drift = cap_start - trans_start
                
                # Only fix if within allowed drift range
                if abs(drift) <= max_drift and abs(drift) <= self.max_shift:
                    # Shift caption back to transcript timing
                    cap_end = caption.get('end', caption.get('endTime', 0))
                    duration = cap_end - cap_start
                    
                    new_start = trans_start
                    new_end = trans_start + duration
                    
                    fixed_caption['start'] = round(new_start, 3)
                    fixed_caption['end'] = round(new_end, 3)
                    fixed_caption['startTime'] = round(new_start, 3)
                    fixed_caption['endTime'] = round(new_end, 3)
                    
                    shifts_applied.append(
                        f"caption_{i}_shifted_{drift*1000:.0f}ms"
                    )
                    total_shift += abs(drift)
            
            fixed_captions.append(fixed_caption)
        
        return TimingFixResult(
            success=True,
            data=fixed_captions,
            shifts_applied=shifts_applied,
            total_shift_ms=total_shift * 1000,
        )
    
    def fix_clip_sync(
        self,
        clip: Dict,
        audio_offset: float = 0.0,
        video_offset: float = 0.0,
    ) -> TimingFixResult:
        """
        Fix audio/video sync by applying offset to clip.
        
        Args:
            clip: Clip data
            audio_offset: Audio offset in seconds (positive = audio ahead)
            video_offset: Video offset in seconds (positive = video ahead)
        
        Returns:
            TimingFixResult with adjusted clip
        """
        # Calculate net offset to apply
        net_offset = audio_offset - video_offset
        
        if abs(net_offset) > self.max_shift:
            return TimingFixResult(
                success=False,
                data=clip,
                shifts_applied=[],
                total_shift_ms=0,
            )
        
        if abs(net_offset) < 0.001:  # < 1ms, no fix needed
            return TimingFixResult(
                success=True,
                data=clip,
                shifts_applied=[],
                total_shift_ms=0,
            )
        
        fixed_clip = dict(clip)
        
        # Apply offset to clip timing
        start = clip.get('start', clip.get('startTime', 0))
        end = clip.get('end', clip.get('endTime', 0))
        
        # Positive net_offset means audio is ahead, so shift video start earlier
        new_start = start - net_offset
        new_end = end - net_offset
        
        if new_start < 0:
            # Can't go below 0, shift proportionally
            new_end -= new_start
            new_start = 0
        
        fixed_clip['start'] = round(new_start, 3)
        fixed_clip['end'] = round(new_end, 3)
        fixed_clip['startTime'] = round(new_start, 3)
        fixed_clip['endTime'] = round(new_end, 3)
        
        # Store sync metadata
        fixed_clip.setdefault('autofix', {})
        fixed_clip['autofix']['sync'] = {
            'audio_offset': audio_offset,
            'video_offset': video_offset,
            'net_shift': net_offset,
        }
        
        return TimingFixResult(
            success=True,
            data=fixed_clip,
            shifts_applied=[f"sync_shift_{net_offset*1000:.0f}ms"],
            total_shift_ms=abs(net_offset) * 1000,
        )
    
    def align_to_frame_boundary(
        self,
        time: float,
        fps: float = 30.0,
        direction: str = 'nearest',  # 'nearest', 'floor', 'ceil'
    ) -> float:
        """
        Align a time value to the nearest frame boundary.
        
        Args:
            time: Time in seconds
            fps: Frame rate
            direction: How to round ('nearest', 'floor', 'ceil')
        
        Returns:
            Time aligned to frame boundary
        """
        frame_duration = 1.0 / fps
        
        if direction == 'floor':
            frame_num = int(time / frame_duration)
        elif direction == 'ceil':
            frame_num = int(time / frame_duration) + 1
        else:  # nearest
            frame_num = round(time / frame_duration)
        
        return round(frame_num * frame_duration, 6)
    
    def fix_frame_alignment(
        self,
        clip: Dict,
        fps: float = 30.0,
    ) -> TimingFixResult:
        """
        Align clip boundaries to frame boundaries.
        
        Args:
            clip: Clip data
            fps: Video frame rate
        
        Returns:
            TimingFixResult with frame-aligned clip
        """
        start = clip.get('start', clip.get('startTime', 0))
        end = clip.get('end', clip.get('endTime', 0))
        
        # Align start to floor (don't include partial frame at start)
        new_start = self.align_to_frame_boundary(start, fps, 'ceil')
        # Align end to ceil (include partial frame at end)
        new_end = self.align_to_frame_boundary(end, fps, 'floor')
        
        # Check if alignment is within max_shift
        start_shift = abs(new_start - start)
        end_shift = abs(new_end - end)
        
        if start_shift > self.max_shift or end_shift > self.max_shift:
            return TimingFixResult(
                success=False,
                data=clip,
                shifts_applied=[],
                total_shift_ms=0,
            )
        
        fixed_clip = dict(clip)
        fixed_clip['start'] = round(new_start, 3)
        fixed_clip['end'] = round(new_end, 3)
        fixed_clip['startTime'] = round(new_start, 3)
        fixed_clip['endTime'] = round(new_end, 3)
        fixed_clip['duration'] = round(new_end - new_start, 3)
        
        total_shift = start_shift + end_shift
        
        return TimingFixResult(
            success=True,
            data=fixed_clip,
            shifts_applied=[
                f"start_aligned_{start_shift*1000:.0f}ms",
                f"end_aligned_{end_shift*1000:.0f}ms",
            ] if total_shift > 0.001 else [],
            total_shift_ms=total_shift * 1000,
        )


def calculate_timing_offset(
    reference_times: List[float],
    actual_times: List[float],
) -> Tuple[float, float]:
    """
    Calculate average timing offset between reference and actual times.
    
    Args:
        reference_times: Expected times
        actual_times: Actual observed times
    
    Returns:
        Tuple of (mean_offset, std_offset)
    """
    if not reference_times or not actual_times:
        return (0.0, 0.0)
    
    if len(reference_times) != len(actual_times):
        # Use minimum length
        min_len = min(len(reference_times), len(actual_times))
        reference_times = reference_times[:min_len]
        actual_times = actual_times[:min_len]
    
    offsets = [a - r for r, a in zip(reference_times, actual_times)]
    
    if not offsets:
        return (0.0, 0.0)
    
    mean_offset = sum(offsets) / len(offsets)
    
    if len(offsets) > 1:
        variance = sum((o - mean_offset) ** 2 for o in offsets) / len(offsets)
        std_offset = variance ** 0.5
    else:
        std_offset = 0.0
    
    return (mean_offset, std_offset)

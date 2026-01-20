"""
Trim auto-fixer for Clipper Studio.

Fixes clip boundary issues:
- Clips that are too short (pad if possible)
- Clips that are too long (trim)
- Clips that cut mid-word (snap to word boundary)

IMPORTANT: Max adjustment is ±250ms to preserve intent.
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class TrimResult:
    """Result of a trim fix operation."""
    success: bool
    clip: Dict
    adjustments: List[str]
    original_start: float
    original_end: float
    new_start: float
    new_end: float


class TrimFixer:
    """Fixes clip boundary issues through minimal trimming."""
    
    def __init__(
        self,
        max_adjustment: float = 0.25,      # Max ±250ms adjustment
        min_duration: float = 15.0,
        max_duration: float = 60.0,
        word_snap_window: float = 0.25,    # Window for word boundary snapping
    ):
        self.max_adjustment = max_adjustment
        self.min_duration = min_duration
        self.max_duration = max_duration
        self.word_snap_window = word_snap_window
    
    def fix(
        self,
        clip: Dict,
        errors: List[Dict],
        transcript_words: Optional[List[Dict]] = None,
        media_duration: Optional[float] = None,
    ) -> TrimResult:
        """
        Attempt to fix clip boundary issues.
        
        Args:
            clip: Clip data with 'start', 'end' fields
            errors: List of validation errors (from ValidationResult.errors)
            transcript_words: Optional transcript for word boundary snapping
            media_duration: Total media duration for bounds checking
        
        Returns:
            TrimResult with success status and adjusted clip
        """
        original_start = clip.get('start', clip.get('startTime', 0))
        original_end = clip.get('end', clip.get('endTime', 0))
        
        new_start = original_start
        new_end = original_end
        adjustments = []
        
        # Process each error
        for error in errors:
            code = error.get('code', '') if isinstance(error, dict) else error.code
            
            if code == "CLIP_TOO_SHORT":
                result = self._fix_too_short(
                    new_start, new_end,
                    media_duration=media_duration,
                )
                if result:
                    new_start, new_end, adj = result
                    adjustments.append(adj)
            
            elif code == "CLIP_TOO_LONG":
                result = self._fix_too_long(new_start, new_end)
                if result:
                    new_start, new_end, adj = result
                    adjustments.append(adj)
            
            elif code == "CLIP_CUTS_MID_WORD_START":
                details = error.get('details', {}) if isinstance(error, dict) else error.details
                result = self._fix_mid_word_start(
                    new_start, new_end,
                    transcript_words,
                    details,
                )
                if result:
                    new_start, new_end, adj = result
                    adjustments.append(adj)
            
            elif code == "CLIP_CUTS_MID_WORD_END":
                details = error.get('details', {}) if isinstance(error, dict) else error.details
                result = self._fix_mid_word_end(
                    new_start, new_end,
                    transcript_words,
                    details,
                )
                if result:
                    new_start, new_end, adj = result
                    adjustments.append(adj)
        
        # Validate final bounds
        duration = new_end - new_start
        valid = (
            self.min_duration <= duration <= self.max_duration and
            new_start >= 0 and
            (media_duration is None or new_end <= media_duration)
        )
        
        # Create fixed clip
        fixed_clip = {**clip}
        fixed_clip['start'] = round(new_start, 3)
        fixed_clip['end'] = round(new_end, 3)
        fixed_clip['startTime'] = round(new_start, 3)
        fixed_clip['endTime'] = round(new_end, 3)
        fixed_clip['duration'] = round(new_end - new_start, 3)
        
        if adjustments:
            fixed_clip.setdefault('autofix', {})
            fixed_clip['autofix']['trim'] = adjustments
        
        return TrimResult(
            success=valid,
            clip=fixed_clip,
            adjustments=adjustments,
            original_start=original_start,
            original_end=original_end,
            new_start=new_start,
            new_end=new_end,
        )
    
    def _fix_too_short(
        self,
        start: float,
        end: float,
        media_duration: Optional[float] = None,
    ) -> Optional[Tuple[float, float, str]]:
        """
        Attempt to extend a too-short clip.
        
        Strategy: Extend equally from both ends, respecting max_adjustment.
        """
        duration = end - start
        needed = self.min_duration - duration
        
        if needed <= 0:
            return None
        
        # Can we fix within max_adjustment per side?
        per_side = needed / 2
        if per_side > self.max_adjustment:
            # Can't fix within bounds
            return None
        
        new_start = start - per_side
        new_end = end + per_side
        
        # Clamp to media bounds
        if new_start < 0:
            # Shift the extension to the end
            new_end += abs(new_start)
            new_start = 0
        
        if media_duration is not None and new_end > media_duration:
            # Shift extension to the start
            overflow = new_end - media_duration
            new_start = max(0, new_start - overflow)
            new_end = media_duration
        
        return (
            new_start,
            new_end,
            f"extended_both_ends_by_{per_side*1000:.0f}ms",
        )
    
    def _fix_too_long(
        self,
        start: float,
        end: float,
    ) -> Optional[Tuple[float, float, str]]:
        """
        Attempt to trim a too-long clip.
        
        Strategy: Trim from end, respecting max_adjustment.
        """
        duration = end - start
        excess = duration - self.max_duration
        
        if excess <= 0:
            return None
        
        if excess > self.max_adjustment:
            # Can't fix within bounds
            return None
        
        new_end = end - excess
        return (start, new_end, f"trimmed_end_by_{excess*1000:.0f}ms")
    
    def _fix_mid_word_start(
        self,
        start: float,
        end: float,
        words: Optional[List[Dict]],
        error_details: Dict,
    ) -> Optional[Tuple[float, float, str]]:
        """
        Snap start to nearest word boundary.
        """
        if not words:
            # Try using error details
            word_start = error_details.get('word_start')
            if word_start is not None:
                adjustment = start - word_start
                if abs(adjustment) <= self.max_adjustment:
                    return (word_start, end, f"snapped_start_to_word_boundary")
            return None
        
        # Find nearest word start
        best_word_start = None
        best_delta = self.max_adjustment + 1
        
        for word in words:
            word_start = word.get('start', word.get('startTime', 0))
            delta = abs(word_start - start)
            if delta <= self.word_snap_window and delta < best_delta:
                best_word_start = word_start
                best_delta = delta
        
        if best_word_start is not None:
            adjustment = abs(start - best_word_start)
            if adjustment <= self.max_adjustment:
                return (best_word_start, end, f"snapped_start_to_word_boundary_{adjustment*1000:.0f}ms")
        
        return None
    
    def _fix_mid_word_end(
        self,
        start: float,
        end: float,
        words: Optional[List[Dict]],
        error_details: Dict,
    ) -> Optional[Tuple[float, float, str]]:
        """
        Snap end to nearest word boundary.
        """
        if not words:
            # Try using error details
            word_end = error_details.get('word_end')
            if word_end is not None:
                adjustment = word_end - end
                if abs(adjustment) <= self.max_adjustment:
                    return (start, word_end, f"snapped_end_to_word_boundary")
            return None
        
        # Find nearest word end
        best_word_end = None
        best_delta = self.max_adjustment + 1
        
        for word in words:
            word_end = word.get('end', word.get('endTime', 0))
            delta = abs(word_end - end)
            if delta <= self.word_snap_window and delta < best_delta:
                best_word_end = word_end
                best_delta = delta
        
        if best_word_end is not None:
            adjustment = abs(end - best_word_end)
            if adjustment <= self.max_adjustment:
                return (start, best_word_end, f"snapped_end_to_word_boundary_{adjustment*1000:.0f}ms")
        
        return None


def adjust_clip_boundaries(
    clip: Dict,
    start_delta: float = 0.0,
    end_delta: float = 0.0,
    max_adjustment: float = 0.25,
) -> Optional[Dict]:
    """
    Utility to adjust clip boundaries within limits.
    
    Args:
        clip: Clip dictionary
        start_delta: Amount to adjust start (negative = earlier)
        end_delta: Amount to adjust end (positive = later)
        max_adjustment: Maximum allowed adjustment per side
    
    Returns:
        Adjusted clip or None if adjustment exceeds limits
    """
    if abs(start_delta) > max_adjustment or abs(end_delta) > max_adjustment:
        return None
    
    start = clip.get('start', clip.get('startTime', 0))
    end = clip.get('end', clip.get('endTime', 0))
    
    new_start = start + start_delta
    new_end = end + end_delta
    
    if new_start < 0 or new_end <= new_start:
        return None
    
    return {
        **clip,
        'start': round(new_start, 3),
        'end': round(new_end, 3),
        'startTime': round(new_start, 3),
        'endTime': round(new_end, 3),
        'duration': round(new_end - new_start, 3),
    }

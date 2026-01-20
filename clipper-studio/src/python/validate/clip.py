"""
Clip structural validation for Clipper Studio.

Checks:
- Duration within bounds [min_duration, max_duration]
- Starts on word boundary (if transcript available)
- Ends on word boundary (if transcript available)  
- No overlap with other clips

These are MECHANICAL checks, not quality judgments.
"""

from typing import Dict, List, Optional, Tuple
from .result import ValidationResult, ErrorSeverity


class ClipValidator:
    """Validates clip structural integrity."""
    
    def __init__(
        self,
        min_duration: float = 15.0,
        max_duration: float = 60.0,
        word_boundary_tolerance: float = 0.25,  # seconds
    ):
        self.min_duration = min_duration
        self.max_duration = max_duration
        self.word_boundary_tolerance = word_boundary_tolerance
    
    def validate(
        self,
        clip: Dict,
        transcript_words: Optional[List[Dict]] = None,
        other_clips: Optional[List[Dict]] = None,
    ) -> ValidationResult:
        """
        Validate a single clip.
        
        Args:
            clip: Clip data with 'start', 'end', 'id' fields
            transcript_words: Optional list of word objects with 'start', 'end' times
            other_clips: Optional list of other clips to check for overlap
        
        Returns:
            ValidationResult with any errors found
        """
        result = ValidationResult(
            valid=True,
            item_id=clip.get('id', 'unknown'),
            validator_name='ClipValidator',
        )
        
        start = clip.get('start', clip.get('startTime', 0))
        end = clip.get('end', clip.get('endTime', 0))
        duration = end - start
        
        # Check duration bounds
        self._check_duration(result, duration, clip)
        
        # Check word boundaries if transcript available
        if transcript_words:
            self._check_word_boundaries(result, start, end, transcript_words)
        
        # Check overlap with other clips
        if other_clips:
            self._check_overlap(result, clip, other_clips)
        
        return result
    
    def validate_batch(
        self,
        clips: List[Dict],
        transcript_words: Optional[List[Dict]] = None,
    ) -> List[ValidationResult]:
        """Validate multiple clips, including overlap checks."""
        results = []
        for i, clip in enumerate(clips):
            # Other clips = all clips except this one
            other_clips = clips[:i] + clips[i+1:]
            result = self.validate(clip, transcript_words, other_clips)
            results.append(result)
        return results
    
    def _check_duration(self, result: ValidationResult, duration: float, clip: Dict):
        """Check if duration is within acceptable bounds."""
        if duration < self.min_duration:
            result.add_error(
                code="CLIP_TOO_SHORT",
                message=f"Clip duration {duration:.1f}s is below minimum {self.min_duration}s",
                severity=ErrorSeverity.ERROR,
                field="duration",
                actual=duration,
                minimum=self.min_duration,
            )
        elif duration > self.max_duration:
            result.add_error(
                code="CLIP_TOO_LONG",
                message=f"Clip duration {duration:.1f}s exceeds maximum {self.max_duration}s",
                severity=ErrorSeverity.ERROR,
                field="duration",
                actual=duration,
                maximum=self.max_duration,
            )
    
    def _check_word_boundaries(
        self,
        result: ValidationResult,
        start: float,
        end: float,
        words: List[Dict],
    ):
        """Check if clip starts/ends on word boundaries."""
        if not words:
            return
        
        # Find nearest word to start
        start_on_boundary = False
        for word in words:
            word_start = word.get('start', word.get('startTime', 0))
            if abs(word_start - start) <= self.word_boundary_tolerance:
                start_on_boundary = True
                break
        
        if not start_on_boundary:
            # Check if we're cutting mid-word
            for word in words:
                word_start = word.get('start', word.get('startTime', 0))
                word_end = word.get('end', word.get('endTime', 0))
                if word_start < start < word_end:
                    result.add_error(
                        code="CLIP_CUTS_MID_WORD_START",
                        message=f"Clip starts mid-word at {start:.2f}s",
                        severity=ErrorSeverity.ERROR,
                        field="start",
                        clip_start=start,
                        word_start=word_start,
                        word_end=word_end,
                        word_text=word.get('word', word.get('text', '')),
                    )
                    break
        
        # Find nearest word to end
        end_on_boundary = False
        for word in words:
            word_end = word.get('end', word.get('endTime', 0))
            if abs(word_end - end) <= self.word_boundary_tolerance:
                end_on_boundary = True
                break
        
        if not end_on_boundary:
            # Check if we're cutting mid-word
            for word in words:
                word_start = word.get('start', word.get('startTime', 0))
                word_end = word.get('end', word.get('endTime', 0))
                if word_start < end < word_end:
                    result.add_error(
                        code="CLIP_CUTS_MID_WORD_END",
                        message=f"Clip ends mid-word at {end:.2f}s",
                        severity=ErrorSeverity.ERROR,
                        field="end",
                        clip_end=end,
                        word_start=word_start,
                        word_end=word_end,
                        word_text=word.get('word', word.get('text', '')),
                    )
                    break
    
    def _check_overlap(
        self,
        result: ValidationResult,
        clip: Dict,
        other_clips: List[Dict],
    ):
        """Check if clip overlaps with any other clips."""
        clip_id = clip.get('id', 'unknown')
        clip_start = clip.get('start', clip.get('startTime', 0))
        clip_end = clip.get('end', clip.get('endTime', 0))
        
        for other in other_clips:
            other_id = other.get('id', 'unknown')
            other_start = other.get('start', other.get('startTime', 0))
            other_end = other.get('end', other.get('endTime', 0))
            
            # Check for overlap: A overlaps B if A.start < B.end AND A.end > B.start
            if clip_start < other_end and clip_end > other_start:
                overlap_start = max(clip_start, other_start)
                overlap_end = min(clip_end, other_end)
                overlap_duration = overlap_end - overlap_start
                
                result.add_error(
                    code="CLIP_OVERLAP",
                    message=f"Clip overlaps with {other_id} by {overlap_duration:.1f}s",
                    severity=ErrorSeverity.ERROR,
                    field="bounds",
                    other_clip_id=other_id,
                    overlap_start=overlap_start,
                    overlap_end=overlap_end,
                    overlap_duration=overlap_duration,
                )


def find_word_at_time(words: List[Dict], time: float) -> Optional[Dict]:
    """Find the word that contains the given time."""
    for word in words:
        word_start = word.get('start', word.get('startTime', 0))
        word_end = word.get('end', word.get('endTime', 0))
        if word_start <= time <= word_end:
            return word
    return None


def find_nearest_word_boundary(
    words: List[Dict],
    time: float,
    boundary: str = 'start',  # 'start' or 'end'
    search_window: float = 2.0,
) -> Optional[Tuple[float, Dict]]:
    """
    Find the nearest word boundary to the given time.
    
    Args:
        words: List of word objects
        time: Target time in seconds
        boundary: Which word boundary to find ('start' or 'end')
        search_window: How far to search in seconds
    
    Returns:
        Tuple of (boundary_time, word) or None if not found
    """
    best_time = None
    best_word = None
    best_delta = search_window + 1.0
    
    for word in words:
        if boundary == 'start':
            word_time = word.get('start', word.get('startTime', 0))
        else:
            word_time = word.get('end', word.get('endTime', 0))
        
        delta = abs(word_time - time)
        if delta <= search_window and delta < best_delta:
            best_time = word_time
            best_word = word
            best_delta = delta
    
    if best_time is not None:
        return (best_time, best_word)
    return None

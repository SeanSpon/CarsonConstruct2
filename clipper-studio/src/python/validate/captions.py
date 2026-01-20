"""
Caption validation for Clipper Studio.

Checks:
- No overlapping subtitle ranges
- Max words per line (default ≤6)
- Highlight word exists in caption
- Caption timing ⊆ clip timing (captions within clip bounds)

These are MECHANICAL checks, not content quality judgments.
"""

from typing import Dict, List, Optional
from .result import ValidationResult, ErrorSeverity


class CaptionValidator:
    """Validates caption/subtitle data."""
    
    def __init__(
        self,
        max_words_per_line: int = 6,
        max_caption_duration: float = 5.0,  # seconds
        min_caption_duration: float = 0.3,  # seconds
    ):
        self.max_words_per_line = max_words_per_line
        self.max_caption_duration = max_caption_duration
        self.min_caption_duration = min_caption_duration
    
    def validate(
        self,
        captions: List[Dict],
        clip_start: Optional[float] = None,
        clip_end: Optional[float] = None,
    ) -> ValidationResult:
        """
        Validate captions for a single clip.
        
        Args:
            captions: List of caption objects with 'start', 'end', 'text' fields
            clip_start: Optional clip start time for bounds checking
            clip_end: Optional clip end time for bounds checking
        
        Returns:
            ValidationResult with any errors found
        """
        result = ValidationResult(
            valid=True,
            validator_name='CaptionValidator',
        )
        
        if not captions:
            return result
        
        # Sort captions by start time
        sorted_captions = sorted(
            captions,
            key=lambda c: c.get('start', c.get('startTime', 0))
        )
        
        # Check each caption
        for i, caption in enumerate(sorted_captions):
            self._check_caption(result, caption, i)
        
        # Check for overlaps between captions
        self._check_overlaps(result, sorted_captions)
        
        # Check captions are within clip bounds
        if clip_start is not None and clip_end is not None:
            self._check_clip_bounds(result, sorted_captions, clip_start, clip_end)
        
        return result
    
    def _check_caption(self, result: ValidationResult, caption: Dict, index: int):
        """Check a single caption for issues."""
        start = caption.get('start', caption.get('startTime', 0))
        end = caption.get('end', caption.get('endTime', 0))
        text = caption.get('text', caption.get('word', ''))
        duration = end - start
        
        # Check duration
        if duration < self.min_caption_duration:
            result.add_error(
                code="CAPTION_TOO_SHORT",
                message=f"Caption {index} duration {duration:.2f}s is too short",
                severity=ErrorSeverity.WARNING,
                field=f"captions[{index}].duration",
                caption_index=index,
                duration=duration,
            )
        elif duration > self.max_caption_duration:
            result.add_error(
                code="CAPTION_TOO_LONG",
                message=f"Caption {index} duration {duration:.2f}s exceeds maximum",
                severity=ErrorSeverity.WARNING,
                field=f"captions[{index}].duration",
                caption_index=index,
                duration=duration,
            )
        
        # Check word count
        words = text.strip().split() if text else []
        if len(words) > self.max_words_per_line:
            result.add_error(
                code="CAPTION_TOO_MANY_WORDS",
                message=f"Caption {index} has {len(words)} words (max {self.max_words_per_line})",
                severity=ErrorSeverity.ERROR,
                field=f"captions[{index}].text",
                caption_index=index,
                word_count=len(words),
                max_words=self.max_words_per_line,
            )
        
        # Check for highlight word if specified
        highlight = caption.get('highlight', caption.get('highlightWord'))
        if highlight:
            if highlight.lower() not in text.lower():
                result.add_error(
                    code="CAPTION_HIGHLIGHT_MISSING",
                    message=f"Caption {index} highlight word '{highlight}' not found in text",
                    severity=ErrorSeverity.ERROR,
                    field=f"captions[{index}].highlight",
                    caption_index=index,
                    highlight_word=highlight,
                    caption_text=text,
                )
    
    def _check_overlaps(self, result: ValidationResult, captions: List[Dict]):
        """Check for overlapping caption ranges."""
        for i in range(len(captions) - 1):
            current = captions[i]
            next_cap = captions[i + 1]
            
            current_end = current.get('end', current.get('endTime', 0))
            next_start = next_cap.get('start', next_cap.get('startTime', 0))
            
            if current_end > next_start:
                overlap = current_end - next_start
                result.add_error(
                    code="CAPTION_OVERLAP",
                    message=f"Captions {i} and {i+1} overlap by {overlap:.2f}s",
                    severity=ErrorSeverity.ERROR,
                    field=f"captions[{i}]",
                    caption_index=i,
                    next_caption_index=i + 1,
                    overlap_duration=overlap,
                    current_end=current_end,
                    next_start=next_start,
                )
    
    def _check_clip_bounds(
        self,
        result: ValidationResult,
        captions: List[Dict],
        clip_start: float,
        clip_end: float,
    ):
        """Check that all captions are within clip bounds."""
        for i, caption in enumerate(captions):
            cap_start = caption.get('start', caption.get('startTime', 0))
            cap_end = caption.get('end', caption.get('endTime', 0))
            
            if cap_start < clip_start:
                result.add_error(
                    code="CAPTION_BEFORE_CLIP",
                    message=f"Caption {i} starts before clip ({cap_start:.2f}s < {clip_start:.2f}s)",
                    severity=ErrorSeverity.ERROR,
                    field=f"captions[{i}].start",
                    caption_index=i,
                    caption_start=cap_start,
                    clip_start=clip_start,
                )
            
            if cap_end > clip_end:
                result.add_error(
                    code="CAPTION_AFTER_CLIP",
                    message=f"Caption {i} ends after clip ({cap_end:.2f}s > {clip_end:.2f}s)",
                    severity=ErrorSeverity.ERROR,
                    field=f"captions[{i}].end",
                    caption_index=i,
                    caption_end=cap_end,
                    clip_end=clip_end,
                )


def validate_caption_timing_drift(
    captions: List[Dict],
    transcript_words: List[Dict],
    max_drift: float = 0.5,
) -> ValidationResult:
    """
    Check if captions have drifted from transcript timing.
    
    Args:
        captions: List of caption objects
        transcript_words: Original transcript words
        max_drift: Maximum allowed drift in seconds
    
    Returns:
        ValidationResult with drift errors
    """
    result = ValidationResult(
        valid=True,
        validator_name='CaptionTimingDrift',
    )
    
    if not captions or not transcript_words:
        return result
    
    # Build word lookup by text
    word_lookup = {}
    for word in transcript_words:
        text = word.get('word', word.get('text', '')).lower().strip()
        if text and text not in word_lookup:
            word_lookup[text] = word
    
    # Check each caption word against transcript
    for i, caption in enumerate(captions):
        cap_text = caption.get('text', caption.get('word', '')).lower().strip()
        cap_start = caption.get('start', caption.get('startTime', 0))
        
        if cap_text in word_lookup:
            transcript_word = word_lookup[cap_text]
            trans_start = transcript_word.get('start', transcript_word.get('startTime', 0))
            drift = abs(cap_start - trans_start)
            
            if drift > max_drift:
                result.add_error(
                    code="CAPTION_TIMING_DRIFT",
                    message=f"Caption '{cap_text}' drifted {drift:.2f}s from transcript",
                    severity=ErrorSeverity.WARNING,
                    field=f"captions[{i}]",
                    caption_index=i,
                    drift_seconds=drift,
                    caption_start=cap_start,
                    transcript_start=trans_start,
                )
    
    return result

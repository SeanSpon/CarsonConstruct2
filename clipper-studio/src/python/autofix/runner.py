"""
Auto-fix runner/orchestrator for Clipper Studio.

Coordinates all auto-fix operations in a single pass.
IMPORTANT: Only one fix attempt per clip - prevents infinite loops.
"""

from typing import Dict, List, Optional
from dataclasses import dataclass, field

from .trim import TrimFixer
from .captions import CaptionFixer
from .timing import TimingFixer


@dataclass
class AutoFixResult:
    """Result of running auto-fix on a clip."""
    clip_id: str
    success: bool
    clip: Dict
    captions: List[Dict]
    fixes_applied: List[str]
    remaining_errors: List[str]
    dropped: bool = False


@dataclass
class BatchAutoFixResult:
    """Result of running auto-fix on multiple clips."""
    total: int
    fixed: int
    dropped: int
    passed_through: int
    results: List[AutoFixResult] = field(default_factory=list)
    
    @property
    def summary(self) -> str:
        return (
            f"Auto-fix: {self.fixed}/{self.total} fixed, "
            f"{self.dropped} dropped, {self.passed_through} unchanged"
        )


class AutoFixRunner:
    """
    Orchestrates all auto-fix operations.
    
    CRITICAL RULE: Only ONE fix pass per clip.
    If clip still fails after fix pass → drop it.
    """
    
    def __init__(
        self,
        trim_fixer: Optional[TrimFixer] = None,
        caption_fixer: Optional[CaptionFixer] = None,
        timing_fixer: Optional[TimingFixer] = None,
    ):
        self.trim_fixer = trim_fixer or TrimFixer()
        self.caption_fixer = caption_fixer or CaptionFixer()
        self.timing_fixer = timing_fixer or TimingFixer()
    
    def fix_clip(
        self,
        clip: Dict,
        validation_errors: List[Dict],
        captions: Optional[List[Dict]] = None,
        transcript_words: Optional[List[Dict]] = None,
        media_duration: Optional[float] = None,
    ) -> AutoFixResult:
        """
        Attempt to fix a single clip based on validation errors.
        
        This is a SINGLE PASS operation. If the clip still has errors
        after this pass, it should be dropped.
        
        Args:
            clip: Clip data
            validation_errors: List of validation error dicts
            captions: Optional captions for the clip
            transcript_words: Optional transcript for boundary snapping
            media_duration: Total media duration for bounds checking
        
        Returns:
            AutoFixResult with fixed clip or dropped status
        """
        clip_id = clip.get('id', 'unknown')
        fixes_applied = []
        remaining_errors = []
        
        # Categorize errors by type
        clip_errors = []
        caption_errors = []
        timing_errors = []
        hard_failures = []
        
        for error in validation_errors:
            code = error.get('code', '') if isinstance(error, dict) else error.code
            severity = error.get('severity', 'error') if isinstance(error, dict) else error.severity.value
            
            if severity == 'hard':
                hard_failures.append(error)
            elif code.startswith('CLIP_'):
                clip_errors.append(error)
            elif code.startswith('CAPTION_'):
                caption_errors.append(error)
            elif code.startswith('AUDIO_') or code.startswith('VIDEO_'):
                # Audio/video errors typically can't be auto-fixed
                if severity != 'warning':
                    remaining_errors.append(code)
            else:
                timing_errors.append(error)
        
        # If there are hard failures, drop immediately
        if hard_failures:
            return AutoFixResult(
                clip_id=clip_id,
                success=False,
                clip=clip,
                captions=captions or [],
                fixes_applied=[],
                remaining_errors=[
                    e.get('code', str(e)) if isinstance(e, dict) else e.code
                    for e in hard_failures
                ],
                dropped=True,
            )
        
        # Fix clip boundary issues
        fixed_clip = dict(clip)
        if clip_errors:
            trim_result = self.trim_fixer.fix(
                clip=fixed_clip,
                errors=clip_errors,
                transcript_words=transcript_words,
                media_duration=media_duration,
            )
            fixed_clip = trim_result.clip
            fixes_applied.extend(trim_result.adjustments)
            
            if not trim_result.success:
                remaining_errors.extend([
                    e.get('code', str(e)) if isinstance(e, dict) else e.code
                    for e in clip_errors
                ])
        
        # Fix caption issues
        fixed_captions = captions or []
        if caption_errors and fixed_captions:
            clip_start = fixed_clip.get('start', fixed_clip.get('startTime', 0))
            clip_end = fixed_clip.get('end', fixed_clip.get('endTime', 0))
            
            caption_result = self.caption_fixer.fix(
                captions=fixed_captions,
                errors=caption_errors,
                clip_start=clip_start,
                clip_end=clip_end,
            )
            fixed_captions = caption_result.captions
            fixes_applied.extend(caption_result.fixes_applied)
            
            if not caption_result.success:
                remaining_errors.extend([
                    e.get('code', str(e)) if isinstance(e, dict) else e.code
                    for e in caption_errors
                ])
        
        # Fix timing drift
        if timing_errors and fixed_captions and transcript_words:
            timing_result = self.timing_fixer.fix_caption_drift(
                captions=fixed_captions,
                transcript_words=transcript_words,
            )
            fixed_captions = timing_result.data
            fixes_applied.extend(timing_result.shifts_applied)
        
        # Determine success
        success = len(remaining_errors) == 0
        dropped = not success
        
        return AutoFixResult(
            clip_id=clip_id,
            success=success,
            clip=fixed_clip,
            captions=fixed_captions,
            fixes_applied=fixes_applied,
            remaining_errors=remaining_errors,
            dropped=dropped,
        )
    
    def fix_batch(
        self,
        clips: List[Dict],
        validation_results: List[Dict],
        captions_by_clip: Optional[Dict[str, List[Dict]]] = None,
        transcript_words: Optional[List[Dict]] = None,
        media_duration: Optional[float] = None,
    ) -> BatchAutoFixResult:
        """
        Attempt to fix a batch of clips.
        
        Args:
            clips: List of clips
            validation_results: List of validation result dicts (one per clip)
            captions_by_clip: Dict mapping clip_id to captions
            transcript_words: Transcript for all clips
            media_duration: Total media duration
        
        Returns:
            BatchAutoFixResult with all results
        """
        captions_by_clip = captions_by_clip or {}
        results = []
        fixed_count = 0
        dropped_count = 0
        passed_through = 0
        
        for i, clip in enumerate(clips):
            clip_id = clip.get('id', f'clip_{i}')
            
            # Get validation result for this clip
            if i < len(validation_results):
                val_result = validation_results[i]
                errors = val_result.get('errors', [])
                was_valid = val_result.get('valid', True)
            else:
                errors = []
                was_valid = True
            
            # Get captions for this clip
            clip_captions = captions_by_clip.get(clip_id, [])
            
            if was_valid and not errors:
                # No fix needed
                results.append(AutoFixResult(
                    clip_id=clip_id,
                    success=True,
                    clip=clip,
                    captions=clip_captions,
                    fixes_applied=[],
                    remaining_errors=[],
                    dropped=False,
                ))
                passed_through += 1
            else:
                # Attempt fix
                result = self.fix_clip(
                    clip=clip,
                    validation_errors=errors,
                    captions=clip_captions,
                    transcript_words=transcript_words,
                    media_duration=media_duration,
                )
                results.append(result)
                
                if result.dropped:
                    dropped_count += 1
                elif result.fixes_applied:
                    fixed_count += 1
                else:
                    passed_through += 1
        
        return BatchAutoFixResult(
            total=len(clips),
            fixed=fixed_count,
            dropped=dropped_count,
            passed_through=passed_through,
            results=results,
        )

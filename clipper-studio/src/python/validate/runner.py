"""
Validation runner/orchestrator for Clipper Studio.

Coordinates all validators and produces a unified validation report.
This runs all checks and reports what needs fixing.
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
import json

from .result import ValidationResult, ErrorSeverity
from .clip import ClipValidator
from .captions import CaptionValidator
from .audio import AudioValidator
from .video import VideoValidator


@dataclass
class ClipValidationReport:
    """Complete validation report for a single clip."""
    clip_id: str
    valid: bool
    clip_result: Optional[ValidationResult] = None
    caption_result: Optional[ValidationResult] = None
    audio_result: Optional[ValidationResult] = None
    video_result: Optional[ValidationResult] = None
    
    @property
    def all_errors(self) -> List:
        """Get all errors from all validators."""
        errors = []
        for result in [self.clip_result, self.caption_result, 
                       self.audio_result, self.video_result]:
            if result:
                errors.extend(result.errors)
        return errors
    
    @property
    def all_warnings(self) -> List:
        """Get all warnings from all validators."""
        warnings = []
        for result in [self.clip_result, self.caption_result,
                       self.audio_result, self.video_result]:
            if result:
                warnings.extend(result.warnings)
        return warnings
    
    @property
    def fixable(self) -> bool:
        """Can this clip be fixed by auto-fix?"""
        if self.valid:
            return True  # Already valid
        # Check if any errors are hard failures
        for error in self.all_errors:
            if error.severity == ErrorSeverity.HARD_FAILURE:
                return False
        return True
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "clip_id": self.clip_id,
            "valid": self.valid,
            "fixable": self.fixable,
            "errors": [
                {
                    "code": e.code,
                    "message": e.message,
                    "severity": e.severity.value,
                    "field": e.field_name,
                }
                for e in self.all_errors
            ],
            "warnings": [
                {
                    "code": w.code,
                    "message": w.message,
                    "severity": w.severity.value,
                    "field": w.field_name,
                }
                for w in self.all_warnings
            ],
        }


@dataclass
class BatchValidationReport:
    """Validation report for a batch of clips."""
    total: int
    valid: int
    invalid: int
    fixable: int
    hard_failures: int
    reports: List[ClipValidationReport] = field(default_factory=list)
    
    @property
    def summary(self) -> str:
        return (
            f"Validation: {self.valid}/{self.total} valid, "
            f"{self.fixable} fixable, {self.hard_failures} unfixable"
        )
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "total": self.total,
            "valid": self.valid,
            "invalid": self.invalid,
            "fixable": self.fixable,
            "hard_failures": self.hard_failures,
            "reports": [r.to_dict() for r in self.reports],
        }


class ValidationRunner:
    """
    Orchestrates all validators for the pipeline.
    
    Runs validators in order:
    1. Clip structural validation
    2. Caption validation
    3. Audio validation (optional)
    4. Video validation (optional)
    """
    
    def __init__(
        self,
        clip_validator: Optional[ClipValidator] = None,
        caption_validator: Optional[CaptionValidator] = None,
        audio_validator: Optional[AudioValidator] = None,
        video_validator: Optional[VideoValidator] = None,
    ):
        self.clip_validator = clip_validator or ClipValidator()
        self.caption_validator = caption_validator or CaptionValidator()
        self.audio_validator = audio_validator or AudioValidator()
        self.video_validator = video_validator or VideoValidator()
    
    def validate_clip(
        self,
        clip: Dict,
        captions: Optional[List[Dict]] = None,
        transcript_words: Optional[List[Dict]] = None,
        other_clips: Optional[List[Dict]] = None,
        audio_data: Optional[Tuple] = None,
        video_path: Optional[str] = None,
        check_audio: bool = False,
        check_video: bool = False,
    ) -> ClipValidationReport:
        """
        Run all validators on a single clip.
        
        Args:
            clip: Clip data
            captions: Captions for this clip
            transcript_words: Transcript words for boundary checking
            other_clips: Other clips for overlap checking
            audio_data: Optional (samples, sample_rate) for audio validation
            video_path: Optional path to video for video validation
            check_audio: Whether to run audio validation
            check_video: Whether to run video validation
        
        Returns:
            ClipValidationReport with all results
        """
        clip_id = clip.get('id', 'unknown')
        clip_start = clip.get('start', clip.get('startTime', 0))
        clip_end = clip.get('end', clip.get('endTime', 0))
        
        # Clip structural validation (always run)
        clip_result = self.clip_validator.validate(
            clip=clip,
            transcript_words=transcript_words,
            other_clips=other_clips,
        )
        
        # Caption validation (if captions provided)
        caption_result = None
        if captions is not None:
            caption_result = self.caption_validator.validate(
                captions=captions,
                clip_start=clip_start,
                clip_end=clip_end,
            )
        
        # Audio validation (optional, expensive)
        audio_result = None
        if check_audio and audio_data is not None:
            audio_result = self.audio_validator.validate(
                audio_data=audio_data,
                clip_start=clip_start,
                clip_end=clip_end,
            )
        
        # Video validation (optional, expensive)
        video_result = None
        if check_video and video_path is not None:
            video_result = self.video_validator.validate(
                video_path=video_path,
                check_black_frames=False,  # Too expensive for routine validation
            )
        
        # Determine overall validity
        valid = (
            clip_result.valid and
            (caption_result is None or caption_result.valid) and
            (audio_result is None or audio_result.valid) and
            (video_result is None or video_result.valid)
        )
        
        return ClipValidationReport(
            clip_id=clip_id,
            valid=valid,
            clip_result=clip_result,
            caption_result=caption_result,
            audio_result=audio_result,
            video_result=video_result,
        )
    
    def validate_batch(
        self,
        clips: List[Dict],
        captions_by_clip: Optional[Dict[str, List[Dict]]] = None,
        transcript_words: Optional[List[Dict]] = None,
        check_audio: bool = False,
        check_video: bool = False,
        audio_data: Optional[Tuple] = None,
        video_path: Optional[str] = None,
    ) -> BatchValidationReport:
        """
        Run all validators on a batch of clips.
        
        Args:
            clips: List of clips to validate
            captions_by_clip: Dict mapping clip_id to captions
            transcript_words: Transcript for boundary checking
            check_audio: Whether to validate audio
            check_video: Whether to validate video
            audio_data: Audio data for audio validation
            video_path: Video path for video validation
        
        Returns:
            BatchValidationReport with all results
        """
        captions_by_clip = captions_by_clip or {}
        reports = []
        valid_count = 0
        fixable_count = 0
        hard_failure_count = 0
        
        for i, clip in enumerate(clips):
            clip_id = clip.get('id', f'clip_{i}')
            
            # Get other clips for overlap checking
            other_clips = clips[:i] + clips[i+1:]
            
            # Get captions for this clip
            clip_captions = captions_by_clip.get(clip_id)
            
            report = self.validate_clip(
                clip=clip,
                captions=clip_captions,
                transcript_words=transcript_words,
                other_clips=other_clips,
                audio_data=audio_data,
                video_path=video_path,
                check_audio=check_audio,
                check_video=check_video,
            )
            reports.append(report)
            
            if report.valid:
                valid_count += 1
            elif report.fixable:
                fixable_count += 1
            else:
                hard_failure_count += 1
        
        return BatchValidationReport(
            total=len(clips),
            valid=valid_count,
            invalid=len(clips) - valid_count,
            fixable=fixable_count,
            hard_failures=hard_failure_count,
            reports=reports,
        )
    
    def validate_and_report(
        self,
        clips: List[Dict],
        captions_by_clip: Optional[Dict[str, List[Dict]]] = None,
        transcript_words: Optional[List[Dict]] = None,
        verbose: bool = True,
    ) -> BatchValidationReport:
        """
        Validate clips and print a human-readable report.
        
        Args:
            clips: Clips to validate
            captions_by_clip: Captions by clip ID
            transcript_words: Transcript words
            verbose: Whether to print detailed output
        
        Returns:
            BatchValidationReport
        """
        report = self.validate_batch(
            clips=clips,
            captions_by_clip=captions_by_clip,
            transcript_words=transcript_words,
        )
        
        if verbose:
            print(f"\n{'='*60}")
            print("VALIDATION REPORT")
            print(f"{'='*60}")
            print(report.summary)
            print()
            
            for clip_report in report.reports:
                status = "✓" if clip_report.valid else "✗"
                fixable_note = " (fixable)" if not clip_report.valid and clip_report.fixable else ""
                fixable_note = " (DROPPED)" if not clip_report.valid and not clip_report.fixable else fixable_note
                
                print(f"[{clip_report.clip_id}] {status}{fixable_note}")
                
                for error in clip_report.all_errors:
                    print(f"  {error}")
                
                for warning in clip_report.all_warnings:
                    print(f"  {warning}")
            
            print(f"{'='*60}\n")
        
        return report


def load_clips_from_json(json_path: str) -> Tuple[List[Dict], Dict[str, List[Dict]]]:
    """
    Load clips and captions from a JSON file.
    
    Expected format:
    {
        "clips": [...],
        "captions": {"clip_id": [...], ...}
    }
    
    or just:
    {"clips": [...]}
    
    Returns:
        Tuple of (clips, captions_by_clip)
    """
    with open(json_path, 'r') as f:
        data = json.load(f)
    
    clips = data.get('clips', [])
    captions = data.get('captions', {})
    
    return clips, captions

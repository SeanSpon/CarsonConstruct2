"""
Validation module for Clipper Studio.

Provides deterministic validators for clips, captions, audio, and video.
These check mechanical correctness - NOT content quality.

Validation rules:
- Checks are deterministic and reproducible
- Validators never change intent
- Each validator returns a ValidationResult

Example usage:
    from validate import ClipValidator, CaptionValidator
    
    result = ClipValidator().validate(clip_data)
    if not result.valid:
        print(result.errors)
"""

from .result import ValidationResult, ValidationError
from .clip import ClipValidator
from .captions import CaptionValidator
from .audio import AudioValidator
from .video import VideoValidator
from .runner import ValidationRunner

__all__ = [
    'ValidationResult',
    'ValidationError', 
    'ClipValidator',
    'CaptionValidator',
    'AudioValidator',
    'VideoValidator',
    'ValidationRunner',
]

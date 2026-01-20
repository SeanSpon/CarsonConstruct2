"""
Auto-fix module for Clipper Studio.

Provides deterministic, single-pass fixes for validation errors.
These fix MECHANICAL issues only, never changing clip intent.

Allowed fixes:
- Shift start/end by ±250ms
- Rebuild captions
- Remove first/last subtitle
- Re-export FFmpeg command

Forbidden fixes:
- Changing clip meaning
- Re-detecting moments
- Adjusting scores
- Generating new clips

If a clip still fails after 1 fix pass → discard.
This prevents infinite loops.

Example usage:
    from autofix import TrimFixer, CaptionFixer
    
    fixed_clip = TrimFixer().fix(clip, errors)
"""

from .trim import TrimFixer
from .captions import CaptionFixer
from .timing import TimingFixer
from .runner import AutoFixRunner

__all__ = [
    'TrimFixer',
    'CaptionFixer', 
    'TimingFixer',
    'AutoFixRunner',
]

"""
Rendering module for ClipBot MVP pipeline.

Contains components for:
- CaptionRenderer: Dynamic word-by-word captions
- VideoEffects: Dynamic cuts, zooms, and aspect ratio conversion
"""

from .caption_renderer import CaptionRenderer
from .video_effects import VideoEffects

__all__ = ['CaptionRenderer', 'VideoEffects']

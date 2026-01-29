"""
Opus AI - Automated Editing Pipeline

Modules for automated video editing:
- Caption generation with viral karaoke styles
- B-roll insertion with stock footage
- Music selection and sync
- FFmpeg video assembly
"""

from .caption_generator import CaptionGenerator, CaptionStyle, CaptionWord
from .video_assembler import VideoAssembler, AssemblyJob
from .broll_finder import BRollFinder, BRollResult
from .music_selector import MusicSelector, MusicTrack

__all__ = [
    'CaptionGenerator',
    'CaptionStyle',
    'CaptionWord',
    'VideoAssembler',
    'AssemblyJob',
    'BRollFinder',
    'BRollResult',
    'MusicSelector',
    'MusicTrack',
]

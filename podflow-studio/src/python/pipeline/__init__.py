"""
ClipBot MVP Pipeline Module

This module contains the core components for the clip generation pipeline:
- NarrativeDetector: Finds story-complete segments in transcripts
- ClipGenerator: Orchestrates the full pipeline from video to clips
"""

from .narrative_detector import NarrativeDetector
from .clip_generator import ClipGenerator

__all__ = ['NarrativeDetector', 'ClipGenerator']

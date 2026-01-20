"""
Captions Stage - Build karaoke captions from word timestamps.

Features:
- Word-level highlighting (karaoke style)
- Multiple styles (viral green, minimal white, bold)
- 2-line max with intelligent wrapping
- Vertical video positioning (bottom third)

NO AI - pure rendering logic based on transcript timestamps.
"""

from .karaoke import generate_captions, CaptionStyle

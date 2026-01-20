"""
Editing Stage - Rule-based angle switching and b-roll overlay.

All rules are DETERMINISTIC:
- Angle switching: Cut on sentence boundaries or every 3-5s, never mid-word
- B-roll overlay: Audio never changes, only video overlay, optional and deterministic

NO AI - just simple rules based on transcript timing.
"""

from .angle_switch import generate_angle_cuts, AngleCut
from .broll import generate_broll_overlays, BRollOverlay

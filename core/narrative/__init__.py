# Narrative Detection Module
# Story structure validation lives here.
# Rule: Clips must pass narrative completeness or they die.

from .unit import NarrativeUnit, NarrativeVerdict
from .detector import detect_narrative_structure
from .gate import apply_narrative_gate

__all__ = [
    "NarrativeUnit",
    "NarrativeVerdict", 
    "detect_narrative_structure",
    "apply_narrative_gate",
]

# Narrative Detection Module
# Story structure validation lives here.
# Rule: Clips must pass narrative completeness or they die.

from .unit import NarrativeUnit, NarrativeVerdict, DropReason, create_narrative_unit
from .detector import detect_narrative_structure
from .gate import (
    apply_narrative_gate,
    apply_gates_batch,
    summarize_gate_results,
    GateReport,
    GateResult,
    GateType,
    GATE_THRESHOLDS,
)

__all__ = [
    "NarrativeUnit",
    "NarrativeVerdict",
    "DropReason",
    "create_narrative_unit",
    "detect_narrative_structure",
    "apply_narrative_gate",
    "apply_gates_batch",
    "summarize_gate_results",
    "GateReport",
    "GateResult",
    "GateType",
    "GATE_THRESHOLDS",
]

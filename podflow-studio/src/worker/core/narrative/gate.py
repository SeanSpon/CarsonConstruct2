"""
Narrative Gate - The Quality Firewall

This module applies the 4 quality gates that determine if a clip ships.
If ANY gate fails, the clip is DROPPED. No exceptions. No fallbacks.

Gates:
1. NARRATIVE COMPLETENESS - Is it a complete micro-story?
2. VISUAL CONTINUITY - Clean cuts, no jarring transitions?
3. CAPTION CLARITY - Understandable when muted?
4. CONFIDENCE THRESHOLD - System confident enough to ship?

Philosophy:
- Rejection is success
- Fewer, better clips > many mediocre clips
- If a gate fails, the system is working correctly
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Tuple
from enum import Enum

from .unit import NarrativeUnit, NarrativeVerdict, DropReason


class GateType(Enum):
    """The four quality gates."""
    NARRATIVE = "narrative_completeness"
    VISUAL = "visual_continuity"
    CAPTION = "caption_clarity"
    CONFIDENCE = "confidence_threshold"


@dataclass
class GateResult:
    """Result of a single gate check."""
    gate: GateType
    passed: bool
    score: float
    reason: str


@dataclass
class GateReport:
    """Full gate report for a clip."""
    clip_id: str
    gates: List[GateResult]
    all_passed: bool
    verdict: NarrativeVerdict
    primary_failure: str = ""
    
    def to_dict(self) -> dict:
        return {
            "clip_id": self.clip_id,
            "gates": [
                {
                    "gate": g.gate.value,
                    "passed": g.passed,
                    "score": g.score,
                    "reason": g.reason,
                }
                for g in self.gates
            ],
            "all_passed": self.all_passed,
            "verdict": self.verdict.value,
            "primary_failure": self.primary_failure,
        }


# Gate Thresholds (these are the knobs)
GATE_THRESHOLDS = {
    "min_story_elements": 2,
    "min_confidence": 0.6,
    "max_context_dependency": 0.7,
    "min_transcript_words": 15,
    "min_duration": 15.0,
    "max_duration": 90.0,
    "min_speech_ratio": 0.7,
}


def check_narrative_gate(unit: NarrativeUnit) -> GateResult:
    """
    Gate 1: Narrative Completeness
    
    Does this clip tell a complete micro-story?
    Must have at least 2 of 3 story elements.
    """
    min_elements = GATE_THRESHOLDS["min_story_elements"]
    passed = unit.story_element_count >= min_elements
    
    elements = []
    if unit.has_setup:
        elements.append("setup")
    if unit.has_core:
        elements.append("core")
    if unit.has_resolution:
        elements.append("resolution")
    
    if passed:
        reason = f"Complete story with: {', '.join(elements)}"
    else:
        missing = []
        if not unit.has_setup:
            missing.append("setup")
        if not unit.has_core:
            missing.append("core")
        if not unit.has_resolution:
            missing.append("resolution")
        reason = f"Incomplete story. Missing: {', '.join(missing)}"
    
    return GateResult(
        gate=GateType.NARRATIVE,
        passed=passed,
        score=unit.story_element_count / 3.0,
        reason=reason,
    )


def check_visual_gate(
    unit: NarrativeUnit,
    visual_metadata: Dict[str, Any] = None,
) -> GateResult:
    """
    Gate 2: Visual Continuity
    
    Are the cuts clean? No jarring transitions?
    Uses VAD boundary alignment and speech continuity.
    """
    if visual_metadata is None:
        visual_metadata = {}
    
    # Check duration bounds
    duration = unit.duration
    min_dur = GATE_THRESHOLDS["min_duration"]
    max_dur = GATE_THRESHOLDS["max_duration"]
    
    if duration < min_dur:
        return GateResult(
            gate=GateType.VISUAL,
            passed=False,
            score=0.3,
            reason=f"Too short ({duration:.1f}s < {min_dur}s minimum)",
        )
    
    if duration > max_dur:
        return GateResult(
            gate=GateType.VISUAL,
            passed=False,
            score=0.3,
            reason=f"Too long ({duration:.1f}s > {max_dur}s maximum)",
        )
    
    # Check speech ratio if available
    speech_ratio = visual_metadata.get("speech_ratio", 0.8)
    min_speech = GATE_THRESHOLDS["min_speech_ratio"]
    
    if speech_ratio < min_speech:
        return GateResult(
            gate=GateType.VISUAL,
            passed=False,
            score=speech_ratio,
            reason=f"Low speech ratio ({speech_ratio:.0%} < {min_speech:.0%})",
        )
    
    # Check boundary quality
    boundary_score = visual_metadata.get("boundary_score", 0.8)
    
    return GateResult(
        gate=GateType.VISUAL,
        passed=boundary_score >= 0.6,
        score=boundary_score,
        reason="Clean boundaries" if boundary_score >= 0.6 else "Potential cut issues",
    )


def check_caption_gate(unit: NarrativeUnit) -> GateResult:
    """
    Gate 3: Caption Clarity
    
    Is this clip understandable when muted?
    Requires sufficient transcript content.
    """
    words = unit.transcript.split()
    word_count = len(words)
    min_words = GATE_THRESHOLDS["min_transcript_words"]
    
    if word_count < min_words:
        return GateResult(
            gate=GateType.CAPTION,
            passed=False,
            score=word_count / min_words,
            reason=f"Too few words for captions ({word_count} < {min_words})",
        )
    
    # Check for complete sentences (ends with punctuation)
    transcript = unit.transcript.strip()
    ends_complete = transcript.endswith(('.', '!', '?', '"', "'"))
    
    if not ends_complete:
        return GateResult(
            gate=GateType.CAPTION,
            passed=False,
            score=0.5,
            reason="Transcript may be cut off mid-sentence",
        )
    
    return GateResult(
        gate=GateType.CAPTION,
        passed=True,
        score=min(1.0, word_count / 50),
        reason=f"Caption-ready ({word_count} words)",
    )


def check_confidence_gate(unit: NarrativeUnit) -> GateResult:
    """
    Gate 4: Confidence Threshold
    
    Is the system confident enough to ship this?
    Also checks context dependency.
    """
    min_conf = GATE_THRESHOLDS["min_confidence"]
    max_context_dep = GATE_THRESHOLDS["max_context_dependency"]
    
    # Check confidence
    if unit.confidence < min_conf:
        return GateResult(
            gate=GateType.CONFIDENCE,
            passed=False,
            score=unit.confidence,
            reason=f"Low confidence ({unit.confidence:.0%} < {min_conf:.0%})",
        )
    
    # Check context dependency
    if unit.context_dependency > max_context_dep:
        return GateResult(
            gate=GateType.CONFIDENCE,
            passed=False,
            score=1.0 - unit.context_dependency,
            reason=f"Too context-dependent ({unit.context_dependency:.0%})",
        )
    
    return GateResult(
        gate=GateType.CONFIDENCE,
        passed=True,
        score=unit.confidence,
        reason=f"High confidence ({unit.confidence:.0%})",
    )


def apply_narrative_gate(
    unit: NarrativeUnit,
    visual_metadata: Dict[str, Any] = None,
) -> GateReport:
    """
    Apply ALL 4 quality gates to a NarrativeUnit.
    
    If ANY gate fails, verdict = DROP.
    This is the core quality firewall.
    
    Args:
        unit: The NarrativeUnit to evaluate
        visual_metadata: Optional visual/audio quality data
    
    Returns:
        GateReport with verdict and detailed gate results
    """
    gates = [
        check_narrative_gate(unit),
        check_visual_gate(unit, visual_metadata),
        check_caption_gate(unit),
        check_confidence_gate(unit),
    ]
    
    all_passed = all(g.passed for g in gates)
    
    # Find primary failure reason
    primary_failure = ""
    if not all_passed:
        failed_gates = [g for g in gates if not g.passed]
        if failed_gates:
            primary_failure = failed_gates[0].reason
    
    return GateReport(
        clip_id=unit.clip_id,
        gates=gates,
        all_passed=all_passed,
        verdict=NarrativeVerdict.PASS if all_passed else NarrativeVerdict.DROP,
        primary_failure=primary_failure,
    )


def apply_gates_batch(
    units: List[NarrativeUnit],
    visual_metadata_list: List[Dict[str, Any]] = None,
) -> Tuple[List[NarrativeUnit], List[GateReport]]:
    """
    Apply quality gates to a batch of NarrativeUnits.
    
    Returns:
        Tuple of (survivors, all_reports)
        - survivors: Only units that passed ALL gates
        - all_reports: Gate reports for ALL units (for logging/debugging)
    """
    if visual_metadata_list is None:
        visual_metadata_list = [{}] * len(units)
    
    reports = []
    survivors = []
    
    for unit, visual_meta in zip(units, visual_metadata_list):
        report = apply_narrative_gate(unit, visual_meta)
        reports.append(report)
        
        if report.all_passed:
            survivors.append(unit)
    
    return survivors, reports


def summarize_gate_results(reports: List[GateReport]) -> Dict[str, Any]:
    """
    Summarize gate results for logging/UI display.
    
    Returns stats like:
    - Total candidates
    - Survivors
    - Drop reasons breakdown
    """
    total = len(reports)
    passed = sum(1 for r in reports if r.all_passed)
    dropped = total - passed
    
    # Count failures by gate type
    failures_by_gate = {gt.value: 0 for gt in GateType}
    for report in reports:
        for gate in report.gates:
            if not gate.passed:
                failures_by_gate[gate.gate.value] += 1
    
    return {
        "total_candidates": total,
        "survivors": passed,
        "dropped": dropped,
        "survival_rate": passed / total if total > 0 else 0,
        "failures_by_gate": failures_by_gate,
        "message": f"✅ {passed} clips passed quality gates. ❌ {dropped} dropped for quality.",
    }

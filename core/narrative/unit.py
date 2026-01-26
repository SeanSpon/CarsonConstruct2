"""
NarrativeUnit - The Core Schema

This is the SINGLE MOST IMPORTANT object in ClipBot.
Every clip candidate must be evaluated as a NarrativeUnit.

RULES:
- Must have at least 2 of 3 story elements (setup, core, resolution)
- If < 2 elements → HARD DROP, no exceptions
- Confidence below threshold → DROP
- DROP means: no captions, no render, no UI visibility (except count)

This is NOT about finding "good moments."
This is about constructing COMPLETE STORIES.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List


class NarrativeVerdict(Enum):
    """The only two outcomes that matter."""
    PASS = "pass"
    DROP = "drop"


class StoryPhase(Enum):
    """Which phase of the story arc this segment represents."""
    SETUP = "setup"          # Context, question, claim
    CORE = "core"            # Explanation, tension, insight  
    RESOLUTION = "resolution" # Takeaway, conclusion
    MIXED = "mixed"          # Multiple phases present
    INCOMPLETE = "incomplete" # Cannot determine - likely DROP


class DropReason(Enum):
    """Why a clip was dropped. Clear, specific, loggable."""
    MISSING_SETUP = "missing_setup"
    MISSING_CORE = "missing_core_idea"
    MISSING_RESOLUTION = "missing_resolution"
    INSUFFICIENT_ELEMENTS = "insufficient_story_elements"
    LOW_CONFIDENCE = "low_confidence"
    TOO_SHORT = "too_short_for_story"
    TOO_LONG = "too_long_for_platform"
    CONTEXT_DEPENDENT = "requires_prior_context"
    INCOMPLETE_THOUGHT = "thought_cut_off"
    VISUAL_DISCONTINUITY = "visual_cut_issues"
    CAPTION_UNCLEAR = "captions_not_comprehensible_muted"


@dataclass
class NarrativeUnit:
    """
    A clip candidate evaluated for story completeness.
    
    This is the editorial judgment object.
    If verdict == DROP, this clip DOES NOT EXIST downstream.
    """
    
    # Identity
    clip_id: str
    start_time: float
    end_time: float
    
    # Story Structure (the core evaluation)
    has_setup: bool = False
    has_core: bool = False
    has_resolution: bool = False
    
    # Derived Fields
    story_element_count: int = field(init=False)
    story_phase: StoryPhase = field(default=StoryPhase.INCOMPLETE)
    
    # Confidence & Quality
    confidence: float = 0.0  # 0.0 to 1.0
    context_dependency: float = 0.0  # 0.0 = standalone, 1.0 = needs full context
    
    # The Verdict (computed)
    verdict: NarrativeVerdict = field(default=NarrativeVerdict.DROP)
    drop_reason: Optional[DropReason] = None
    drop_reasons: List[DropReason] = field(default_factory=list)
    
    # Transcript for analysis
    transcript: str = ""
    
    # Metadata
    patterns_detected: List[str] = field(default_factory=list)
    
    def __post_init__(self):
        """Compute derived fields and verdict after initialization."""
        self.story_element_count = sum([
            self.has_setup,
            self.has_core, 
            self.has_resolution
        ])
        self._compute_story_phase()
        self._compute_verdict()
    
    def _compute_story_phase(self):
        """Determine which story phase(s) this segment represents."""
        elements = [self.has_setup, self.has_core, self.has_resolution]
        count = sum(elements)
        
        if count == 0:
            self.story_phase = StoryPhase.INCOMPLETE
        elif count >= 2:
            self.story_phase = StoryPhase.MIXED
        elif self.has_setup:
            self.story_phase = StoryPhase.SETUP
        elif self.has_core:
            self.story_phase = StoryPhase.CORE
        else:
            self.story_phase = StoryPhase.RESOLUTION
    
    def _compute_verdict(self):
        """
        THE GATE. This is where clips live or die.
        
        Rules (NON-NEGOTIABLE):
        1. Must have >= 2 of 3 story elements
        2. Confidence must meet threshold (0.6)
        3. Context dependency must be low enough (< 0.7)
        """
        MIN_ELEMENTS = 2
        MIN_CONFIDENCE = 0.6
        MAX_CONTEXT_DEPENDENCY = 0.7
        
        self.drop_reasons = []
        
        # Gate 1: Story element count
        if self.story_element_count < MIN_ELEMENTS:
            self.drop_reasons.append(DropReason.INSUFFICIENT_ELEMENTS)
            if not self.has_setup:
                self.drop_reasons.append(DropReason.MISSING_SETUP)
            if not self.has_core:
                self.drop_reasons.append(DropReason.MISSING_CORE)
            if not self.has_resolution:
                self.drop_reasons.append(DropReason.MISSING_RESOLUTION)
        
        # Gate 2: Confidence threshold
        if self.confidence < MIN_CONFIDENCE:
            self.drop_reasons.append(DropReason.LOW_CONFIDENCE)
        
        # Gate 3: Context dependency
        if self.context_dependency > MAX_CONTEXT_DEPENDENCY:
            self.drop_reasons.append(DropReason.CONTEXT_DEPENDENT)
        
        # Final verdict
        if self.drop_reasons:
            self.verdict = NarrativeVerdict.DROP
            self.drop_reason = self.drop_reasons[0]  # Primary reason
        else:
            self.verdict = NarrativeVerdict.PASS
            self.drop_reason = None
    
    @property
    def duration(self) -> float:
        return self.end_time - self.start_time
    
    @property
    def is_shippable(self) -> bool:
        """Simple boolean: can this clip be shipped?"""
        return self.verdict == NarrativeVerdict.PASS
    
    @property
    def confidence_label(self) -> str:
        """Human-friendly confidence label for UI."""
        if self.confidence >= 0.85:
            return "🔥"  # Top Pick
        elif self.confidence >= 0.7:
            return "👍"  # Solid
        elif self.confidence >= 0.6:
            return "🧪"  # Optional
        else:
            return "❌"  # Below threshold
    
    def to_dict(self) -> dict:
        """Serialize for JSON/API transport."""
        return {
            "clip_id": self.clip_id,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration": self.duration,
            "has_setup": self.has_setup,
            "has_core": self.has_core,
            "has_resolution": self.has_resolution,
            "story_element_count": self.story_element_count,
            "story_phase": self.story_phase.value,
            "confidence": self.confidence,
            "confidence_label": self.confidence_label,
            "context_dependency": self.context_dependency,
            "verdict": self.verdict.value,
            "drop_reason": self.drop_reason.value if self.drop_reason else None,
            "drop_reasons": [r.value for r in self.drop_reasons],
            "is_shippable": self.is_shippable,
            "transcript": self.transcript,
            "patterns_detected": self.patterns_detected,
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "NarrativeUnit":
        """Deserialize from JSON/API transport."""
        return cls(
            clip_id=data["clip_id"],
            start_time=data["start_time"],
            end_time=data["end_time"],
            has_setup=data.get("has_setup", False),
            has_core=data.get("has_core", False),
            has_resolution=data.get("has_resolution", False),
            confidence=data.get("confidence", 0.0),
            context_dependency=data.get("context_dependency", 0.0),
            transcript=data.get("transcript", ""),
            patterns_detected=data.get("patterns_detected", []),
        )


def create_narrative_unit(
    clip_id: str,
    start_time: float,
    end_time: float,
    transcript: str,
    has_setup: bool = False,
    has_core: bool = False,
    has_resolution: bool = False,
    confidence: float = 0.0,
    context_dependency: float = 0.0,
    patterns: List[str] = None,
) -> NarrativeUnit:
    """
    Factory function to create a NarrativeUnit.
    
    Use this instead of calling NarrativeUnit() directly
    to ensure all validation happens correctly.
    """
    return NarrativeUnit(
        clip_id=clip_id,
        start_time=start_time,
        end_time=end_time,
        has_setup=has_setup,
        has_core=has_core,
        has_resolution=has_resolution,
        confidence=confidence,
        context_dependency=context_dependency,
        transcript=transcript,
        patterns_detected=patterns or [],
    )

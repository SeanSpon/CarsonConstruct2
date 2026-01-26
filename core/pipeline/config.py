"""
Pipeline Configuration

Central configuration for the story-first pipeline.
All thresholds and rules live here.
"""

from dataclasses import dataclass, field
from typing import Dict, Any, Optional
import json
import os


@dataclass
class GateThresholds:
    """Quality gate thresholds."""
    min_story_elements: int = 2  # Must have 2 of 3 (setup, core, resolution)
    min_confidence: float = 0.6  # Minimum AI confidence to ship
    max_context_dependency: float = 0.7  # Max allowed context dependency
    min_transcript_words: int = 15  # Minimum words for caption clarity
    min_duration: float = 15.0  # Minimum clip duration (seconds)
    max_duration: float = 90.0  # Maximum clip duration (seconds)
    min_speech_ratio: float = 0.7  # Minimum speech in clip


@dataclass
class PipelineConfig:
    """
    Complete pipeline configuration.
    
    This is the single source of truth for MVP rules.
    """
    # Output targets
    target_clips: int = 10  # Maximum clips to produce
    max_clips_hard: int = 15  # Absolute maximum
    min_clips_warn: int = 3  # Warn if fewer than this survive
    
    # Segmentation
    min_segment_duration: float = 20.0  # Minimum segment length to consider
    max_segment_duration: float = 90.0  # Maximum segment length
    target_segment_duration: float = 45.0  # Ideal segment length
    
    # Gate thresholds
    gates: GateThresholds = field(default_factory=GateThresholds)
    
    # AI settings
    use_ai_detection: bool = True  # Use AI for narrative detection
    ai_provider: str = "openai"  # Which AI provider to use
    ai_model: str = "gpt-4o-mini"  # Which model
    ai_timeout: int = 30  # Timeout in seconds
    
    # Fallback behavior
    fallback_to_heuristics: bool = True  # Use heuristics if AI fails
    strict_mode: bool = True  # If True, empty output is valid
    
    # UI/Export
    show_dropped_clips: bool = False  # Show dropped clips in UI (debug only)
    confidence_labels: Dict[str, str] = field(default_factory=lambda: {
        "high": "🔥",  # >= 0.85
        "medium": "👍",  # >= 0.7
        "low": "🧪",  # >= 0.6
        "fail": "❌",  # < 0.6
    })
    
    def to_dict(self) -> dict:
        return {
            "target_clips": self.target_clips,
            "max_clips_hard": self.max_clips_hard,
            "min_clips_warn": self.min_clips_warn,
            "min_segment_duration": self.min_segment_duration,
            "max_segment_duration": self.max_segment_duration,
            "target_segment_duration": self.target_segment_duration,
            "gates": {
                "min_story_elements": self.gates.min_story_elements,
                "min_confidence": self.gates.min_confidence,
                "max_context_dependency": self.gates.max_context_dependency,
                "min_transcript_words": self.gates.min_transcript_words,
                "min_duration": self.gates.min_duration,
                "max_duration": self.gates.max_duration,
                "min_speech_ratio": self.gates.min_speech_ratio,
            },
            "use_ai_detection": self.use_ai_detection,
            "ai_provider": self.ai_provider,
            "ai_model": self.ai_model,
            "strict_mode": self.strict_mode,
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "PipelineConfig":
        gates_data = data.get("gates", {})
        gates = GateThresholds(
            min_story_elements=gates_data.get("min_story_elements", 2),
            min_confidence=gates_data.get("min_confidence", 0.6),
            max_context_dependency=gates_data.get("max_context_dependency", 0.7),
            min_transcript_words=gates_data.get("min_transcript_words", 15),
            min_duration=gates_data.get("min_duration", 15.0),
            max_duration=gates_data.get("max_duration", 90.0),
            min_speech_ratio=gates_data.get("min_speech_ratio", 0.7),
        )
        
        return cls(
            target_clips=data.get("target_clips", 10),
            max_clips_hard=data.get("max_clips_hard", 15),
            min_clips_warn=data.get("min_clips_warn", 3),
            min_segment_duration=data.get("min_segment_duration", 20.0),
            max_segment_duration=data.get("max_segment_duration", 90.0),
            target_segment_duration=data.get("target_segment_duration", 45.0),
            gates=gates,
            use_ai_detection=data.get("use_ai_detection", True),
            ai_provider=data.get("ai_provider", "openai"),
            ai_model=data.get("ai_model", "gpt-4o-mini"),
            strict_mode=data.get("strict_mode", True),
        )


def load_config(config_path: Optional[str] = None) -> PipelineConfig:
    """
    Load pipeline configuration from file or return defaults.
    
    Args:
        config_path: Path to JSON config file
    
    Returns:
        PipelineConfig instance
    """
    if config_path and os.path.exists(config_path):
        with open(config_path, "r") as f:
            data = json.load(f)
        return PipelineConfig.from_dict(data)
    
    return PipelineConfig()


def save_config(config: PipelineConfig, config_path: str) -> None:
    """Save pipeline configuration to file."""
    with open(config_path, "w") as f:
        json.dump(config.to_dict(), f, indent=2)


# Default configuration (MVP rules)
DEFAULT_CONFIG = PipelineConfig()

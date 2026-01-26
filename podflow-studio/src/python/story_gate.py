#!/usr/bin/env python3
"""
Story Gate Integration

This module bridges the existing detection pipeline with the new
story-first quality gates from core/.

Called after clips are selected to filter out any that don't
tell complete stories.
"""

import os
import sys

# Add core module to path
CORE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), 'core')
sys.path.insert(0, CORE_PATH)

from narrative.unit import NarrativeUnit, NarrativeVerdict
from narrative.detector import detect_narrative_structure
from narrative.gate import apply_narrative_gate, apply_all_gates
from pipeline.config import PipelineConfig


def apply_story_gates(clips: list, transcript: dict, config: PipelineConfig = None) -> tuple:
    """
    Apply story-first quality gates to clips.
    
    Args:
        clips: List of clip dicts with startTime, endTime, etc.
        transcript: Transcript dict with 'segments' or 'text'
        config: Pipeline configuration (uses defaults if None)
    
    Returns:
        tuple: (surviving_clips, dropped_clips, gate_stats)
    """
    if config is None:
        config = PipelineConfig()
    
    if not clips:
        return [], [], {"total": 0, "survived": 0, "dropped": 0}
    
    # Get transcript text for each clip
    transcript_segments = transcript.get("segments", []) if transcript else []
    
    survivors = []
    dropped = []
    
    for clip in clips:
        # Extract transcript text for this clip's time range
        start_time = clip.get("startTime", 0)
        end_time = clip.get("endTime", 0)
        
        clip_text = _extract_text_for_range(transcript_segments, start_time, end_time)
        
        if not clip_text or len(clip_text.strip()) < 50:
            # Not enough text to analyze - mark as dropped
            clip["story_gate"] = {
                "verdict": "DROP",
                "reason": "insufficient_transcript",
                "confidence": 0,
            }
            dropped.append(clip)
            continue
        
        # Detect narrative structure
        unit = detect_narrative_structure(clip_text, start_time, end_time)
        
        # Apply quality gates
        gate_report = apply_all_gates(unit, config)
        
        # Annotate clip with gate results
        clip["story_gate"] = {
            "verdict": gate_report.final_verdict.value,
            "confidence": unit.confidence,
            "elements": {
                "setup": unit.has_setup,
                "core": unit.has_core,
                "resolution": unit.has_resolution,
            },
            "element_count": unit.story_element_count,
            "context_dependency": unit.context_dependency,
            "gates_passed": gate_report.gates_passed,
            "gates_failed": gate_report.gates_failed,
            "gate_details": gate_report.gate_details,
        }
        
        if gate_report.final_verdict == NarrativeVerdict.PASS:
            # Add story metadata to clip
            clip["narrativeConfidence"] = int(unit.confidence * 100)
            clip["storyComplete"] = True
            survivors.append(clip)
        else:
            clip["storyComplete"] = False
            dropped.append(clip)
    
    stats = {
        "total": len(clips),
        "survived": len(survivors),
        "dropped": len(dropped),
        "survival_rate": len(survivors) / len(clips) if clips else 0,
    }
    
    return survivors, dropped, stats


def _extract_text_for_range(segments: list, start_time: float, end_time: float) -> str:
    """
    Extract transcript text that falls within a time range.
    """
    if not segments:
        return ""
    
    texts = []
    for seg in segments:
        seg_start = seg.get("start", 0)
        seg_end = seg.get("end", seg_start + 1)
        
        # Check if segment overlaps with our range
        if seg_start < end_time and seg_end > start_time:
            text = seg.get("text", "").strip()
            if text:
                texts.append(text)
    
    return " ".join(texts)


def filter_clips_by_story(clips: list, transcript: dict, 
                          min_confidence: float = 0.6,
                          min_elements: int = 2) -> list:
    """
    Simple filter function for clips.
    
    Returns only clips that pass story gates.
    """
    survivors, _, _ = apply_story_gates(clips, transcript)
    return survivors


# For direct testing
if __name__ == "__main__":
    # Quick test
    test_clips = [
        {"id": "test1", "startTime": 0, "endTime": 60},
    ]
    test_transcript = {
        "segments": [
            {"start": 0, "end": 30, "text": "So the question everyone asks is how do you stay motivated."},
            {"start": 30, "end": 60, "text": "And the answer is simple. You build systems, not willpower. That's the key insight."},
        ]
    }
    
    survivors, dropped, stats = apply_story_gates(test_clips, test_transcript)
    print(f"Test: {stats['survived']}/{stats['total']} clips passed story gates")

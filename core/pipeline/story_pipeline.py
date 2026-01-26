"""
Story-First Pipeline

This is the NEW authoritative flow for ClipBot MVP.

OLD FLOW (what we're replacing):
    detect → score → rank → output

NEW FLOW (story-first):
    segment → try_build_story → gate → (maybe) polish → ship

Key principles:
1. Backend is source of truth - UI cannot override
2. Rejection is success - dropped clips = system working
3. Ranking only happens AFTER survival
4. Fewer clips > more clips

This pipeline:
- Takes raw video/audio input
- Transcribes and segments
- Builds NarrativeUnits from segments
- Applies 4 quality gates
- Returns ONLY survivors
"""

import os
import json
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum

# Import narrative core
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from narrative.unit import NarrativeUnit, NarrativeVerdict
from narrative.detector import detect_narrative_structure, batch_detect_narrative_structure
from narrative.gate import apply_gates_batch, summarize_gate_results, GateReport


class PipelineStage(Enum):
    """Pipeline stages for progress tracking."""
    INIT = "init"
    TRANSCRIBE = "transcribe"
    SEGMENT = "segment"
    ANALYZE = "analyze"
    GATE = "gate"
    POLISH = "polish"
    COMPLETE = "complete"
    ERROR = "error"


@dataclass
class PipelineProgress:
    """Progress update for UI."""
    stage: PipelineStage
    progress: float  # 0.0 to 1.0
    message: str
    detail: str = ""


@dataclass
class PipelineResult:
    """Final result from the story pipeline."""
    success: bool
    survivors: List[NarrativeUnit]
    dropped_count: int
    total_candidates: int
    gate_summary: Dict[str, Any]
    error: Optional[str] = None
    
    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "survivors": [u.to_dict() for u in self.survivors],
            "survivor_count": len(self.survivors),
            "dropped_count": self.dropped_count,
            "total_candidates": self.total_candidates,
            "gate_summary": self.gate_summary,
            "error": self.error,
        }


class StoryPipeline:
    """
    The story-first clip pipeline.
    
    This replaces the old pattern-based detection with
    narrative structure validation.
    
    Usage:
        pipeline = StoryPipeline(config)
        result = pipeline.run(video_path)
        
        for clip in result.survivors:
            # These are the ONLY clips allowed to ship
            export_clip(clip)
    """
    
    def __init__(
        self,
        config: Dict[str, Any] = None,
        ai_provider: Any = None,
        progress_callback: callable = None,
    ):
        self.config = config or {}
        self.ai_provider = ai_provider
        self.progress_callback = progress_callback
        
        # Defaults
        self.target_clips = self.config.get("target_clips", 10)
        self.min_segment_duration = self.config.get("min_segment_duration", 20.0)
        self.max_segment_duration = self.config.get("max_segment_duration", 90.0)
    
    def _emit_progress(self, stage: PipelineStage, progress: float, message: str, detail: str = ""):
        """Send progress update to callback if registered."""
        if self.progress_callback:
            self.progress_callback(PipelineProgress(
                stage=stage,
                progress=progress,
                message=message,
                detail=detail,
            ))
    
    def run(
        self,
        transcript_segments: List[Dict[str, Any]],
        visual_metadata: List[Dict[str, Any]] = None,
    ) -> PipelineResult:
        """
        Run the story-first pipeline on transcript segments.
        
        Args:
            transcript_segments: List of segments with keys:
                - id: unique identifier
                - start: start time in seconds
                - end: end time in seconds
                - transcript: text content
                - patterns: (optional) detected audio patterns
            
            visual_metadata: List of visual quality data per segment:
                - speech_ratio: fraction of speech
                - boundary_score: VAD boundary alignment
        
        Returns:
            PipelineResult with survivors and gate summary
        """
        try:
            self._emit_progress(PipelineStage.INIT, 0.0, "Starting story analysis...")
            
            # Step 1: Analyze narrative structure
            self._emit_progress(PipelineStage.ANALYZE, 0.1, "Analyzing narrative structure...")
            
            narrative_units = batch_detect_narrative_structure(
                segments=transcript_segments,
                ai_provider=self.ai_provider,
            )
            
            self._emit_progress(
                PipelineStage.ANALYZE, 
                0.5, 
                f"Analyzed {len(narrative_units)} segments"
            )
            
            # Step 2: Apply quality gates
            self._emit_progress(PipelineStage.GATE, 0.6, "Applying quality gates...")
            
            survivors, gate_reports = apply_gates_batch(
                units=narrative_units,
                visual_metadata_list=visual_metadata,
            )
            
            gate_summary = summarize_gate_results(gate_reports)
            
            self._emit_progress(
                PipelineStage.GATE,
                0.8,
                gate_summary["message"]
            )
            
            # Step 3: Rank survivors by confidence
            survivors_sorted = sorted(
                survivors,
                key=lambda u: u.confidence,
                reverse=True,
            )
            
            # Limit to target count
            final_survivors = survivors_sorted[:self.target_clips]
            
            # Step 4: Complete
            self._emit_progress(
                PipelineStage.COMPLETE,
                1.0,
                f"Complete: {len(final_survivors)} clips ready to ship"
            )
            
            return PipelineResult(
                success=True,
                survivors=final_survivors,
                dropped_count=len(narrative_units) - len(final_survivors),
                total_candidates=len(narrative_units),
                gate_summary=gate_summary,
            )
            
        except Exception as e:
            self._emit_progress(PipelineStage.ERROR, 0.0, f"Error: {str(e)}")
            return PipelineResult(
                success=False,
                survivors=[],
                dropped_count=0,
                total_candidates=len(transcript_segments),
                gate_summary={},
                error=str(e),
            )
    
    def run_from_transcript(
        self,
        full_transcript: str,
        word_timestamps: List[Dict[str, Any]] = None,
    ) -> PipelineResult:
        """
        Run pipeline from a full transcript.
        
        Segments the transcript first, then runs analysis.
        """
        # Simple sentence-based segmentation
        segments = self._segment_transcript(full_transcript, word_timestamps)
        return self.run(segments)
    
    def _segment_transcript(
        self,
        transcript: str,
        word_timestamps: List[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Segment a transcript into potential clip candidates.
        
        Uses sentence boundaries and target duration to create segments.
        """
        import re
        
        # Split into sentences
        sentences = re.split(r'(?<=[.!?])\s+', transcript)
        
        segments = []
        current_segment = {
            "id": f"seg_0",
            "start": 0.0,
            "end": 0.0,
            "transcript": "",
            "sentences": [],
        }
        
        seg_index = 0
        current_duration = 0.0
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            # Estimate duration (rough: 150 words per minute)
            word_count = len(sentence.split())
            estimated_duration = (word_count / 150) * 60
            
            # Add to current segment
            current_segment["sentences"].append(sentence)
            current_segment["transcript"] = " ".join(current_segment["sentences"])
            current_duration += estimated_duration
            current_segment["end"] = current_segment["start"] + current_duration
            
            # Check if segment is long enough
            if current_duration >= self.min_segment_duration:
                # Finalize segment
                segments.append(current_segment.copy())
                
                # Start new segment
                seg_index += 1
                current_segment = {
                    "id": f"seg_{seg_index}",
                    "start": current_segment["end"],
                    "end": current_segment["end"],
                    "transcript": "",
                    "sentences": [],
                }
                current_duration = 0.0
        
        # Add final segment if it has content
        if current_segment["sentences"]:
            segments.append(current_segment)
        
        return segments


def run_story_pipeline(
    transcript_segments: List[Dict[str, Any]],
    config: Dict[str, Any] = None,
    ai_provider: Any = None,
    visual_metadata: List[Dict[str, Any]] = None,
    progress_callback: callable = None,
) -> PipelineResult:
    """
    Convenience function to run the story pipeline.
    
    Example:
        result = run_story_pipeline(
            transcript_segments=[
                {"id": "1", "start": 0, "end": 45, "transcript": "..."},
                {"id": "2", "start": 45, "end": 90, "transcript": "..."},
            ]
        )
        
        for clip in result.survivors:
            print(f"Ship: {clip.clip_id} ({clip.confidence_label})")
    """
    pipeline = StoryPipeline(
        config=config,
        ai_provider=ai_provider,
        progress_callback=progress_callback,
    )
    return pipeline.run(transcript_segments, visual_metadata)

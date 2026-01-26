"""
Story Selection Integration

This module integrates the new narrative-first pipeline with
the existing PodFlow Studio system.

It provides a drop-in replacement for the old thinker selection
that uses NarrativeUnit validation and quality gates.

ARCHITECTURE:
- Receives enriched clips from existing detector.py
- Converts to NarrativeUnits
- Applies quality gates
- Returns survivors in the expected format

This is the BRIDGE between old and new systems.
"""

import os
import sys

# Add core to path
core_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "core")
sys.path.insert(0, core_path)

from typing import List, Dict, Any, Tuple, Optional
from dataclasses import asdict

# Import new core modules
from narrative.unit import NarrativeUnit, NarrativeVerdict, create_narrative_unit
from narrative.detector import detect_narrative_structure
from narrative.gate import apply_gates_batch, summarize_gate_results, GateReport
from pipeline.config import PipelineConfig, GATE_THRESHOLDS

# Import existing schemas for compatibility
try:
    from .schemas import MeaningCard, FinalDecision
except ImportError:
    # Fallback for standalone testing
    from schemas import MeaningCard, FinalDecision


def _clip_to_narrative_unit(
    clip: Dict[str, Any],
    meaning_card: Optional[MeaningCard] = None,
) -> NarrativeUnit:
    """
    Convert an existing clip + MeaningCard to a NarrativeUnit.
    
    This bridges the old format to the new narrative-first format.
    """
    clip_id = clip.get("id", f"clip_{clip.get('startTime', 0)}")
    start_time = float(clip.get("startTime", 0.0))
    end_time = float(clip.get("endTime", start_time + clip.get("duration", 0.0)))
    transcript = clip.get("transcript", "")
    
    # Extract story elements from MeaningCard if available
    has_setup = False
    has_core = False
    has_resolution = False
    confidence = 0.0
    context_dependency = 0.5
    
    if meaning_card:
        # Map MeaningCard fields to story elements
        complete_thought = meaning_card.complete_thought
        quality = meaning_card.quality_score_1to10
        
        # Infer story elements from existing signals
        # This is a heuristic bridge until AI detection is fully integrated
        if meaning_card.post_worthy:
            has_core = True
            
        if complete_thought:
            has_resolution = True
            
        # Categories that suggest setup
        if meaning_card.category in ("story", "advice"):
            has_setup = True
        elif meaning_card.summary and len(meaning_card.summary) > 50:
            has_setup = True
            
        # Categories that suggest core
        if meaning_card.category in ("insightful", "hot_take"):
            has_core = True
            
        # Map quality to confidence
        confidence = min(1.0, quality / 10.0)
        
        # Context dependency from flags
        if "needs_context" in meaning_card.flags:
            context_dependency = 0.8
        elif complete_thought:
            context_dependency = 0.3
    else:
        # No MeaningCard - use heuristics on transcript
        return detect_narrative_structure(
            clip_id=clip_id,
            start_time=start_time,
            end_time=end_time,
            transcript=transcript,
            ai_provider=None,  # Heuristic mode
            patterns=clip.get("patterns", []),
        )
    
    return create_narrative_unit(
        clip_id=clip_id,
        start_time=start_time,
        end_time=end_time,
        transcript=transcript,
        has_setup=has_setup,
        has_core=has_core,
        has_resolution=has_resolution,
        confidence=confidence,
        context_dependency=context_dependency,
        patterns=clip.get("patterns", []),
    )


def _extract_visual_metadata(clip: Dict[str, Any]) -> Dict[str, Any]:
    """Extract visual/audio quality metadata from clip."""
    gates = clip.get("gates", {})
    
    return {
        "speech_ratio": gates.get("speechRatioWindow", 0.8),
        "boundary_score": 0.8,  # Default, could be computed from VAD
    }


def select_narrative_complete(
    enriched_clips: List[Dict[str, Any]],
    meaning_cards: Dict[str, MeaningCard],
    target_n: int = 10,
    config: PipelineConfig = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    NEW SELECTION LOGIC: Narrative-first with quality gates.
    
    This replaces the old diversity-based selection.
    
    Args:
        enriched_clips: Clips with algorithm scores and gates
        meaning_cards: MeaningCard per clip ID
        target_n: Maximum clips to return
        config: Pipeline configuration
    
    Returns:
        Tuple of (selected_clips, summary)
    """
    if config is None:
        config = PipelineConfig()
    
    # Step 1: Convert to NarrativeUnits
    narrative_units = []
    visual_metadata = []
    
    for clip in enriched_clips:
        clip_id = clip.get("id")
        meaning_card = meaning_cards.get(clip_id)
        
        unit = _clip_to_narrative_unit(clip, meaning_card)
        narrative_units.append(unit)
        visual_metadata.append(_extract_visual_metadata(clip))
    
    # Step 2: Apply quality gates
    survivors, gate_reports = apply_gates_batch(
        units=narrative_units,
        visual_metadata_list=visual_metadata,
    )
    
    # Step 3: Create summary
    gate_summary = summarize_gate_results(gate_reports)
    
    # Step 4: Rank survivors by confidence
    survivors_sorted = sorted(
        survivors,
        key=lambda u: u.confidence,
        reverse=True,
    )
    
    # Limit to target count
    final_survivors = survivors_sorted[:target_n]
    
    # Step 5: Convert back to clip format for compatibility
    survivor_ids = {u.clip_id for u in final_survivors}
    selected_clips = []
    
    for clip in enriched_clips:
        if clip.get("id") in survivor_ids:
            # Find the corresponding NarrativeUnit
            unit = next((u for u in final_survivors if u.clip_id == clip.get("id")), None)
            if unit:
                # Augment clip with narrative data
                clip["narrativeUnit"] = unit.to_dict()
                clip["confidenceLabel"] = unit.confidence_label
                clip["storyComplete"] = unit.is_shippable
                selected_clips.append(clip)
    
    # Sort by confidence
    selected_clips.sort(key=lambda c: c.get("narrativeUnit", {}).get("confidence", 0), reverse=True)
    
    return selected_clips, {
        "total_candidates": len(enriched_clips),
        "survivors": len(final_survivors),
        "dropped": len(enriched_clips) - len(final_survivors),
        "survival_rate": gate_summary.get("survival_rate", 0),
        "failures_by_gate": gate_summary.get("failures_by_gate", {}),
        "message": gate_summary.get("message", ""),
    }


def select_best_set_narrative(
    enriched_clips: List[Dict[str, Any]],
    context_pack: Dict[str, Any],
    target_n: int = 10,
    api_key: Optional[str] = None,
    model: str = "gpt-4o-mini",
) -> FinalDecision:
    """
    Drop-in replacement for the old select_best_set function.
    
    Uses narrative-first selection with quality gates.
    
    Args:
        enriched_clips: Clips with MeaningCard data attached
        context_pack: Context and constraints
        target_n: Maximum clips to select
        api_key: Optional API key for AI detection
        model: AI model to use
    
    Returns:
        FinalDecision with selected clip IDs and ranking
    """
    # Extract MeaningCards from enriched clips
    meaning_cards = {}
    for clip in enriched_clips:
        clip_id = clip.get("id")
        mc_data = clip.get("meaningCard", {})
        if mc_data:
            try:
                meaning_cards[clip_id] = MeaningCard(
                    post_worthy=mc_data.get("post_worthy", False),
                    complete_thought=mc_data.get("complete_thought", False),
                    category=mc_data.get("category", "other"),
                    summary=mc_data.get("summary", ""),
                    hook_text=mc_data.get("hook_text", ""),
                    title_candidates=mc_data.get("title_candidates", []),
                    quality_score_1to10=mc_data.get("quality_score_1to10", 5),
                    quality_multiplier=mc_data.get("quality_multiplier", 1.0),
                    flags=mc_data.get("flags", []),
                )
            except Exception:
                pass
    
    # Run narrative-first selection
    selected_clips, summary = select_narrative_complete(
        enriched_clips=enriched_clips,
        meaning_cards=meaning_cards,
        target_n=target_n,
    )
    
    # Build FinalDecision
    selected_ids = [c.get("id") for c in selected_clips]
    ranking = []
    for i, clip in enumerate(selected_clips):
        narrative = clip.get("narrativeUnit", {})
        ranking.append({
            "id": clip.get("id"),
            "rank": i + 1,
            "confidence": narrative.get("confidence", 0),
            "confidence_label": narrative.get("confidence_label", ""),
            "story_elements": narrative.get("story_element_count", 0),
            "verdict": narrative.get("verdict", ""),
        })
    
    notes = [
        summary.get("message", ""),
        f"Survival rate: {summary.get('survival_rate', 0):.0%}",
    ]
    
    return FinalDecision(
        selected_ids=selected_ids,
        ranking=ranking,
        global_notes=notes,
    )

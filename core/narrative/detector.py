"""
Narrative Structure Detector

Uses AI to analyze transcript segments and determine story structure.
This is the BRAIN that decides if a segment has:
- Setup (context, question, claim)
- Core (explanation, tension, insight)
- Resolution (takeaway, conclusion)

IMPORTANT: This module returns HONEST assessments.
If a segment doesn't have story structure, say so.
The gate will handle rejection.
"""

import json
import re
from typing import Dict, Any, Optional, List, Tuple

from .unit import NarrativeUnit, create_narrative_unit


# Prompt for AI narrative analysis
NARRATIVE_ANALYSIS_PROMPT = """You are an expert editorial analyst evaluating podcast segments for story completeness.

Analyze this transcript segment and determine if it contains a COMPLETE micro-story.

A complete micro-story must have at least 2 of these 3 elements:
1. SETUP: Context, question, claim, or premise that establishes what we're talking about
2. CORE: The main explanation, tension, insight, or "meat" of the point
3. RESOLUTION: A takeaway, conclusion, landing, or payoff

STRICT RULES:
- A random quote is NOT a story
- An unfinished thought is NOT a story  
- Context without payoff is NOT a story
- A punchline without setup is NOT a story

TRANSCRIPT:
---
{transcript}
---

Respond in this exact JSON format:
{{
    "has_setup": true/false,
    "has_core": true/false,
    "has_resolution": true/false,
    "confidence": 0.0-1.0,
    "context_dependency": 0.0-1.0,
    "story_summary": "One sentence summary of the story arc",
    "reasoning": "Brief explanation of your assessment"
}}

Be STRICT. When in doubt, mark as false. We prefer fewer, better clips."""


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    """Extract JSON from potentially markdown-wrapped response."""
    cleaned = text.strip()
    
    # Remove markdown code blocks
    if cleaned.startswith("```"):
        parts = cleaned.split("```")
        if len(parts) > 1:
            cleaned = parts[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    
    # Find JSON object
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    
    try:
        return json.loads(cleaned[start:end + 1])
    except json.JSONDecodeError:
        return None


def _parse_narrative_response(response: str) -> Dict[str, Any]:
    """Parse AI response into structured narrative data."""
    parsed = _extract_json(response)
    
    if not parsed:
        # Fallback: conservative defaults
        return {
            "has_setup": False,
            "has_core": False,
            "has_resolution": False,
            "confidence": 0.0,
            "context_dependency": 1.0,
            "story_summary": "",
            "reasoning": "Failed to parse AI response",
        }
    
    return {
        "has_setup": bool(parsed.get("has_setup", False)),
        "has_core": bool(parsed.get("has_core", False)),
        "has_resolution": bool(parsed.get("has_resolution", False)),
        "confidence": float(parsed.get("confidence", 0.0)),
        "context_dependency": float(parsed.get("context_dependency", 1.0)),
        "story_summary": str(parsed.get("story_summary", "")),
        "reasoning": str(parsed.get("reasoning", "")),
    }


async def detect_narrative_structure_async(
    clip_id: str,
    start_time: float,
    end_time: float,
    transcript: str,
    ai_provider: Any,
    patterns: List[str] = None,
) -> NarrativeUnit:
    """
    Async version: Analyze a transcript segment for narrative structure using AI.
    
    Args:
        clip_id: Unique identifier for this clip candidate
        start_time: Start time in seconds
        end_time: End time in seconds
        transcript: The text content of this segment
        ai_provider: AI provider instance (OpenAI, Gemini, Anthropic)
        patterns: Detected audio patterns (payoff, monologue, etc.)
    
    Returns:
        NarrativeUnit with verdict (PASS or DROP)
    """
    # Skip if transcript is too short
    word_count = len(transcript.split())
    if word_count < 10:
        return create_narrative_unit(
            clip_id=clip_id,
            start_time=start_time,
            end_time=end_time,
            transcript=transcript,
            has_setup=False,
            has_core=False,
            has_resolution=False,
            confidence=0.0,
            context_dependency=1.0,
            patterns=patterns,
        )
    
    # Call AI for narrative analysis
    prompt = NARRATIVE_ANALYSIS_PROMPT.format(transcript=transcript)
    
    try:
        response = await ai_provider.generate(prompt)
        parsed = _parse_narrative_response(response)
    except Exception as e:
        # On error, be conservative: DROP
        parsed = {
            "has_setup": False,
            "has_core": False,
            "has_resolution": False,
            "confidence": 0.0,
            "context_dependency": 1.0,
        }
    
    return create_narrative_unit(
        clip_id=clip_id,
        start_time=start_time,
        end_time=end_time,
        transcript=transcript,
        has_setup=parsed["has_setup"],
        has_core=parsed["has_core"],
        has_resolution=parsed["has_resolution"],
        confidence=parsed["confidence"],
        context_dependency=parsed["context_dependency"],
        patterns=patterns,
    )


def detect_narrative_structure(
    clip_id: str,
    start_time: float,
    end_time: float,
    transcript: str,
    ai_provider: Any = None,
    patterns: List[str] = None,
) -> NarrativeUnit:
    """
    Synchronous version: Analyze a transcript segment for narrative structure.
    
    If no AI provider is given, uses heuristic detection (less accurate).
    """
    if ai_provider is not None:
        # Use async in sync context
        import asyncio
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        return loop.run_until_complete(
            detect_narrative_structure_async(
                clip_id, start_time, end_time, transcript, ai_provider, patterns
            )
        )
    
    # Fallback: Heuristic detection (no AI)
    return _heuristic_narrative_detection(
        clip_id, start_time, end_time, transcript, patterns
    )


def _heuristic_narrative_detection(
    clip_id: str,
    start_time: float,
    end_time: float,
    transcript: str,
    patterns: List[str] = None,
) -> NarrativeUnit:
    """
    Heuristic-based narrative detection (no AI required).
    
    Uses linguistic patterns to estimate story structure.
    Less accurate than AI, but works offline.
    """
    text = transcript.lower()
    words = text.split()
    word_count = len(words)
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]
    sentence_count = len(sentences)
    
    # Too short = incomplete
    if word_count < 15 or sentence_count < 2:
        return create_narrative_unit(
            clip_id=clip_id,
            start_time=start_time,
            end_time=end_time,
            transcript=transcript,
            has_setup=False,
            has_core=False,
            has_resolution=False,
            confidence=0.2,
            context_dependency=0.8,
            patterns=patterns,
        )
    
    # Setup indicators
    setup_patterns = [
        r'\b(so|okay so|well|you know what|here\'s the thing|let me tell you)',
        r'\b(the question is|what if|imagine|think about)',
        r'\b(when i was|back in|one time|there was)',
        r'^(so\s)',
    ]
    has_setup = any(re.search(p, text) for p in setup_patterns)
    
    # Core indicators (middle substance)
    core_patterns = [
        r'\b(because|the reason|what happens is|the point is)',
        r'\b(actually|really|the truth is|in reality)',
        r'\b(but|however|the problem is|the thing is)',
    ]
    has_core = any(re.search(p, text) for p in core_patterns)
    
    # Resolution indicators
    resolution_patterns = [
        r'\b(so that\'s|and that\'s|which is why|the takeaway)',
        r'\b(in the end|ultimately|at the end of the day)',
        r'\b(and that|so now|which means|therefore)',
        r'[.!?]\s*$',  # Ends with punctuation (complete thought)
    ]
    has_resolution = any(re.search(p, text) for p in resolution_patterns)
    
    # If no clear patterns, infer from structure
    if not has_setup and sentence_count >= 2:
        # First sentence might be setup
        has_setup = len(sentences[0].split()) >= 5
    
    if not has_core and sentence_count >= 2:
        # Middle content exists
        has_core = word_count >= 30
    
    if not has_resolution and sentence_count >= 2:
        # Last sentence might be resolution
        last_sentence = sentences[-1] if sentences else ""
        has_resolution = len(last_sentence.split()) >= 4
    
    # Calculate confidence based on evidence strength
    element_count = sum([has_setup, has_core, has_resolution])
    base_confidence = element_count * 0.25
    
    # Boost for good length
    if 30 <= word_count <= 150:
        base_confidence += 0.15
    
    # Boost for clear sentence structure
    if 3 <= sentence_count <= 8:
        base_confidence += 0.1
    
    confidence = min(0.85, base_confidence)  # Cap for heuristics
    
    # Context dependency (higher if segment seems to start mid-thought)
    context_dependency = 0.3
    if text.startswith(("and ", "but ", "so ", "because ")):
        context_dependency = 0.6
    if text.startswith(("he ", "she ", "they ", "it ", "that ")):
        context_dependency = 0.7
    
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
        patterns=patterns,
    )


def batch_detect_narrative_structure(
    segments: List[Dict[str, Any]],
    ai_provider: Any = None,
) -> List[NarrativeUnit]:
    """
    Analyze multiple segments for narrative structure.
    
    Args:
        segments: List of dicts with keys: id, start, end, transcript, patterns
        ai_provider: Optional AI provider for enhanced detection
    
    Returns:
        List of NarrativeUnits (some will have verdict=DROP)
    """
    results = []
    
    for seg in segments:
        unit = detect_narrative_structure(
            clip_id=seg.get("id", f"clip_{seg.get('start', 0)}"),
            start_time=seg.get("start", 0.0),
            end_time=seg.get("end", 0.0),
            transcript=seg.get("transcript", ""),
            ai_provider=ai_provider,
            patterns=seg.get("patterns", []),
        )
        results.append(unit)
    
    return results

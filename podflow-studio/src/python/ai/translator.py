"""
Clip Translator Module

Converts ClipCard → MeaningCard using AI providers.
Supports multiple backends: OpenAI, Gemini, Anthropic, and local models.

The translator analyzes clip metadata (patterns, scores, transcript) and
produces human-understandable meaning: category, summary, title candidates,
quality assessment, and flags.

Usage:
    from ai.translator import translate_clip
    from ai.schemas import ClipCard
    
    # With API key (uses OpenAI by default)
    meaning = translate_clip(clip_card, context_pack, api_key="sk-...")
    
    # With specific provider
    meaning = translate_clip(clip_card, context_pack, provider="gemini", api_key="...")
    
    # Without API key (uses fallback heuristics)
    meaning = translate_clip(clip_card, context_pack)
"""

import json
import re
from dataclasses import asdict
from typing import Any, Dict, Optional

from .schemas import ClipCard, MeaningCard, validate_meaningcard


def _truncate(text: str, max_chars: int) -> str:
    """Truncate text to max_chars, breaking at word boundary."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rsplit(" ", 1)[0] + "..."


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    """Extract JSON from potentially markdown-wrapped response."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        parts = cleaned.split("```")
        if len(parts) > 1:
            cleaned = parts[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        return json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError:
        return None


def _build_prompt(clip_card: ClipCard, context_pack: Dict[str, Any]) -> str:
    """Build the translation prompt."""
    clip_payload = {
        "id": clip_card.id,
        "start": clip_card.start,
        "end": clip_card.end,
        "duration": clip_card.duration,
        "patterns": clip_card.patterns,
        "scores": clip_card.scores,
        "gates": clip_card.gates,
        "events": clip_card.events,
        "transcript": _truncate(clip_card.transcript, 1500),
    }
    pack_payload = {
        "pack_id": context_pack.get("pack_id"),
        "platform": context_pack.get("platform"),
        "niche": context_pack.get("niche"),
        "constraints": context_pack.get("constraints", {}),
        "title_style_rules": context_pack.get("title_style_rules"),
        "hook_style_rules": context_pack.get("hook_style_rules"),
        "scoring_bias": context_pack.get("scoring_bias", {}),
    }

    return (
        "You are a clip translator. Convert ClipCard into MeaningCard JSON.\n"
        "Return ONLY valid JSON with these keys and no extra keys:\n"
        "{"
        '"post_worthy": boolean, '
        '"complete_thought": boolean, '
        '"category": "funny"|"insightful"|"story"|"hot_take"|"advice"|"emotional"|"other", '
        '"summary": "1 sentence", '
        '"hook_text": "14 words or fewer", '
        '"title_candidates": ["title1","title2","title3?"], '
        '"quality_score_1to10": integer 1-10, '
        '"quality_multiplier": number 0.70-1.30, '
        '"flags": ["needs_context","rambling","weak_hook","music_risk"]\n'
        "}\n\n"
        f"ContextPack:\n{json.dumps(pack_payload, ensure_ascii=True)}\n\n"
        f"ClipCard:\n{json.dumps(clip_payload, ensure_ascii=True)}"
    )


def _build_repair_prompt(
    clip_card: ClipCard, context_pack: Dict[str, Any], raw_response: str
) -> str:
    """Build a prompt to repair malformed JSON response."""
    return (
        "Repair the following response into strict MeaningCard JSON.\n"
        "Return ONLY valid JSON with the required keys and no extra keys.\n\n"
        f"ContextPack:\n{json.dumps(context_pack, ensure_ascii=True)}\n\n"
        f"ClipCard:\n{json.dumps(asdict(clip_card), ensure_ascii=True)}\n\n"
        f"BrokenResponse:\n{raw_response}"
    )


def _first_sentence(text: str) -> str:
    """Extract first sentence from text."""
    match = re.search(r"[.!?]", text)
    if match:
        return text[: match.end()].strip()
    return text.strip()


def _limit_words(text: str, max_words: int) -> str:
    """Limit text to max_words."""
    words = text.split()
    if len(words) <= max_words:
        return text.strip()
    return " ".join(words[:max_words]).strip()


def _format_timestamp(seconds: float) -> str:
    """Format seconds as HH:MM:SS or MM:SS"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def _extract_key_phrase(transcript: str) -> str:
    """Extract a meaningful key phrase from transcript for title generation."""
    if not transcript:
        return ""
    
    # Clean up the transcript
    text = transcript.strip()
    
    # Look for phrases with strong words
    strong_words = ["never", "always", "best", "worst", "love", "hate", "think", 
                   "believe", "truth", "secret", "crazy", "amazing", "actually",
                   "important", "problem", "answer", "reason", "way"]
    
    sentences = re.split(r'[.!?]+', text)
    for sentence in sentences:
        sentence = sentence.strip()
        if len(sentence) < 10:
            continue
        words_lower = sentence.lower()
        for word in strong_words:
            if word in words_lower:
                return _limit_words(sentence, 8)
    
    # Fallback: use first meaningful sentence
    for sentence in sentences:
        sentence = sentence.strip()
        if len(sentence) >= 15:
            return _limit_words(sentence, 8)
    
    return _limit_words(text, 8)


def _fallback_meaningcard(clip_card: ClipCard, context_pack: Dict[str, Any]) -> MeaningCard:
    """
    Generate a MeaningCard using heuristic rules when AI is unavailable.
    
    This provides a reasonable baseline without requiring API calls,
    ensuring the app remains functional offline or without API keys.
    """
    transcript = clip_card.transcript.strip()
    constraints = context_pack.get("constraints", {})
    min_seconds = constraints.get("min_seconds")
    max_seconds = constraints.get("max_seconds")
    
    # Get timestamp for unique naming
    timestamp_str = _format_timestamp(clip_card.start)
    
    # Check duration constraints
    duration_ok = True
    if isinstance(min_seconds, (int, float)) and clip_card.duration < float(min_seconds):
        duration_ok = False
    if isinstance(max_seconds, (int, float)) and clip_card.duration > float(max_seconds):
        duration_ok = False
    
    # Check for complete thought (ends with punctuation)
    ends_with_punct = bool(transcript) and transcript[-1] in ".!?"
    complete_thought = bool(transcript) and ends_with_punct and duration_ok

    # Map patterns to categories and descriptive labels
    category_map = {
        "laughter": "funny",
        "debate": "hot_take",
        "monologue": "insightful",
        "payoff": "story",
    }
    pattern_labels = {
        "laughter": "Hilarious",
        "debate": "Heated",
        "monologue": "Passionate",
        "payoff": "Epic",
    }
    category = "other"
    pattern_label = "Interesting"
    for pattern in clip_card.patterns:
        if pattern in category_map:
            category = category_map[pattern]
            pattern_label = pattern_labels.get(pattern, "Interesting")
            break

    # Extract key phrase from transcript for more meaningful titles
    key_phrase = _extract_key_phrase(transcript)
    
    # Generate summary and hook from transcript
    if transcript:
        summary = _first_sentence(transcript)
        summary = _limit_words(summary, 28)
        # Make hook text more engaging
        hook_text = f'"{_limit_words(transcript, 10)}"'
    else:
        summary = f"{pattern_label} moment at {timestamp_str}."
        hook_text = f"Watch what happens at {timestamp_str}"

    # Generate UNIQUE title candidates with timestamp and content
    if key_phrase:
        title_candidates = [
            f'"{key_phrase}"',
            f"{pattern_label}: {_limit_words(key_phrase, 6)}",
            f"At {timestamp_str}: {_limit_words(key_phrase, 5)}",
        ]
    else:
        title_candidates = [
            f"{pattern_label} Moment @ {timestamp_str}",
            f"Must-See @ {timestamp_str}",
            f"{category.title()} Clip ({timestamp_str})",
        ]

    # Determine flags
    flags = []
    if not transcript:
        flags.append("no_transcript")
    if not complete_thought:
        flags.append("needs_context")

    meaning = {
        "post_worthy": complete_thought,
        "complete_thought": complete_thought,
        "category": category,
        "summary": summary,
        "hook_text": hook_text,
        "title_candidates": title_candidates[:4],
        "quality_score_1to10": 6,
        "quality_multiplier": 1.0,
        "flags": flags,
    }
    return validate_meaningcard(meaning)


def translate_clip(
    clip_card: ClipCard,
    context_pack: Dict[str, Any],
    model: str = "gpt-4o-mini",
    api_key: Optional[str] = None,
    provider: str = "openai",
) -> MeaningCard:
    """
    Translate a ClipCard into a MeaningCard using AI.
    
    Args:
        clip_card: The clip metadata to analyze
        context_pack: Platform/niche context and constraints
        model: Model name to use (provider-specific)
        api_key: API key for the provider
        provider: Provider to use ("openai", "gemini", "anthropic", "local")
        
    Returns:
        MeaningCard with semantic analysis of the clip
        
    Note:
        If no API key is provided or AI fails, falls back to
        heuristic-based translation that still produces usable results.
    """
    if api_key or provider == "local":
        try:
            # Use the provider abstraction
            from .providers import get_provider, AIProviderError
            
            ai_provider = get_provider(provider, api_key=api_key)
            
            # Map legacy model names to provider-appropriate defaults
            effective_model = model
            if provider != "openai" and model.startswith("gpt-"):
                # Use provider's default model instead of GPT model
                effective_model = ai_provider.default_model
            
            prompt = _build_prompt(clip_card, context_pack)
            
            # First attempt
            result = ai_provider.complete(
                prompt=prompt,
                schema={"type": "object"},  # Signal we want JSON
                model=effective_model,
                temperature=0.1,
                max_tokens=500,
            )
            
            parsed = result.parsed_json
            if parsed is None:
                parsed = _extract_json(result.content)
            
            if parsed is not None:
                return validate_meaningcard(parsed)
            
            # Repair attempt if first failed
            repair_prompt = _build_repair_prompt(clip_card, context_pack, result.content)
            repair_result = ai_provider.complete(
                prompt=repair_prompt,
                schema={"type": "object"},
                model=effective_model,
                temperature=0.1,
                max_tokens=500,
            )
            
            repaired = repair_result.parsed_json
            if repaired is None:
                repaired = _extract_json(repair_result.content)
            
            if repaired is not None:
                return validate_meaningcard(repaired)
                
        except ImportError:
            # Provider module not available, try legacy OpenAI
            pass
        except Exception:
            # Any error, fall back to heuristics
            pass
        
        # Legacy OpenAI fallback for backward compatibility
        if provider == "openai" and api_key:
            try:
                from openai import OpenAI

                client = OpenAI(api_key=api_key)
                prompt = _build_prompt(clip_card, context_pack)
                response = client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1,
                    max_tokens=500,
                )
                raw = response.choices[0].message.content or ""
                parsed = _extract_json(raw)
                if parsed is not None:
                    return validate_meaningcard(parsed)

                repair_prompt = _build_repair_prompt(clip_card, context_pack, raw)
                repair = client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": repair_prompt}],
                    temperature=0.1,
                    max_tokens=500,
                )
                repaired_raw = repair.choices[0].message.content or ""
                repaired = _extract_json(repaired_raw)
                if repaired is not None:
                    return validate_meaningcard(repaired)
            except Exception:
                pass

    return _fallback_meaningcard(clip_card, context_pack)

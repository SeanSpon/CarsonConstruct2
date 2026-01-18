import json
import re
from dataclasses import asdict
from typing import Any, Dict, Optional

from .schemas import ClipCard, MeaningCard, validate_meaningcard


def _truncate(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rsplit(" ", 1)[0] + "..."


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
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
    return (
        "Repair the following response into strict MeaningCard JSON.\n"
        "Return ONLY valid JSON with the required keys and no extra keys.\n\n"
        f"ContextPack:\n{json.dumps(context_pack, ensure_ascii=True)}\n\n"
        f"ClipCard:\n{json.dumps(asdict(clip_card), ensure_ascii=True)}\n\n"
        f"BrokenResponse:\n{raw_response}"
    )


def _first_sentence(text: str) -> str:
    match = re.search(r"[.!?]", text)
    if match:
        return text[: match.end()].strip()
    return text.strip()


def _limit_words(text: str, max_words: int) -> str:
    words = text.split()
    if len(words) <= max_words:
        return text.strip()
    return " ".join(words[:max_words]).strip()


def _fallback_meaningcard(clip_card: ClipCard, context_pack: Dict[str, Any]) -> MeaningCard:
    transcript = clip_card.transcript.strip()
    constraints = context_pack.get("constraints", {})
    min_seconds = constraints.get("min_seconds")
    max_seconds = constraints.get("max_seconds")
    duration_ok = True
    if isinstance(min_seconds, (int, float)) and clip_card.duration < float(min_seconds):
        duration_ok = False
    if isinstance(max_seconds, (int, float)) and clip_card.duration > float(max_seconds):
        duration_ok = False
    ends_with_punct = bool(transcript) and transcript[-1] in ".!?"
    complete_thought = bool(transcript) and ends_with_punct and duration_ok

    category_map = {
        "laughter": "funny",
        "debate": "hot_take",
        "monologue": "insightful",
        "payoff": "story",
    }
    category = "other"
    for pattern in clip_card.patterns:
        if pattern in category_map:
            category = category_map[pattern]
            break

    if transcript:
        summary = _first_sentence(transcript)
        summary = _limit_words(summary, 28)
        hook_text = _limit_words(transcript, 14)
    else:
        summary = f"{category.title()} clip candidate."
        hook_text = f"{category.title()} moment worth reviewing"

    title_seed = hook_text if transcript else summary
    title_seed = _limit_words(title_seed, 10)
    title_candidates = [
        f"{category.title()} moment: {title_seed}",
        f"Why this {category.replace('_', ' ')} moment stands out",
    ]
    if transcript:
        title_candidates.append(_limit_words(summary, 10))

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
) -> MeaningCard:
    if api_key:
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

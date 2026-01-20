import hashlib
import json
import os
from dataclasses import asdict
from typing import Any, Callable, Dict, List, Optional

from .schemas import ClipCard, MeaningCard, validate_clipcard, validate_meaningcard
from .thinker import select_best_set
from .transcription import get_transcript_for_clip
from .translator import translate_clip


def _default_context_pack(settings: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "pack_id": "default",
        "platform": "generic",
        "niche": "general_podcast",
        "constraints": {
            "min_seconds": settings.get("min_duration", 15),
            "max_seconds": settings.get("max_duration", 90),
            "prefer_complete_thought": True,
            "min_gap_seconds": settings.get("min_gap_seconds", 30.0),
        },
        "title_style_rules": "Short, curiosity-driven, avoid clickbait slurs.",
        "hook_style_rules": "14 words or fewer, understandable standalone.",
        "scoring_bias": {},
    }


def _load_context_pack(pack_id: str, settings: Dict[str, Any]) -> Dict[str, Any]:
    base_dir = os.path.dirname(os.path.dirname(__file__))
    pack_path = os.path.join(base_dir, "context_packs", f"{pack_id}.json")
    if not os.path.exists(pack_path):
        return _default_context_pack(settings)
    try:
        with open(pack_path, "r", encoding="utf-8") as handle:
            pack = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return _default_context_pack(settings)

    constraints = pack.get("constraints", {})
    constraints["min_seconds"] = settings.get(
        "min_duration", constraints.get("min_seconds", 15)
    )
    constraints["max_seconds"] = settings.get(
        "max_duration", constraints.get("max_seconds", 90)
    )
    constraints["min_gap_seconds"] = settings.get(
        "min_gap_seconds", constraints.get("min_gap_seconds", 30.0)
    )
    pack["constraints"] = constraints
    return pack


def _cache_dir(settings: Dict[str, Any]) -> str:
    custom = settings.get("ai_cache_dir")
    if custom:
        return custom
    base_dir = os.path.dirname(os.path.dirname(__file__))
    return os.path.join(base_dir, ".cache", "ai")


def _build_cache_key(
    pack_id: str, model: str, clip_card: ClipCard, transcript_snippet: str
) -> str:
    payload = {
        "pack_id": pack_id,
        "model": model,
        "start": clip_card.start,
        "end": clip_card.end,
        "patterns": clip_card.patterns,
        "scores": clip_card.scores,
        "transcript": transcript_snippet,
    }
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=True).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _read_cached_meaning(cache_dir: str, cache_key: str) -> Optional[MeaningCard]:
    path = os.path.join(cache_dir, f"{cache_key}.json")
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        return validate_meaningcard(payload)
    except (OSError, json.JSONDecodeError, ValueError):
        return None


def _write_cached_meaning(cache_dir: str, cache_key: str, meaning: MeaningCard) -> None:
    os.makedirs(cache_dir, exist_ok=True)
    path = os.path.join(cache_dir, f"{cache_key}.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(asdict(meaning), handle, ensure_ascii=True)


def _build_events(clip: Dict[str, Any]) -> List[Dict[str, Any]]:
    pattern = clip.get("pattern")
    events: List[Dict[str, Any]] = []
    if pattern:
        event = {"type": pattern}
        if pattern == "payoff":
            if "silenceDuration" in clip:
                event["silence_duration"] = clip.get("silenceDuration")
            if "spikeIntensity" in clip:
                event["spike_intensity"] = clip.get("spikeIntensity")
        events.append(event)
    return events


def _build_gates(clip: Dict[str, Any]) -> Dict[str, Any]:
    gates: Dict[str, Any] = {}
    clipworthiness = clip.get("clipworthiness", {}) or {}
    hard_gates = clipworthiness.get("hardGates", {}) or {}
    if hard_gates:
        gates.update(hard_gates)
        gates["speech_pass"] = all(bool(val) for val in hard_gates.values())
    else:
        gates["speech_pass"] = True

    metrics = clipworthiness.get("gateMetrics", {}) or {}
    for key in ["speech_ratio", "speech_seconds", "flatness_median"]:
        if key in metrics:
            gates[key] = metrics.get(key)
    return gates


def _build_clipcard(clip: Dict[str, Any], transcript_snippet: str) -> ClipCard:
    clip_payload = {
        "id": clip.get("id"),
        "start": clip.get("startTime"),
        "end": clip.get("endTime"),
        "duration": clip.get("duration"),
        "patterns": [clip.get("pattern")] if clip.get("pattern") else [],
        "scores": {
            "algorithmScore": clip.get("algorithmScore", 0.0),
            "finalScore": clip.get("finalScore", clip.get("algorithmScore", 0.0)),
            "hookStrength": clip.get("hookStrength", 0.0),
        },
        "gates": _build_gates(clip),
        "events": _build_events(clip),
        "transcript": transcript_snippet,
    }
    return validate_clipcard(clip_payload)


def _apply_meaning_to_clip(clip: Dict[str, Any], meaning: MeaningCard) -> None:
    # Only override title if we have a good AI-generated one
    new_title = meaning.title_candidates[0] if meaning.title_candidates else ""
    existing_title = clip.get("title", "")
    
    # Prefer AI-generated title, but keep existing if AI returned generic/empty
    if new_title and not new_title.startswith("Other moment"):
        clip["title"] = new_title
    elif not existing_title:
        clip["title"] = new_title
    # else: keep existing pre-generated title from pattern detection
    
    # Same for hook text - prefer AI but keep existing if empty
    new_hook = meaning.hook_text
    existing_hook = clip.get("hookText", "")
    if new_hook and len(new_hook) > 10:
        clip["hookText"] = new_hook
    elif not existing_hook:
        clip["hookText"] = new_hook
    # else: keep existing pre-generated hook from pattern detection
    
    clip["category"] = meaning.category
    clip["completeThought"] = meaning.complete_thought
    clip["flags"] = meaning.flags
    clip["qualityMultiplier"] = meaning.quality_multiplier
    clip["summary"] = meaning.summary

    base_score = clip.get("finalScore", clip.get("algorithmScore", 0.0))
    clip["finalScore"] = round(min(100.0, float(base_score) * meaning.quality_multiplier), 2)


def _fallback_algorithmic(candidates: List[Dict[str, Any]], target_n: int) -> List[Dict[str, Any]]:
    sorted_clips = sorted(
        candidates,
        key=lambda c: c.get("finalScore", c.get("algorithmScore", 0.0)),
        reverse=True,
    )
    return sorted_clips[:target_n]


def run_ai_enhancement(
    candidates: List[Dict[str, Any]],
    transcript: Optional[Dict[str, Any]],
    settings: Dict[str, Any],
    logger: Optional[Callable[[str], None]] = None,
    translator_fn: Optional[
        Callable[[ClipCard, Dict[str, Any], str, Optional[str]], MeaningCard]
    ] = None,
    thinker_fn: Optional[
        Callable[[List[Dict[str, Any]], Dict[str, Any], int, str, Optional[str]], Any]
    ] = None,
) -> List[Dict[str, Any]]:
    if not candidates:
        return []

    log = logger or (lambda message: print(message, flush=True))
    target_n = int(settings.get("target_count", 10))
    top_k = int(settings.get("ai_top_k", 25))
    if top_k < target_n:
        top_k = target_n

    model = settings.get("ai_model", "gpt-4o-mini")
    pack_id = settings.get("context_pack_id", "default")
    openai_key = settings.get("openai_api_key") or ""
    context_pack = _load_context_pack(pack_id, settings)
    cache_dir = _cache_dir(settings)

    translator_fn = translator_fn or translate_clip
    thinker_fn = thinker_fn or select_best_set

    try:
        ranked = sorted(
            candidates,
            key=lambda c: c.get("finalScore", c.get("algorithmScore", 0.0)),
            reverse=True,
        )
        shortlist = ranked[: min(len(ranked), top_k)]
        enriched: List[Dict[str, Any]] = []

        for clip in shortlist:
            clip_copy = dict(clip)
            transcript_snippet = ""
            if transcript:
                transcript_snippet = get_transcript_for_clip(
                    transcript, clip_copy.get("startTime", 0.0), clip_copy.get("endTime", 0.0)
                )
            clip_copy["transcript"] = (transcript_snippet or "")[:500]

            clip_card = _build_clipcard(clip_copy, transcript_snippet or "")
            cache_key = _build_cache_key(pack_id, model, clip_card, transcript_snippet or "")
            meaning = _read_cached_meaning(cache_dir, cache_key)
            if meaning is not None:
                log(f"AI_CACHE: hit {clip_card.id}")
            else:
                meaning = translator_fn(clip_card, context_pack, model, openai_key)
                _write_cached_meaning(cache_dir, cache_key, meaning)

            _apply_meaning_to_clip(clip_copy, meaning)
            enriched.append(clip_copy)

        decision = thinker_fn(enriched, context_pack, target_n, model, openai_key)
        decision_data = decision
        if hasattr(decision, "selected_ids"):
            decision_data = asdict(decision)
        selected_ids = decision_data.get("selected_ids", [])
        ranking = decision_data.get("ranking", [])

        if not selected_ids:
            return _fallback_algorithmic(candidates, target_n)

        clip_map = {clip["id"]: clip for clip in enriched if clip.get("id")}
        ordered: List[Dict[str, Any]] = []
        if ranking:
            for item in ranking:
                clip_id = item.get("id")
                if clip_id in clip_map:
                    ordered.append(clip_map[clip_id])
        else:
            for clip_id in selected_ids:
                if clip_id in clip_map:
                    ordered.append(clip_map[clip_id])

        if not ordered:
            return _fallback_algorithmic(candidates, target_n)

        return ordered[:target_n]
    except Exception as exc:
        log(f"AI_ENHANCEMENT: fallback due to {exc}")
        return _fallback_algorithmic(candidates, target_n)

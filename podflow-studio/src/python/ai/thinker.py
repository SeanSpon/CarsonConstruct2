import json
import re
from dataclasses import asdict
from typing import Any, Dict, List, Optional, Tuple

from .schemas import FinalDecision, validate_finaldecision


DEFAULT_DEDUPE_THRESHOLD = 0.6


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


def _tokenize(text: str) -> List[str]:
    return re.findall(r"[a-z0-9']+", text.lower())


def _overlap_ratio(a: str, b: str) -> float:
    a_tokens = set(_tokenize(a))
    b_tokens = set(_tokenize(b))
    if not a_tokens or not b_tokens:
        return 0.0
    overlap = len(a_tokens.intersection(b_tokens))
    return overlap / max(1, min(len(a_tokens), len(b_tokens)))


def _score_clip(clip: Dict[str, Any], prefer_complete: bool) -> float:
    base = float(clip.get("finalScore", clip.get("algorithmScore", 0.0)))
    complete = clip.get("completeThought")
    if prefer_complete:
        if complete is True:
            base *= 1.05
        elif complete is False:
            base *= 0.95
    return base


def _duration_ok(clip: Dict[str, Any], constraints: Dict[str, Any]) -> bool:
    min_seconds = constraints.get("min_seconds")
    max_seconds = constraints.get("max_seconds")
    duration = float(clip.get("duration", 0.0))
    if isinstance(min_seconds, (int, float)) and duration < float(min_seconds):
        return False
    if isinstance(max_seconds, (int, float)) and duration > float(max_seconds):
        return False
    return True


def _min_gap_ok(clip: Dict[str, Any], selected: List[Dict[str, Any]], min_gap: float) -> bool:
    if min_gap <= 0:
        return True
    start = float(clip.get("startTime", 0.0))
    for chosen in selected:
        if abs(start - float(chosen.get("startTime", 0.0))) < min_gap:
            return False
    return True


def _select_with_rules(
    sorted_clips: List[Dict[str, Any]],
    target_n: int,
    dedupe_threshold: float,
    min_gap: float,
) -> Tuple[List[Dict[str, Any]], List[str]]:
    selected: List[Dict[str, Any]] = []
    summaries: List[str] = []
    notes: List[str] = []
    selected_ids = set()

    for clip in sorted_clips:
        if len(selected) >= target_n:
            break
        clip_id = clip.get("id")
        if not clip_id or clip_id in selected_ids:
            continue
        if not _min_gap_ok(clip, selected, min_gap):
            continue
        summary = clip.get("summary", "") or ""
        if summary and dedupe_threshold < 1.0:
            if any(_overlap_ratio(summary, existing) >= dedupe_threshold for existing in summaries):
                continue
        selected.append(clip)
        summaries.append(summary)
        selected_ids.add(clip_id)

    if len(selected) < target_n:
        notes.append("selection_relaxed")

    return selected, notes


def _fallback_selection(
    enriched_clips: List[Dict[str, Any]],
    context_pack: Dict[str, Any],
    target_n: int,
) -> FinalDecision:
    constraints = context_pack.get("constraints", {})
    prefer_complete = bool(constraints.get("prefer_complete_thought", True))
    min_gap = float(constraints.get("min_gap_seconds", 30.0))
    dedupe_threshold = float(constraints.get("dedupe_threshold", DEFAULT_DEDUPE_THRESHOLD))

    filtered = [clip for clip in enriched_clips if _duration_ok(clip, constraints)]
    notes = []
    if len(filtered) < target_n:
        filtered = list(enriched_clips)
        notes.append("duration_constraints_relaxed")

    scored = sorted(filtered, key=lambda c: _score_clip(c, prefer_complete), reverse=True)

    selected, relax_notes = _select_with_rules(scored, target_n, dedupe_threshold, min_gap)
    notes.extend(relax_notes)

    if len(selected) < target_n:
        selected, relax_notes = _select_with_rules(scored, target_n, 1.0, min_gap)
        notes.extend(relax_notes)

    if len(selected) < target_n:
        selected, relax_notes = _select_with_rules(scored, target_n, 1.0, 0.0)
        notes.extend(relax_notes)

    if len(selected) < target_n:
        notes.append("insufficient_candidates")

    ranking = [
        {
            "id": clip.get("id", ""),
            "final_multiplier": float(clip.get("qualityMultiplier", 1.0)),
            "reason": "deterministic_rank",
        }
        for clip in selected
    ]

    decision = {
        "selected_ids": [clip.get("id", "") for clip in selected],
        "ranking": ranking,
        "global_notes": notes,
    }
    return validate_finaldecision(decision)


def _build_prompt(
    enriched_clips: List[Dict[str, Any]],
    context_pack: Dict[str, Any],
    target_n: int,
) -> str:
    payload = []
    for clip in enriched_clips:
        payload.append(
            {
                "id": clip.get("id"),
                "duration": clip.get("duration"),
                "category": clip.get("category"),
                "complete_thought": clip.get("completeThought"),
                "summary": clip.get("summary"),
                "finalScore": clip.get("finalScore"),
                "qualityMultiplier": clip.get("qualityMultiplier"),
            }
        )

    return (
        "You are a clip selector. Choose the best set with dedupe and constraints.\n"
        "Return ONLY valid JSON with keys: selected_ids, ranking, global_notes.\n"
        "ranking is a list of {id, final_multiplier, reason} in selection order.\n\n"
        f"TargetCount: {target_n}\n"
        f"ContextPack: {json.dumps(context_pack, ensure_ascii=True)}\n"
        f"Candidates: {json.dumps(payload, ensure_ascii=True)}"
    )


def select_best_set(
    enriched_clips: List[Dict[str, Any]],
    context_pack: Dict[str, Any],
    target_n: int,
    model: str = "gpt-4o-mini",
    api_key: Optional[str] = None,
) -> FinalDecision:
    if api_key:
        try:
            from openai import OpenAI

            top_candidates = sorted(
                enriched_clips,
                key=lambda c: float(c.get("finalScore", c.get("algorithmScore", 0.0))),
                reverse=True,
            )[:15]

            client = OpenAI(api_key=api_key)
            prompt = _build_prompt(top_candidates, context_pack, target_n)
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=500,
            )
            raw = response.choices[0].message.content or ""
            parsed = _extract_json(raw)
            if parsed is not None:
                decision = validate_finaldecision(parsed)
                if len(decision.selected_ids) == target_n:
                    return decision
        except Exception:
            pass

    return _fallback_selection(enriched_clips, context_pack, target_n)

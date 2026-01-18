from dataclasses import dataclass, asdict
from typing import Any, Dict, List


ALLOWED_CATEGORIES = {
    "funny",
    "insightful",
    "story",
    "hot_take",
    "advice",
    "emotional",
    "other",
}


def _ensure_keys(obj: Dict[str, Any], required: List[str], allow_extra: bool = False) -> None:
    missing = [key for key in required if key not in obj]
    if missing:
        raise ValueError(f"Missing keys: {missing}")
    if not allow_extra:
        extra = [key for key in obj.keys() if key not in required]
        if extra:
            raise ValueError(f"Unexpected keys: {extra}")


def _ensure_bool(name: str, value: Any) -> bool:
    if isinstance(value, bool):
        return value
    raise ValueError(f"{name} must be a bool")


def _ensure_str(name: str, value: Any) -> str:
    if isinstance(value, str):
        return value
    raise ValueError(f"{name} must be a string")


def _ensure_float(name: str, value: Any) -> float:
    if isinstance(value, bool):
        raise ValueError(f"{name} must be a float")
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be a float") from exc


def _ensure_int(name: str, value: Any) -> int:
    if isinstance(value, bool):
        raise ValueError(f"{name} must be an int")
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be an int") from exc


def _ensure_list(name: str, value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    raise ValueError(f"{name} must be a list")


def _ensure_list_of_str(name: str, value: Any) -> List[str]:
    values = _ensure_list(name, value)
    if not all(isinstance(item, str) for item in values):
        raise ValueError(f"{name} must be a list of strings")
    return values


@dataclass(frozen=True)
class ClipCard:
    id: str
    start: float
    end: float
    duration: float
    patterns: List[str]
    scores: Dict[str, float]
    gates: Dict[str, Any]
    events: List[Dict[str, Any]]
    transcript: str


@dataclass(frozen=True)
class MeaningCard:
    post_worthy: bool
    complete_thought: bool
    category: str
    summary: str
    hook_text: str
    title_candidates: List[str]
    quality_score_1to10: int
    quality_multiplier: float
    flags: List[str]


@dataclass(frozen=True)
class FinalDecision:
    selected_ids: List[str]
    ranking: List[Dict[str, Any]]
    global_notes: List[str]


def validate_clipcard(obj: Any) -> ClipCard:
    if not isinstance(obj, dict):
        raise ValueError("ClipCard must be a dict")

    _ensure_keys(
        obj,
        [
            "id",
            "start",
            "end",
            "duration",
            "patterns",
            "scores",
            "gates",
            "events",
            "transcript",
        ],
        allow_extra=True,
    )

    clip_id = _ensure_str("id", obj["id"])
    start = _ensure_float("start", obj["start"])
    end = _ensure_float("end", obj["end"])
    duration = _ensure_float("duration", obj["duration"])
    if duration <= 0 or end < start:
        raise ValueError("ClipCard duration or bounds invalid")

    patterns = _ensure_list_of_str("patterns", obj["patterns"])
    scores = obj["scores"]
    if not isinstance(scores, dict):
        raise ValueError("scores must be a dict")
    if "algorithmScore" not in scores:
        raise ValueError("scores must include algorithmScore")
    score_values = {}
    for key, value in scores.items():
        score_values[key] = _ensure_float(f"scores.{key}", value)

    gates = obj["gates"]
    if not isinstance(gates, dict):
        raise ValueError("gates must be a dict")

    events = obj["events"]
    if not isinstance(events, list):
        raise ValueError("events must be a list")
    for event in events:
        if not isinstance(event, dict):
            raise ValueError("events must be a list of dicts")

    transcript = _ensure_str("transcript", obj["transcript"])

    return ClipCard(
        id=clip_id,
        start=start,
        end=end,
        duration=duration,
        patterns=patterns,
        scores=score_values,
        gates=gates,
        events=events,
        transcript=transcript,
    )


def validate_meaningcard(obj: Any) -> MeaningCard:
    if isinstance(obj, MeaningCard):
        obj = asdict(obj)
    if not isinstance(obj, dict):
        raise ValueError("MeaningCard must be a dict")

    _ensure_keys(
        obj,
        [
            "post_worthy",
            "complete_thought",
            "category",
            "summary",
            "hook_text",
            "title_candidates",
            "quality_score_1to10",
            "quality_multiplier",
            "flags",
        ],
        allow_extra=False,
    )

    post_worthy = _ensure_bool("post_worthy", obj["post_worthy"])
    complete_thought = _ensure_bool("complete_thought", obj["complete_thought"])
    category = _ensure_str("category", obj["category"])
    if category not in ALLOWED_CATEGORIES:
        raise ValueError("category must be a supported value")

    summary = _ensure_str("summary", obj["summary"]).strip()
    if not summary:
        raise ValueError("summary must be non-empty")

    hook_text = _ensure_str("hook_text", obj["hook_text"]).strip()
    if not hook_text:
        raise ValueError("hook_text must be non-empty")
    if len(hook_text.split()) > 14:
        raise ValueError("hook_text exceeds 14 words")

    title_candidates = _ensure_list_of_str("title_candidates", obj["title_candidates"])
    if not 2 <= len(title_candidates) <= 4:
        raise ValueError("title_candidates must have 2-4 items")
    if any(not title.strip() for title in title_candidates):
        raise ValueError("title_candidates must be non-empty")

    quality_score = _ensure_int("quality_score_1to10", obj["quality_score_1to10"])
    if not 1 <= quality_score <= 10:
        raise ValueError("quality_score_1to10 must be 1-10")

    quality_multiplier = _ensure_float("quality_multiplier", obj["quality_multiplier"])
    if not 0.7 <= quality_multiplier <= 1.3:
        raise ValueError("quality_multiplier must be 0.7-1.3")

    flags = _ensure_list_of_str("flags", obj["flags"])

    return MeaningCard(
        post_worthy=post_worthy,
        complete_thought=complete_thought,
        category=category,
        summary=summary,
        hook_text=hook_text,
        title_candidates=title_candidates,
        quality_score_1to10=quality_score,
        quality_multiplier=quality_multiplier,
        flags=flags,
    )


def validate_finaldecision(obj: Any) -> FinalDecision:
    if isinstance(obj, FinalDecision):
        obj = asdict(obj)
    if not isinstance(obj, dict):
        raise ValueError("FinalDecision must be a dict")

    _ensure_keys(obj, ["selected_ids", "ranking", "global_notes"], allow_extra=False)

    selected_ids = _ensure_list_of_str("selected_ids", obj["selected_ids"])
    if len(set(selected_ids)) != len(selected_ids):
        raise ValueError("selected_ids must be unique")

    ranking = obj["ranking"]
    if not isinstance(ranking, list):
        raise ValueError("ranking must be a list")
    for item in ranking:
        if not isinstance(item, dict):
            raise ValueError("ranking entries must be dicts")
        _ensure_keys(item, ["id", "final_multiplier", "reason"], allow_extra=False)
        _ensure_str("ranking.id", item["id"])
        _ensure_float("ranking.final_multiplier", item["final_multiplier"])
        _ensure_str("ranking.reason", item["reason"])

    global_notes = _ensure_list_of_str("global_notes", obj["global_notes"])

    return FinalDecision(
        selected_ids=selected_ids,
        ranking=ranking,
        global_notes=global_notes,
    )

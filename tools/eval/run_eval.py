#!/usr/bin/env python3
"""
Minimal evaluation harness for clip detection.
Computes Precision@K, coverage, and per-pattern precision.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List


def _load_dataset(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def _normalize_truth(episode: Dict[str, Any]) -> List[Dict[str, Any]]:
    return (
        episode.get("ground_truth")
        or episode.get("clips")
        or episode.get("labels")
        or []
    )


def _normalize_predictions(episode: Dict[str, Any]) -> List[Dict[str, Any]]:
    return episode.get("predictions") or episode.get("clips_predicted") or []


def _score(pred: Dict[str, Any]) -> float:
    for key in ("finalScore", "algorithmScore", "score"):
        if key in pred:
            return float(pred[key])
    return 0.0


def _interval(item: Dict[str, Any]) -> tuple[float, float]:
    start = item.get("start", item.get("startTime"))
    end = item.get("end", item.get("endTime"))
    return float(start), float(end)


def _overlap_seconds(a: Dict[str, Any], b: Dict[str, Any]) -> float:
    a_start, a_end = _interval(a)
    b_start, b_end = _interval(b)
    start = max(a_start, b_start)
    end = min(a_end, b_end)
    return max(0.0, end - start)


def _is_match(
    pred: Dict[str, Any],
    truth: Dict[str, Any],
    overlap_ratio_threshold: float,
    min_overlap_s: float,
) -> bool:
    overlap = _overlap_seconds(pred, truth)
    pred_start, pred_end = _interval(pred)
    truth_start, truth_end = _interval(truth)
    pred_duration = max(1e-6, pred_end - pred_start)
    truth_duration = max(1e-6, truth_end - truth_start)
    overlap_ratio = overlap / min(pred_duration, truth_duration)
    return overlap >= min_overlap_s or overlap_ratio >= overlap_ratio_threshold


def evaluate_episode(
    episode: Dict[str, Any],
    k: int,
    overlap_ratio_threshold: float,
    min_overlap_s: float,
) -> Dict[str, Any]:
    truth = _normalize_truth(episode)
    predictions = _normalize_predictions(episode)
    predictions = sorted(predictions, key=_score, reverse=True)
    top_k = predictions[:k]

    matches = 0
    coverage = 0
    per_pattern = {}

    for pred in top_k:
        pattern = pred.get("pattern", "unknown")
        per_pattern.setdefault(pattern, {"count": 0, "matches": 0})
        per_pattern[pattern]["count"] += 1

        hit = any(
            _is_match(pred, gt, overlap_ratio_threshold, min_overlap_s)
            for gt in truth
        )
        if hit:
            matches += 1
            per_pattern[pattern]["matches"] += 1

    if matches > 0:
        coverage = 1

    precision_at_k = matches / float(k) if k else 0.0
    pattern_precision = {
        pattern: (stats["matches"] / stats["count"] if stats["count"] else 0.0)
        for pattern, stats in per_pattern.items()
    }

    return {
        "episode_id": episode.get("id") or episode.get("title") or "unknown",
        "precision_at_k": round(precision_at_k, 3),
        "coverage_at_k": coverage,
        "matches": matches,
        "predictions_considered": len(top_k),
        "pattern_precision": pattern_precision,
    }


def aggregate_report(results: List[Dict[str, Any]], k: int) -> Dict[str, Any]:
    if not results:
        return {
            "precision_at_k": 0.0,
            "coverage_at_k": 0.0,
            "episodes": [],
        }

    precision_avg = sum(r["precision_at_k"] for r in results) / len(results)
    coverage_avg = sum(r["coverage_at_k"] for r in results) / len(results)
    pattern_totals: Dict[str, Dict[str, float]] = {}

    for result in results:
        for pattern, precision in result["pattern_precision"].items():
            pattern_totals.setdefault(pattern, {"sum": 0.0, "count": 0})
            pattern_totals[pattern]["sum"] += precision
            pattern_totals[pattern]["count"] += 1

    pattern_precision = {
        pattern: round(stats["sum"] / stats["count"], 3)
        for pattern, stats in pattern_totals.items()
        if stats["count"]
    }

    return {
        "precision_at_k": round(precision_avg, 3),
        "coverage_at_k": round(coverage_avg, 3),
        "k": k,
        "pattern_precision": pattern_precision,
        "episodes": results,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Run clip detection evaluation.")
    parser.add_argument("--dataset", required=True, help="Path to dataset JSON")
    parser.add_argument("--k", type=int, default=10, help="Precision@K cutoff")
    parser.add_argument(
        "--overlap",
        type=float,
        default=0.3,
        help="Overlap ratio threshold for a match",
    )
    parser.add_argument(
        "--min-overlap-s",
        type=float,
        default=1.0,
        help="Minimum overlap seconds for a match",
    )
    parser.add_argument(
        "--output",
        default="tools/eval/report.json",
        help="Output report path",
    )
    args = parser.parse_args()

    dataset_path = Path(args.dataset)
    dataset = _load_dataset(dataset_path)
    episodes = dataset.get("episodes", [])

    results = [
        evaluate_episode(episode, args.k, args.overlap, args.min_overlap_s)
        for episode in episodes
    ]
    report = aggregate_report(results, args.k)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

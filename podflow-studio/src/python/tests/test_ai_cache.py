import os
import tempfile
import unittest

from ai.orchestrator import run_ai_enhancement
from ai.schemas import validate_finaldecision, validate_meaningcard


class TestAiCache(unittest.TestCase):
    def test_cache_skips_recompute(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            settings = {
                "target_count": 1,
                "ai_top_k": 1,
                "min_duration": 5,
                "max_duration": 60,
                "ai_cache_dir": tmpdir,
            }
            candidates = [
                {
                    "id": "payoff_1",
                    "startTime": 10.0,
                    "endTime": 20.0,
                    "duration": 10.0,
                    "pattern": "payoff",
                    "patternLabel": "Payoff Moment",
                    "description": "Test clip",
                    "algorithmScore": 80.0,
                    "finalScore": 80.0,
                    "hookStrength": 50.0,
                    "clipworthiness": {"hardGates": {"speech_ratio": True, "flatness": True, "speech_seconds": True}},
                }
            ]

            calls = {"count": 0}

            def translator_stub(clip_card, context_pack, model, api_key=None):
                calls["count"] += 1
                return validate_meaningcard(
                    {
                        "post_worthy": True,
                        "complete_thought": True,
                        "category": "story",
                        "summary": "A short story moment.",
                        "hook_text": "A short story moment",
                        "title_candidates": ["Story moment", "Short story clip"],
                        "quality_score_1to10": 6,
                        "quality_multiplier": 1.0,
                        "flags": [],
                    }
                )

            def thinker_stub(enriched_clips, context_pack, target_n, model, api_key=None):
                decision = {
                    "selected_ids": [enriched_clips[0]["id"]],
                    "ranking": [
                        {
                            "id": enriched_clips[0]["id"],
                            "final_multiplier": 1.0,
                            "reason": "stub",
                        }
                    ],
                    "global_notes": [],
                }
                return validate_finaldecision(decision)

            run_ai_enhancement(
                candidates,
                transcript=None,
                settings=settings,
                translator_fn=translator_stub,
                thinker_fn=thinker_stub,
            )
            self.assertEqual(calls["count"], 1)

            def translator_fail(*_args, **_kwargs):
                raise AssertionError("Translator should not be called on cache hit")

            run_ai_enhancement(
                candidates,
                transcript=None,
                settings=settings,
                translator_fn=translator_fail,
                thinker_fn=thinker_stub,
            )
            self.assertEqual(calls["count"], 1)

            cached_files = [name for name in os.listdir(tmpdir) if name.endswith(".json")]
            self.assertTrue(len(cached_files) >= 1)


if __name__ == "__main__":
    unittest.main()

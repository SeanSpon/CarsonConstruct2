import unittest

from ai.schemas import validate_clipcard, validate_meaningcard
from ai.thinker import select_best_set
from ai.translator import translate_clip


class TestAiFallbacks(unittest.TestCase):
    def test_translator_fallback_without_api_key(self):
        clip_card = validate_clipcard(
            {
                "id": "payoff_1",
                "start": 10.0,
                "end": 25.0,
                "duration": 15.0,
                "patterns": ["payoff"],
                "scores": {"algorithmScore": 80.0, "finalScore": 82.0, "hookStrength": 70.0},
                "gates": {"speech_pass": True},
                "events": [],
                "transcript": "This is a complete thought.",
            }
        )
        context_pack = {"constraints": {"min_seconds": 5, "max_seconds": 90}}
        meaning = translate_clip(clip_card, context_pack, api_key=None)
        validate_meaningcard(meaning)

    def test_thinker_fallback_dedupes(self):
        context_pack = {
            "constraints": {"min_seconds": 5, "max_seconds": 60, "prefer_complete_thought": True}
        }
        enriched = [
            {
                "id": "clip_1",
                "startTime": 0.0,
                "endTime": 12.0,
                "duration": 12.0,
                "summary": "Big reveal about crypto markets today.",
                "completeThought": True,
                "finalScore": 90.0,
                "qualityMultiplier": 1.1,
            },
            {
                "id": "clip_2",
                "startTime": 40.0,
                "endTime": 52.0,
                "duration": 12.0,
                "summary": "Big reveal about crypto market shifts today.",
                "completeThought": True,
                "finalScore": 88.0,
                "qualityMultiplier": 1.05,
            },
            {
                "id": "clip_3",
                "startTime": 90.0,
                "endTime": 105.0,
                "duration": 15.0,
                "summary": "A different story about audience growth tactics.",
                "completeThought": True,
                "finalScore": 85.0,
                "qualityMultiplier": 1.0,
            },
        ]
        decision = select_best_set(enriched, context_pack, target_n=2, api_key=None)
        self.assertEqual(len(decision.selected_ids), 2)
        self.assertEqual(len(set(decision.selected_ids)), 2)
        self.assertIn("clip_3", decision.selected_ids)


if __name__ == "__main__":
    unittest.main()

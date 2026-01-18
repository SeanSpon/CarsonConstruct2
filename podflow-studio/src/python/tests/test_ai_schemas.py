import unittest

from ai.schemas import validate_clipcard, validate_finaldecision, validate_meaningcard


class TestAiSchemas(unittest.TestCase):
    def test_clipcard_requires_algorithm_score(self):
        with self.assertRaises(ValueError):
            validate_clipcard(
                {
                    "id": "clip_1",
                    "start": 0.0,
                    "end": 10.0,
                    "duration": 10.0,
                    "patterns": ["payoff"],
                    "scores": {},
                    "gates": {},
                    "events": [],
                    "transcript": "Test.",
                }
            )

    def test_meaningcard_rejects_bad_category(self):
        bad = {
            "post_worthy": True,
            "complete_thought": True,
            "category": "invalid",
            "summary": "Summary.",
            "hook_text": "Short hook",
            "title_candidates": ["One", "Two"],
            "quality_score_1to10": 6,
            "quality_multiplier": 1.0,
            "flags": [],
        }
        with self.assertRaises(ValueError):
            validate_meaningcard(bad)

    def test_finaldecision_rejects_duplicate_ids(self):
        bad = {
            "selected_ids": ["clip_1", "clip_1"],
            "ranking": [
                {"id": "clip_1", "final_multiplier": 1.0, "reason": "test"}
            ],
            "global_notes": [],
        }
        with self.assertRaises(ValueError):
            validate_finaldecision(bad)


if __name__ == "__main__":
    unittest.main()

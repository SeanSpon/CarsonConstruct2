import unittest

import numpy as np

from utils.clipworthiness import apply_clipworthiness


class TestSpeechGate(unittest.TestCase):
    def _features(self, speech_ratio: float, flatness: float) -> dict:
        times = np.linspace(0, 3, 7)
        vad_mask = np.array([1 if i < int(speech_ratio * len(times)) else 0 for i in range(len(times))])
        rms = np.ones_like(times) * 0.5
        baseline = np.ones_like(times) * 0.4
        onset = np.ones_like(times) * 0.2
        flatness_arr = np.ones_like(times) * flatness
        return {
            "times": times,
            "rms_smooth": rms,
            "rms_baseline": baseline,
            "onset_strength": onset,
            "onset_baseline": onset,
            "spectral_flatness": flatness_arr,
            "vad_mask": vad_mask.astype(bool),
            "vad_segments": [(0.0, 3.0)],
            "frame_duration": 0.5,
        }

    def test_gate_passes(self):
        features = self._features(speech_ratio=0.8, flatness=0.2)
        clips = [
            {"startTime": 0.0, "endTime": 3.0, "pattern": "payoff", "algorithmScore": 80}
        ]
        scored, stats = apply_clipworthiness(
            clips,
            features,
            {"hard_gates": {"speech_ratio": 0.7, "flatness_median": 0.45, "speech_seconds": 1.0}},
            mode="podflow",
            debug=False,
        )
        self.assertEqual(len(scored), 1)
        self.assertEqual(stats["gatedOut"], 0)

    def test_gate_blocks_low_speech(self):
        features = self._features(speech_ratio=0.3, flatness=0.2)
        clips = [
            {"startTime": 0.0, "endTime": 3.0, "pattern": "payoff", "algorithmScore": 80}
        ]
        scored, stats = apply_clipworthiness(
            clips,
            features,
            {"hard_gates": {"speech_ratio": 0.7, "flatness_median": 0.45, "speech_seconds": 1.0}},
            mode="podflow",
            debug=False,
        )
        self.assertEqual(len(scored), 0)
        self.assertEqual(stats["gatedOut"], 1)


if __name__ == "__main__":
    unittest.main()

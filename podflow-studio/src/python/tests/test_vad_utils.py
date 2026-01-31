import unittest

from vad_utils import snap_clip_to_segments


class TestVadSnapping(unittest.TestCase):
    def test_snap_start_and_end(self):
        segments = [(10.0, 20.0), (30.0, 40.0)]
        start, end, snapped, reason = snap_clip_to_segments(
            11.5,
            21.2,
            segments,
            (0.0, 100.0),
            min_duration=5.0,
            max_duration=90.0,
            snap_window_s=2.0,
            head_padding_s=0.0,
            tail_padding_s=0.0,
        )
        self.assertTrue(snapped)
        self.assertEqual(reason, "snapped")
        self.assertAlmostEqual(start, 10.0)
        self.assertAlmostEqual(end, 20.0)

    def test_snap_end_forward(self):
        segments = [(10.0, 20.0), (30.0, 40.0)]
        start, end, snapped, _ = snap_clip_to_segments(
            29.7,
            39.0,
            segments,
            (0.0, 100.0),
            min_duration=5.0,
            max_duration=90.0,
            snap_window_s=2.0,
            head_padding_s=0.0,
            tail_padding_s=0.0,
        )
        self.assertTrue(snapped)
        self.assertAlmostEqual(start, 30.0)
        self.assertAlmostEqual(end, 40.0)

    def test_fallback_when_too_short(self):
        segments = [(10.0, 20.0)]
        start, end, snapped, reason = snap_clip_to_segments(
            10.2,
            20.1,
            segments,
            (0.0, 100.0),
            min_duration=15.0,
            max_duration=90.0,
            snap_window_s=2.0,
            head_padding_s=0.0,
            tail_padding_s=0.0,
        )
        self.assertFalse(snapped)
        self.assertEqual(reason, "duration_out_of_bounds")
        self.assertAlmostEqual(start, 10.2)
        self.assertAlmostEqual(end, 20.1)

    def test_tail_padding_applied(self):
        segments = [(30.0, 40.0)]
        start, end, snapped, _ = snap_clip_to_segments(
            30.2,
            39.8,
            segments,
            (0.0, 100.0),
            min_duration=5.0,
            max_duration=90.0,
            snap_window_s=2.0,
            head_padding_s=0.0,
            tail_padding_s=0.4,
        )
        self.assertTrue(snapped)
        self.assertAlmostEqual(start, 30.0)
        self.assertAlmostEqual(end, 40.4)


if __name__ == "__main__":
    unittest.main()

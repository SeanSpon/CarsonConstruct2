import unittest

import numpy as np

from utils.baseline import deviation_from_baseline, rolling_median


class TestBaseline(unittest.TestCase):
    def test_rolling_median_smooths_spike(self):
        values = np.array([1.0, 2.0, 3.0, 100.0, 4.0, 5.0, 6.0])
        baseline = rolling_median(values, 3)
        self.assertAlmostEqual(baseline[3], 4.0)

    def test_deviation_zero_when_equal(self):
        values = np.array([1.0, 2.0, 3.0])
        baseline = np.array([1.0, 2.0, 3.0])
        deviation = deviation_from_baseline(values, baseline)
        self.assertTrue(np.allclose(deviation, np.zeros_like(values)))


if __name__ == "__main__":
    unittest.main()

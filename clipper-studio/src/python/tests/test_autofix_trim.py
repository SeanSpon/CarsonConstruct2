"""
Tests for trim auto-fixer.
"""

import unittest
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from autofix.trim import TrimFixer, adjust_clip_boundaries


class TestTrimFixer(unittest.TestCase):
    """Tests for TrimFixer."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.fixer = TrimFixer(
            max_adjustment=0.25,  # 250ms
            min_duration=15.0,
            max_duration=60.0,
        )
    
    def test_no_errors_no_fix(self):
        """Test that clips without errors aren't modified."""
        clip = {'id': 'clip_1', 'start': 10.0, 'end': 40.0}
        errors = []
        
        result = self.fixer.fix(clip, errors)
        
        self.assertTrue(result.success)
        self.assertEqual(result.clip['start'], 10.0)
        self.assertEqual(result.clip['end'], 40.0)
        self.assertEqual(len(result.adjustments), 0)
    
    def test_fix_too_short_clip(self):
        """Test fixing a clip that's slightly too short."""
        clip = {'id': 'clip_1', 'start': 10.0, 'end': 24.8}  # 14.8s, needs 0.2s
        errors = [
            {'code': 'CLIP_TOO_SHORT', 'details': {'actual': 14.8, 'minimum': 15.0}}
        ]
        
        result = self.fixer.fix(clip, errors, media_duration=100.0)
        
        # Should extend to at least 15s (with floating point tolerance)
        duration = result.clip['end'] - result.clip['start']
        self.assertGreaterEqual(duration, 14.99)  # Allow small floating point error
        self.assertTrue(len(result.adjustments) > 0)
    
    def test_cannot_fix_very_short_clip(self):
        """Test that very short clips can't be fixed within adjustment limits."""
        clip = {'id': 'clip_1', 'start': 10.0, 'end': 14.0}  # 4s, needs 11s (way too much)
        errors = [
            {'code': 'CLIP_TOO_SHORT', 'details': {'actual': 4.0, 'minimum': 15.0}}
        ]
        
        result = self.fixer.fix(clip, errors, media_duration=100.0)
        
        # Can't fix this - adjustment would exceed max
        self.assertFalse(result.success)
    
    def test_fix_too_long_clip(self):
        """Test fixing a clip that's slightly too long."""
        clip = {'id': 'clip_1', 'start': 10.0, 'end': 70.2}  # 60.2s, max is 60s
        errors = [
            {'code': 'CLIP_TOO_LONG', 'details': {'actual': 60.2, 'maximum': 60.0}}
        ]
        
        result = self.fixer.fix(clip, errors)
        
        # Should trim to at most 60s
        duration = result.clip['end'] - result.clip['start']
        self.assertLessEqual(duration, 60.0)
        self.assertTrue(len(result.adjustments) > 0)
    
    def test_fix_mid_word_start(self):
        """Test fixing a clip that cuts mid-word at start."""
        clip = {'id': 'clip_1', 'start': 10.15, 'end': 40.0}  # Starts mid-word, within 250ms of word start
        errors = [
            {
                'code': 'CLIP_CUTS_MID_WORD_START',
                'details': {
                    'word_start': 10.0,
                    'word_end': 11.0,
                    'clip_start': 10.15,
                }
            }
        ]
        transcript_words = [
            {'word': 'hello', 'start': 10.0, 'end': 11.0},
        ]
        
        result = self.fixer.fix(clip, errors, transcript_words=transcript_words)
        
        # Should snap to word boundary (within max_adjustment of 250ms)
        self.assertEqual(result.clip['start'], 10.0)
        self.assertTrue(len(result.adjustments) > 0)
    
    def test_fix_mid_word_end(self):
        """Test fixing a clip that cuts mid-word at end."""
        clip = {'id': 'clip_1', 'start': 10.0, 'end': 40.85}  # Ends mid-word, within 250ms of word end
        errors = [
            {
                'code': 'CLIP_CUTS_MID_WORD_END',
                'details': {
                    'word_start': 40.0,
                    'word_end': 41.0,
                    'clip_end': 40.85,
                }
            }
        ]
        transcript_words = [
            {'word': 'final', 'start': 40.0, 'end': 41.0},
        ]
        
        result = self.fixer.fix(clip, errors, transcript_words=transcript_words)
        
        # Should snap to word boundary (within max adjustment of 250ms)
        self.assertEqual(result.clip['end'], 41.0)
        self.assertTrue(len(result.adjustments) > 0)
    
    def test_respects_media_duration(self):
        """Test that fixes respect media duration bounds."""
        clip = {'id': 'clip_1', 'start': 95.0, 'end': 109.8}  # 14.8s, near end of 100s video
        errors = [
            {'code': 'CLIP_TOO_SHORT', 'details': {'actual': 14.8, 'minimum': 15.0}}
        ]
        
        result = self.fixer.fix(clip, errors, media_duration=100.0)
        
        # Should not extend past media duration
        if result.success:
            self.assertLessEqual(result.clip['end'], 100.0)


class TestAdjustClipBoundaries(unittest.TestCase):
    """Tests for adjust_clip_boundaries utility."""
    
    def test_adjust_within_limits(self):
        """Test adjustment within limits."""
        clip = {'id': 'clip_1', 'start': 10.0, 'end': 40.0}
        result = adjust_clip_boundaries(clip, start_delta=-0.1, end_delta=0.1)
        
        self.assertIsNotNone(result)
        self.assertEqual(result['start'], 9.9)
        self.assertEqual(result['end'], 40.1)
    
    def test_reject_exceeding_limits(self):
        """Test rejection of adjustments exceeding limits."""
        clip = {'id': 'clip_1', 'start': 10.0, 'end': 40.0}
        result = adjust_clip_boundaries(clip, start_delta=-0.5, max_adjustment=0.25)
        
        self.assertIsNone(result)
    
    def test_reject_negative_start(self):
        """Test rejection of adjustments causing negative start."""
        clip = {'id': 'clip_1', 'start': 0.1, 'end': 20.0}
        result = adjust_clip_boundaries(clip, start_delta=-0.2)
        
        self.assertIsNone(result)


if __name__ == '__main__':
    unittest.main()

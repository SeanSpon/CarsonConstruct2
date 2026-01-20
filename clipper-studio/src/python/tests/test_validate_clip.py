"""
Tests for clip validation.
"""

import unittest
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from validate.clip import ClipValidator
from validate.result import ErrorSeverity


class TestClipValidator(unittest.TestCase):
    """Tests for ClipValidator."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.validator = ClipValidator(
            min_duration=15.0,
            max_duration=60.0,
            word_boundary_tolerance=0.25,
        )
    
    def test_valid_clip(self):
        """Test that a valid clip passes validation."""
        clip = {
            'id': 'clip_1',
            'start': 10.0,
            'end': 40.0,  # 30s duration
        }
        result = self.validator.validate(clip)
        
        self.assertTrue(result.valid)
        self.assertEqual(len(result.errors), 0)
    
    def test_clip_too_short(self):
        """Test that a too-short clip fails validation."""
        clip = {
            'id': 'clip_1',
            'start': 10.0,
            'end': 20.0,  # 10s duration (below 15s min)
        }
        result = self.validator.validate(clip)
        
        self.assertFalse(result.valid)
        self.assertEqual(len(result.errors), 1)
        self.assertEqual(result.errors[0].code, "CLIP_TOO_SHORT")
    
    def test_clip_too_long(self):
        """Test that a too-long clip fails validation."""
        clip = {
            'id': 'clip_1',
            'start': 0.0,
            'end': 90.0,  # 90s duration (above 60s max)
        }
        result = self.validator.validate(clip)
        
        self.assertFalse(result.valid)
        self.assertEqual(len(result.errors), 1)
        self.assertEqual(result.errors[0].code, "CLIP_TOO_LONG")
    
    def test_clip_cuts_mid_word_start(self):
        """Test detection of clip cutting mid-word at start."""
        clip = {
            'id': 'clip_1',
            'start': 10.5,  # Cuts mid-word
            'end': 40.0,
        }
        transcript_words = [
            {'word': 'hello', 'start': 10.0, 'end': 11.0},
            {'word': 'world', 'start': 11.5, 'end': 12.0},
        ]
        
        result = self.validator.validate(clip, transcript_words=transcript_words)
        
        self.assertFalse(result.valid)
        has_mid_word_error = any(
            e.code == "CLIP_CUTS_MID_WORD_START" for e in result.errors
        )
        self.assertTrue(has_mid_word_error)
    
    def test_clip_cuts_mid_word_end(self):
        """Test detection of clip cutting mid-word at end."""
        clip = {
            'id': 'clip_1',
            'start': 10.0,
            'end': 40.5,  # Cuts mid-word
        }
        transcript_words = [
            {'word': 'final', 'start': 40.0, 'end': 41.0},
        ]
        
        result = self.validator.validate(clip, transcript_words=transcript_words)
        
        self.assertFalse(result.valid)
        has_mid_word_error = any(
            e.code == "CLIP_CUTS_MID_WORD_END" for e in result.errors
        )
        self.assertTrue(has_mid_word_error)
    
    def test_clip_overlap(self):
        """Test detection of overlapping clips."""
        clip = {
            'id': 'clip_1',
            'start': 10.0,
            'end': 40.0,
        }
        other_clips = [
            {'id': 'clip_2', 'start': 30.0, 'end': 60.0},  # Overlaps by 10s
        ]
        
        result = self.validator.validate(clip, other_clips=other_clips)
        
        self.assertFalse(result.valid)
        self.assertEqual(result.errors[0].code, "CLIP_OVERLAP")
    
    def test_no_overlap_with_gap(self):
        """Test that clips with a gap don't overlap."""
        clip = {
            'id': 'clip_1',
            'start': 10.0,
            'end': 40.0,
        }
        other_clips = [
            {'id': 'clip_2', 'start': 50.0, 'end': 80.0},  # No overlap
        ]
        
        result = self.validator.validate(clip, other_clips=other_clips)
        
        self.assertTrue(result.valid)
    
    def test_batch_validation(self):
        """Test batch validation of multiple clips."""
        clips = [
            {'id': 'clip_1', 'start': 10.0, 'end': 40.0},
            {'id': 'clip_2', 'start': 50.0, 'end': 80.0},
            {'id': 'clip_3', 'start': 0.0, 'end': 5.0},  # Too short
        ]
        
        results = self.validator.validate_batch(clips)
        
        self.assertEqual(len(results), 3)
        self.assertTrue(results[0].valid)
        self.assertTrue(results[1].valid)
        self.assertFalse(results[2].valid)


class TestValidationResult(unittest.TestCase):
    """Tests for ValidationResult."""
    
    def test_add_error(self):
        """Test adding errors to a result."""
        from validate.result import ValidationResult
        
        result = ValidationResult(valid=True)
        result.add_error("TEST_ERROR", "Test message")
        
        self.assertFalse(result.valid)
        self.assertEqual(len(result.errors), 1)
        self.assertEqual(result.errors[0].code, "TEST_ERROR")
    
    def test_add_warning(self):
        """Test adding warnings (shouldn't affect validity)."""
        from validate.result import ValidationResult
        
        result = ValidationResult(valid=True)
        result.add_error("TEST_WARNING", "Test warning", severity=ErrorSeverity.WARNING)
        
        self.assertTrue(result.valid)  # Warnings don't affect validity
        self.assertEqual(len(result.warnings), 1)
    
    def test_hard_failure_detection(self):
        """Test detection of hard failures."""
        from validate.result import ValidationResult
        
        result = ValidationResult(valid=True)
        result.add_error("HARD_ERROR", "Hard failure", severity=ErrorSeverity.HARD_FAILURE)
        
        self.assertFalse(result.valid)
        self.assertTrue(result.has_hard_failures)
        self.assertFalse(result.fixable)
    
    def test_fixable_errors(self):
        """Test that non-hard errors are fixable."""
        from validate.result import ValidationResult
        
        result = ValidationResult(valid=True)
        result.add_error("SOFT_ERROR", "Soft error", severity=ErrorSeverity.ERROR)
        
        self.assertFalse(result.valid)
        self.assertFalse(result.has_hard_failures)
        self.assertTrue(result.fixable)


if __name__ == '__main__':
    unittest.main()

"""
Tests for validation and auto-fix runners.
"""

import unittest
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from validate.runner import ValidationRunner, BatchValidationReport
from autofix.runner import AutoFixRunner, BatchAutoFixResult


class TestValidationRunner(unittest.TestCase):
    """Tests for ValidationRunner."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.runner = ValidationRunner()
    
    def test_validate_single_valid_clip(self):
        """Test validating a single valid clip."""
        clip = {'id': 'clip_1', 'start': 10.0, 'end': 40.0}
        
        report = self.runner.validate_clip(clip)
        
        self.assertTrue(report.valid)
        self.assertEqual(report.clip_id, 'clip_1')
    
    def test_validate_single_invalid_clip(self):
        """Test validating a single invalid clip."""
        clip = {'id': 'clip_1', 'start': 10.0, 'end': 15.0}  # Too short (5s)
        
        report = self.runner.validate_clip(clip)
        
        self.assertFalse(report.valid)
        self.assertTrue(len(report.all_errors) > 0)
    
    def test_validate_batch(self):
        """Test batch validation."""
        clips = [
            {'id': 'clip_1', 'start': 10.0, 'end': 40.0},  # Valid
            {'id': 'clip_2', 'start': 50.0, 'end': 80.0},  # Valid
            {'id': 'clip_3', 'start': 0.0, 'end': 5.0},    # Invalid (too short)
        ]
        
        report = self.runner.validate_batch(clips)
        
        self.assertEqual(report.total, 3)
        self.assertEqual(report.valid, 2)
        self.assertEqual(report.invalid, 1)
    
    def test_validate_with_captions(self):
        """Test validation including captions."""
        clip = {'id': 'clip_1', 'start': 10.0, 'end': 40.0}
        captions = [
            {'text': 'Hello world', 'start': 10.0, 'end': 12.0},
            {'text': 'How are you', 'start': 12.5, 'end': 14.0},
        ]
        
        report = self.runner.validate_clip(clip, captions=captions)
        
        self.assertTrue(report.valid)
        self.assertIsNotNone(report.caption_result)
    
    def test_batch_validation_report_summary(self):
        """Test batch validation report summary."""
        clips = [
            {'id': 'clip_1', 'start': 10.0, 'end': 40.0},
            {'id': 'clip_2', 'start': 0.0, 'end': 5.0},
        ]
        
        report = self.runner.validate_batch(clips)
        summary = report.summary
        
        self.assertIn('1', summary)  # Should mention valid count
        self.assertIn('2', summary)  # Should mention total


class TestAutoFixRunner(unittest.TestCase):
    """Tests for AutoFixRunner."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.runner = AutoFixRunner()
    
    def test_fix_valid_clip_unchanged(self):
        """Test that valid clips are passed through unchanged."""
        clip = {'id': 'clip_1', 'start': 10.0, 'end': 40.0}
        errors = []
        
        result = self.runner.fix_clip(clip, errors)
        
        self.assertTrue(result.success)
        self.assertFalse(result.dropped)
        self.assertEqual(len(result.fixes_applied), 0)
    
    def test_fix_clip_with_fixable_errors(self):
        """Test fixing a clip with fixable errors."""
        clip = {'id': 'clip_1', 'start': 10.0, 'end': 24.8}  # Slightly too short
        errors = [
            {
                'code': 'CLIP_TOO_SHORT',
                'severity': 'error',
                'details': {'actual': 14.8, 'minimum': 15.0}
            }
        ]
        
        result = self.runner.fix_clip(clip, errors, media_duration=100.0)
        
        # Should attempt to fix
        self.assertTrue(len(result.fixes_applied) > 0 or len(result.remaining_errors) > 0)
    
    def test_drop_clip_with_hard_failure(self):
        """Test that clips with hard failures are dropped."""
        clip = {'id': 'clip_1', 'start': 10.0, 'end': 40.0}
        errors = [
            {
                'code': 'VIDEO_FILE_NOT_FOUND',
                'severity': 'hard',
                'details': {}
            }
        ]
        
        result = self.runner.fix_clip(clip, errors)
        
        self.assertFalse(result.success)
        self.assertTrue(result.dropped)
    
    def test_fix_batch(self):
        """Test batch auto-fix."""
        clips = [
            {'id': 'clip_1', 'start': 10.0, 'end': 40.0},
            {'id': 'clip_2', 'start': 50.0, 'end': 64.8},  # Slightly too short
        ]
        validation_results = [
            {'valid': True, 'errors': []},
            {'valid': False, 'errors': [
                {'code': 'CLIP_TOO_SHORT', 'severity': 'error', 'details': {}}
            ]},
        ]
        
        result = self.runner.fix_batch(
            clips, 
            validation_results, 
            media_duration=100.0
        )
        
        self.assertEqual(result.total, 2)
        self.assertEqual(result.passed_through, 1)  # First clip unchanged
    
    def test_batch_result_summary(self):
        """Test batch result summary."""
        clips = [
            {'id': 'clip_1', 'start': 10.0, 'end': 40.0},
        ]
        validation_results = [
            {'valid': True, 'errors': []},
        ]
        
        result = self.runner.fix_batch(clips, validation_results)
        summary = result.summary
        
        self.assertIn('Auto-fix:', summary)
        self.assertIn('1', summary)


class TestIntegration(unittest.TestCase):
    """Integration tests for validation + auto-fix pipeline."""
    
    def test_validate_then_fix(self):
        """Test full validation → fix pipeline."""
        clips = [
            {'id': 'clip_1', 'start': 10.0, 'end': 40.0},
            {'id': 'clip_2', 'start': 50.0, 'end': 64.9},  # Needs fixing
            {'id': 'clip_3', 'start': 0.0, 'end': 5.0},    # Can't be fixed
        ]
        
        # Step 1: Validate
        validator = ValidationRunner()
        val_report = validator.validate_batch(clips)
        
        self.assertEqual(val_report.valid, 1)
        self.assertEqual(val_report.invalid, 2)
        
        # Step 2: Auto-fix
        fixer = AutoFixRunner()
        
        # Convert validation results to dict format
        val_dicts = []
        for report in val_report.reports:
            val_dicts.append({
                'valid': report.valid,
                'errors': [
                    {
                        'code': e.code,
                        'message': e.message,
                        'severity': e.severity.value,
                        'details': e.details,
                    }
                    for e in report.all_errors
                ],
            })
        
        fix_result = fixer.fix_batch(
            clips,
            val_dicts,
            media_duration=100.0,
        )
        
        # Should have some fixed and some dropped
        self.assertTrue(fix_result.dropped >= 1)  # clip_3 should be dropped


if __name__ == '__main__':
    unittest.main()

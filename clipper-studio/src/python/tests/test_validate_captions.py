"""
Tests for caption validation.
"""

import unittest
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from validate.captions import CaptionValidator


class TestCaptionValidator(unittest.TestCase):
    """Tests for CaptionValidator."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.validator = CaptionValidator(
            max_words_per_line=6,
            max_caption_duration=5.0,
            min_caption_duration=0.3,
        )
    
    def test_valid_captions(self):
        """Test that valid captions pass validation."""
        captions = [
            {'text': 'Hello world', 'start': 0.0, 'end': 2.0},
            {'text': 'How are you', 'start': 2.5, 'end': 4.0},
        ]
        result = self.validator.validate(captions)
        
        self.assertTrue(result.valid)
        self.assertEqual(len(result.errors), 0)
    
    def test_caption_overlap(self):
        """Test detection of overlapping captions."""
        captions = [
            {'text': 'First caption', 'start': 0.0, 'end': 3.0},
            {'text': 'Second caption', 'start': 2.5, 'end': 5.0},  # Overlaps!
        ]
        result = self.validator.validate(captions)
        
        self.assertFalse(result.valid)
        has_overlap_error = any(e.code == "CAPTION_OVERLAP" for e in result.errors)
        self.assertTrue(has_overlap_error)
    
    def test_caption_too_many_words(self):
        """Test detection of captions with too many words."""
        captions = [
            {'text': 'This is a caption with way too many words in it', 'start': 0.0, 'end': 3.0},
        ]
        result = self.validator.validate(captions)
        
        self.assertFalse(result.valid)
        has_word_error = any(e.code == "CAPTION_TOO_MANY_WORDS" for e in result.errors)
        self.assertTrue(has_word_error)
    
    def test_caption_missing_highlight(self):
        """Test detection of missing highlight word."""
        captions = [
            {
                'text': 'Hello world',
                'start': 0.0,
                'end': 2.0,
                'highlight': 'missing',  # Word not in text
            },
        ]
        result = self.validator.validate(captions)
        
        self.assertFalse(result.valid)
        has_highlight_error = any(e.code == "CAPTION_HIGHLIGHT_MISSING" for e in result.errors)
        self.assertTrue(has_highlight_error)
    
    def test_caption_highlight_found(self):
        """Test that existing highlight words pass."""
        captions = [
            {
                'text': 'Hello world',
                'start': 0.0,
                'end': 2.0,
                'highlight': 'Hello',  # Word exists
            },
        ]
        result = self.validator.validate(captions)
        
        # Should not have highlight missing error
        has_highlight_error = any(e.code == "CAPTION_HIGHLIGHT_MISSING" for e in result.errors)
        self.assertFalse(has_highlight_error)
    
    def test_caption_before_clip(self):
        """Test detection of captions starting before clip."""
        captions = [
            {'text': 'Too early', 'start': 5.0, 'end': 7.0},
        ]
        result = self.validator.validate(captions, clip_start=10.0, clip_end=30.0)
        
        self.assertFalse(result.valid)
        has_before_error = any(e.code == "CAPTION_BEFORE_CLIP" for e in result.errors)
        self.assertTrue(has_before_error)
    
    def test_caption_after_clip(self):
        """Test detection of captions ending after clip."""
        captions = [
            {'text': 'Too late', 'start': 25.0, 'end': 35.0},
        ]
        result = self.validator.validate(captions, clip_start=10.0, clip_end=30.0)
        
        self.assertFalse(result.valid)
        has_after_error = any(e.code == "CAPTION_AFTER_CLIP" for e in result.errors)
        self.assertTrue(has_after_error)
    
    def test_empty_captions(self):
        """Test that empty captions list is valid."""
        result = self.validator.validate([])
        self.assertTrue(result.valid)
    
    def test_caption_duration_too_short(self):
        """Test detection of too-short caption duration."""
        captions = [
            {'text': 'Quick', 'start': 0.0, 'end': 0.1},  # Only 0.1s
        ]
        result = self.validator.validate(captions)
        
        # Too-short is a warning, not an error
        has_short_warning = any(w.code == "CAPTION_TOO_SHORT" for w in result.warnings)
        self.assertTrue(has_short_warning)
    
    def test_caption_duration_too_long(self):
        """Test detection of too-long caption duration."""
        captions = [
            {'text': 'Long caption', 'start': 0.0, 'end': 10.0},  # 10s is too long
        ]
        result = self.validator.validate(captions)
        
        # Too-long is a warning
        has_long_warning = any(w.code == "CAPTION_TOO_LONG" for w in result.warnings)
        self.assertTrue(has_long_warning)


if __name__ == '__main__':
    unittest.main()

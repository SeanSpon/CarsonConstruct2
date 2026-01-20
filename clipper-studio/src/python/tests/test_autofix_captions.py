"""
Tests for caption auto-fixer.
"""

import unittest
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from autofix.captions import CaptionFixer, remove_first_caption, remove_last_caption


class TestCaptionFixer(unittest.TestCase):
    """Tests for CaptionFixer."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.fixer = CaptionFixer(
            max_words_per_line=6,
            min_gap=0.05,
        )
    
    def test_no_errors_no_fix(self):
        """Test that captions without errors aren't modified."""
        captions = [
            {'text': 'Hello world', 'start': 0.0, 'end': 2.0},
            {'text': 'How are you', 'start': 2.5, 'end': 4.0},
        ]
        errors = []
        
        result = self.fixer.fix(captions, errors)
        
        self.assertTrue(result.success)
        self.assertEqual(len(result.captions), 2)
        self.assertEqual(len(result.fixes_applied), 0)
    
    def test_fix_caption_overlap(self):
        """Test fixing overlapping captions."""
        captions = [
            {'text': 'First caption', 'start': 0.0, 'end': 3.0},
            {'text': 'Second caption', 'start': 2.5, 'end': 5.0},
        ]
        errors = [
            {
                'code': 'CAPTION_OVERLAP',
                'details': {
                    'caption_index': 0,
                    'next_caption_index': 1,
                    'current_end': 3.0,
                    'next_start': 2.5,
                }
            }
        ]
        
        result = self.fixer.fix(captions, errors)
        
        self.assertTrue(result.success)
        # First caption's end should be trimmed before second's start
        self.assertLess(result.captions[0]['end'], result.captions[1]['start'])
        self.assertTrue(len(result.fixes_applied) > 0)
    
    def test_fix_too_many_words(self):
        """Test fixing captions with too many words."""
        captions = [
            {
                'text': 'This is a very long caption with too many words',
                'start': 0.0,
                'end': 3.0,
            },
        ]
        errors = [
            {
                'code': 'CAPTION_TOO_MANY_WORDS',
                'details': {
                    'caption_index': 0,
                    'word_count': 10,
                    'max_words': 6,
                }
            }
        ]
        
        result = self.fixer.fix(captions, errors)
        
        self.assertTrue(result.success)
        # Caption should be truncated to max words
        word_count = len(result.captions[0]['text'].split())
        self.assertLessEqual(word_count, 6)
    
    def test_fix_missing_highlight(self):
        """Test removing missing highlight word."""
        captions = [
            {
                'text': 'Hello world',
                'start': 0.0,
                'end': 2.0,
                'highlight': 'missing',
            },
        ]
        errors = [
            {
                'code': 'CAPTION_HIGHLIGHT_MISSING',
                'details': {
                    'caption_index': 0,
                    'highlight_word': 'missing',
                }
            }
        ]
        
        result = self.fixer.fix(captions, errors)
        
        self.assertTrue(result.success)
        # Highlight should be removed
        self.assertNotIn('highlight', result.captions[0])
    
    def test_fix_caption_before_clip(self):
        """Test fixing caption that starts before clip."""
        captions = [
            {'text': 'Too early', 'start': 5.0, 'end': 12.0},
        ]
        errors = [
            {
                'code': 'CAPTION_BEFORE_CLIP',
                'details': {
                    'caption_index': 0,
                    'caption_start': 5.0,
                    'clip_start': 10.0,
                }
            }
        ]
        
        result = self.fixer.fix(captions, errors, clip_start=10.0, clip_end=30.0)
        
        self.assertTrue(result.success)
        # Caption start should be clamped to clip start
        self.assertEqual(result.captions[0]['start'], 10.0)
    
    def test_remove_caption_entirely_before_clip(self):
        """Test removing caption that ends before clip starts."""
        captions = [
            {'text': 'Way too early', 'start': 0.0, 'end': 5.0},
        ]
        errors = [
            {
                'code': 'CAPTION_BEFORE_CLIP',
                'details': {
                    'caption_index': 0,
                    'caption_start': 0.0,
                    'clip_start': 10.0,
                }
            }
        ]
        
        result = self.fixer.fix(captions, errors, clip_start=10.0, clip_end=30.0)
        
        self.assertTrue(result.success)
        # Caption should be removed
        self.assertEqual(len(result.captions), 0)
        self.assertEqual(result.removed_count, 1)
    
    def test_fix_caption_after_clip(self):
        """Test fixing caption that ends after clip."""
        captions = [
            {'text': 'Too late', 'start': 25.0, 'end': 35.0},
        ]
        errors = [
            {
                'code': 'CAPTION_AFTER_CLIP',
                'details': {
                    'caption_index': 0,
                    'caption_end': 35.0,
                    'clip_end': 30.0,
                }
            }
        ]
        
        result = self.fixer.fix(captions, errors, clip_start=10.0, clip_end=30.0)
        
        self.assertTrue(result.success)
        # Caption end should be clamped to clip end
        self.assertEqual(result.captions[0]['end'], 30.0)
    
    def test_rebuild_captions(self):
        """Test rebuilding captions from transcript."""
        transcript_words = [
            {'word': 'Hello', 'start': 10.0, 'end': 10.5},
            {'word': 'world', 'start': 10.6, 'end': 11.0},
            {'word': 'how', 'start': 11.2, 'end': 11.4},
            {'word': 'are', 'start': 11.5, 'end': 11.7},
            {'word': 'you', 'start': 11.8, 'end': 12.0},
            {'word': 'today', 'start': 12.2, 'end': 12.6},
            {'word': 'friend', 'start': 12.8, 'end': 13.2},
        ]
        
        captions = self.fixer.rebuild_captions(
            transcript_words,
            clip_start=10.0,
            clip_end=14.0,
        )
        
        self.assertTrue(len(captions) > 0)
        # Each caption should have at most max_words_per_line words
        for caption in captions:
            word_count = len(caption['text'].split())
            self.assertLessEqual(word_count, 6)


class TestCaptionHelpers(unittest.TestCase):
    """Tests for caption helper functions."""
    
    def test_remove_first_caption(self):
        """Test removing first caption."""
        captions = [
            {'text': 'First'},
            {'text': 'Second'},
            {'text': 'Third'},
        ]
        result = remove_first_caption(captions)
        
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]['text'], 'Second')
    
    def test_remove_last_caption(self):
        """Test removing last caption."""
        captions = [
            {'text': 'First'},
            {'text': 'Second'},
            {'text': 'Third'},
        ]
        result = remove_last_caption(captions)
        
        self.assertEqual(len(result), 2)
        self.assertEqual(result[-1]['text'], 'Second')
    
    def test_remove_from_empty(self):
        """Test removing from empty list."""
        self.assertEqual(remove_first_caption([]), [])
        self.assertEqual(remove_last_caption([]), [])


if __name__ == '__main__':
    unittest.main()

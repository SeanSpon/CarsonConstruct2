"""
Extract visual keywords from transcript for b-roll matching.

This module analyzes transcript words to identify moments where
b-roll footage would enhance the video content.
"""
import re
from typing import List, Dict, Any


class KeywordExtractor:
    """
    Extracts visual keywords from transcript for b-roll insertion.
    
    Identifies words/phrases that benefit from visual illustration:
    - Action verbs (show, demonstrate, compare)
    - Visual nouns (data, graphs, examples)
    - Abstract concepts that benefit from visuals
    """
    
    def __init__(self):
        # Visual trigger words that indicate a good b-roll moment
        self.visual_triggers = {
            'show': ['show', 'showing', 'shows', 'shown', 'display', 'displays'],
            'data': ['data', 'statistics', 'numbers', 'metrics', 'analytics', 'stats'],
            'graph': ['graph', 'chart', 'visualization', 'diagram', 'infographic'],
            'example': ['example', 'instance', 'case', 'like', 'such as', 'for instance'],
            'imagine': ['imagine', 'picture', 'visualize', 'think about', 'envision'],
            'look': ['look', 'see', 'watch', 'observe', 'notice', 'view'],
            'compare': ['compare', 'versus', 'vs', 'difference', 'contrast', 'between'],
            'result': ['result', 'outcome', 'conclusion', 'finding', 'discovery'],
            'process': ['process', 'step', 'workflow', 'procedure', 'method', 'approach'],
            'growth': ['growth', 'increase', 'rise', 'surge', 'spike', 'boom'],
            'decline': ['decline', 'decrease', 'drop', 'fall', 'reduction', 'shrink']
        }
        
        # Noun categories that typically need visual support
        self.noun_categories = {
            'tech': ['computer', 'phone', 'software', 'app', 'website', 'code', 
                     'algorithm', 'ai', 'machine learning', 'technology', 'digital'],
            'business': ['money', 'profit', 'revenue', 'market', 'company', 'startup',
                        'investment', 'stock', 'economy', 'business', 'enterprise'],
            'science': ['research', 'study', 'experiment', 'test', 'lab', 'scientist',
                       'discovery', 'innovation', 'theory', 'hypothesis'],
            'nature': ['ocean', 'mountain', 'forest', 'animal', 'plant', 'earth',
                      'environment', 'climate', 'weather', 'landscape'],
            'people': ['person', 'people', 'team', 'group', 'crowd', 'community',
                      'audience', 'user', 'customer', 'employee'],
            'action': ['running', 'jumping', 'working', 'building', 'creating',
                      'making', 'developing', 'designing', 'coding', 'typing']
        }
        
        # Compile patterns for efficiency
        self._compile_patterns()
    
    def _compile_patterns(self):
        """Compile regex patterns for faster matching."""
        # Create word boundary patterns
        self.trigger_patterns = {}
        for category, words in self.visual_triggers.items():
            pattern = r'\b(' + '|'.join(re.escape(w) for w in words) + r')\b'
            self.trigger_patterns[category] = re.compile(pattern, re.IGNORECASE)
        
        self.noun_patterns = {}
        for category, words in self.noun_categories.items():
            pattern = r'\b(' + '|'.join(re.escape(w) for w in words) + r')\b'
            self.noun_patterns[category] = re.compile(pattern, re.IGNORECASE)
    
    def extract_keywords(
        self,
        words: List[Dict[str, Any]],
        window_size: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Extract keywords that should trigger b-roll insertion.
        
        Args:
            words: List of word dicts with 'text', 'start', 'end' keys
            window_size: Context window size for extracting surrounding words
        
        Returns:
            List of keyword entries with timestamp, category, and context
        """
        keywords = []
        
        for i, word_data in enumerate(words):
            word = word_data.get('text', '').lower()
            
            # Check visual triggers
            for trigger_category, pattern in self.trigger_patterns.items():
                if pattern.search(word):
                    # Get context (surrounding words)
                    start_idx = max(0, i - window_size)
                    end_idx = min(len(words), i + window_size + 1)
                    context_words = words[start_idx:end_idx]
                    context = ' '.join([w.get('text', '') for w in context_words])
                    
                    keywords.append({
                        'keyword': word,
                        'category': trigger_category,
                        'timestamp': word_data.get('start', 0),
                        'end_time': word_data.get('end', 0),
                        'context': context,
                        'confidence': 0.8,
                        'type': 'trigger'
                    })
            
            # Check noun categories
            for category, pattern in self.noun_patterns.items():
                if pattern.search(word):
                    start_idx = max(0, i - window_size)
                    end_idx = min(len(words), i + window_size + 1)
                    context_words = words[start_idx:end_idx]
                    context = ' '.join([w.get('text', '') for w in context_words])
                    
                    keywords.append({
                        'keyword': word,
                        'category': category,
                        'timestamp': word_data.get('start', 0),
                        'end_time': word_data.get('end', 0),
                        'context': context,
                        'confidence': 0.6,
                        'type': 'noun'
                    })
        
        # Deduplicate nearby keywords (within 3 seconds)
        keywords = self._deduplicate_keywords(keywords, threshold=3.0)
        
        # Sort by confidence then timestamp
        keywords.sort(key=lambda x: (-x['confidence'], x['timestamp']))
        
        return keywords
    
    def _deduplicate_keywords(
        self,
        keywords: List[Dict[str, Any]],
        threshold: float = 3.0
    ) -> List[Dict[str, Any]]:
        """
        Remove keywords that are too close together.
        
        Keeps the keyword with higher confidence when there's a conflict.
        
        Args:
            keywords: List of keyword entries
            threshold: Minimum time gap between keywords (seconds)
        
        Returns:
            Deduplicated list
        """
        if not keywords:
            return []
        
        # Sort by timestamp
        sorted_keywords = sorted(keywords, key=lambda x: x['timestamp'])
        
        deduplicated = [sorted_keywords[0]]
        
        for kw in sorted_keywords[1:]:
            last_kw = deduplicated[-1]
            time_gap = kw['timestamp'] - last_kw['timestamp']
            
            if time_gap > threshold:
                # Far enough apart, keep it
                deduplicated.append(kw)
            elif kw['confidence'] > last_kw['confidence']:
                # Too close but higher confidence, replace
                deduplicated[-1] = kw
            # Otherwise, skip this keyword
        
        return deduplicated
    
    def get_broll_moments(
        self,
        words: List[Dict[str, Any]],
        max_moments: int = 10,
        min_confidence: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        Get the best moments for b-roll insertion.
        
        Args:
            words: List of word dicts with timestamps
            max_moments: Maximum number of b-roll moments to return
            min_confidence: Minimum confidence threshold
        
        Returns:
            List of b-roll moment entries
        """
        keywords = self.extract_keywords(words)
        
        # Filter by confidence
        moments = [k for k in keywords if k['confidence'] >= min_confidence]
        
        # Return top moments
        return moments[:max_moments]
    
    def analyze_transcript_text(self, text: str) -> Dict[str, int]:
        """
        Analyze transcript text to get category counts.
        
        Useful for understanding what type of b-roll would be most relevant.
        
        Args:
            text: Full transcript text
        
        Returns:
            Dictionary mapping categories to keyword counts
        """
        category_counts = {}
        
        for category, pattern in self.trigger_patterns.items():
            matches = pattern.findall(text)
            if matches:
                category_counts[f'trigger_{category}'] = len(matches)
        
        for category, pattern in self.noun_patterns.items():
            matches = pattern.findall(text)
            if matches:
                category_counts[f'noun_{category}'] = len(matches)
        
        return category_counts

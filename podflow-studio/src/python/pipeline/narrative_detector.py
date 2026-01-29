"""
Story-based segment detection for ClipBot MVP.

Finds complete narratives with setup/conflict/payoff structure.
Uses heuristic-based detection that works offline without AI.
"""
import re
from typing import List, Dict, Optional, Any


class NarrativeDetector:
    """
    Narrative structure detector for finding story-complete segments.
    
    Identifies segments with setup/conflict/payoff patterns that make
    for engaging, standalone short-form clips.
    """
    
    def __init__(self):
        """Initialize the narrative detector with pattern lists."""
        
        # Story setup indicators - establish context
        self.setup_patterns = [
            r'\b(so|basically|here\'s|let me tell you|the thing is)\b',
            r'\b(imagine|picture this|think about|what if)\b',
            r'\b(you know what|here\'s the deal|listen)\b',
            r'\b(started|began|was|used to)\b',
            r'\b(when i was|back in|one time|there was)\b',
            r'\b(the question is|what happens when|have you ever)\b',
            r'^(so|okay|alright|well)\s',
        ]
        
        # Story conflict/tension indicators
        self.conflict_patterns = [
            r'\b(but|however|except|though|although)\b',
            r'\b(problem|issue|challenge|struggle|difficult)\b',
            r'\b(turns out|realized|discovered|found out)\b',
            r'\b(suddenly|unexpectedly|surprise|surprising)\b',
            r'\b(wrong|failed|mistake|didn\'t work|didn\'t go)\b',
            r'\b(crazy|insane|wild|unbelievable)\b',
            r'\b(the catch|the twist|plot twist)\b',
        ]
        
        # Story payoff/resolution indicators
        self.payoff_patterns = [
            r'\b(so|therefore|thus|hence|consequently)\b',
            r'\b(realized|learned|understood|figured out)\b',
            r'\b(solution|answer|result|outcome)\b',
            r'\b(that\'s why|which is why|the reason|because of that)\b',
            r'\b(finally|eventually|in the end|ultimately)\b',
            r'\b(the point is|the lesson|the takeaway|moral of)\b',
            r'\b(and that|so now|which means|and that\'s)\b',
        ]
        
        # Engagement/viral potential words
        self.engagement_words = [
            'crazy', 'insane', 'unbelievable', 'shocking', 'amazing',
            'literally', 'actually', 'honestly', 'serious', 'real talk',
            'mind-blowing', 'game-changer', 'wild', 'ridiculous',
            'brilliant', 'genius', 'secret', 'truth', 'nobody',
            'everyone', 'always', 'never', 'best', 'worst',
        ]
        
        # Topic transition indicators (help find segment boundaries)
        self.transition_patterns = [
            r'\b(speaking of|anyway|moving on|another thing)\b',
            r'\b(by the way|on that note|that reminds me)\b',
            r'\b(let me ask you|what do you think about)\b',
            r'\b(so the next|the other thing|also)\b',
        ]
    
    def detect_story_segments(
        self,
        transcript: Dict[str, Any],
        min_duration: float = 15.0,
        max_duration: float = 90.0,
        max_segments: int = 10,
        min_words: int = 30,
    ) -> List[Dict[str, Any]]:
        """
        Find story-complete segments in transcript.
        
        Args:
            transcript: Output from TranscriptionService with 'words' list
            min_duration: Minimum clip length (seconds)
            max_duration: Maximum clip length (seconds)
            max_segments: Maximum number of segments to return
            min_words: Minimum words per segment
        
        Returns:
            List of story segments sorted by score, each containing:
            - start_time, end_time, duration
            - text, word_count
            - story_score (0-100)
            - has_setup, has_conflict, has_payoff
            - engagement_score
        """
        words = transcript.get('words', [])
        
        if not words:
            print("[NarrativeDetector] No words in transcript")
            return []
        
        print(f"[NarrativeDetector] Analyzing {len(words)} words for story patterns...")
        
        segments = []
        i = 0
        
        # Scan through transcript looking for stories
        while i < len(words) - min_words:
            segment = self._find_story_at_position(
                words, i, min_duration, max_duration, min_words
            )
            
            if segment and segment['story_score'] >= 40:
                segments.append(segment)
                # Jump past this segment to avoid overlaps
                i = segment['end_index'] + 10
            else:
                # Move forward in smaller steps
                i += 5
        
        # Sort by story score (best first)
        segments.sort(key=lambda x: x['story_score'], reverse=True)
        
        # Remove overlapping segments, keeping higher-scored ones
        filtered_segments = self._remove_overlaps(segments)
        
        print(f"[NarrativeDetector] Found {len(filtered_segments)} story segments")
        
        return filtered_segments[:max_segments]
    
    def _find_story_at_position(
        self,
        words: List[Dict],
        start_idx: int,
        min_dur: float,
        max_dur: float,
        min_words: int,
    ) -> Optional[Dict[str, Any]]:
        """
        Try to find a complete story starting at the given word position.
        
        Returns the best scoring segment found, or None.
        """
        if start_idx >= len(words):
            return None
        
        start_time = words[start_idx]['start']
        best_segment = None
        best_score = 0
        
        # Try different end points to find the best segment
        # Start from minimum and go to maximum duration
        for end_idx in range(start_idx + min_words, min(len(words), start_idx + 500)):
            end_time = words[end_idx]['end']
            duration = end_time - start_time
            
            # Check duration bounds
            if duration < min_dur:
                continue
            if duration > max_dur:
                break
            
            # Get segment text
            segment_words = words[start_idx:end_idx + 1]
            segment_text = ' '.join([w['text'] for w in segment_words])
            
            # Skip if text is too short
            if len(segment_text.split()) < min_words:
                continue
            
            # Check for good ending (sentence boundary)
            if not self._has_good_ending(segment_text, segment_words):
                continue
            
            # Score this segment
            score_data = self._score_segment(segment_text, segment_words)
            
            if score_data['total_score'] > best_score:
                best_score = score_data['total_score']
                best_segment = {
                    'start_time': start_time,
                    'end_time': end_time,
                    'duration': duration,
                    'start_index': start_idx,
                    'end_index': end_idx,
                    'text': segment_text,
                    'word_count': len(segment_words),
                    'story_score': score_data['total_score'],
                    'has_setup': score_data['has_setup'],
                    'has_conflict': score_data['has_conflict'],
                    'has_payoff': score_data['has_payoff'],
                    'engagement_score': score_data['engagement_score'],
                    'structure_score': score_data['structure_score'],
                }
        
        return best_segment
    
    def _has_good_ending(self, text: str, words: List[Dict]) -> bool:
        """Check if the segment ends at a natural sentence boundary."""
        text = text.strip()
        
        # Check for sentence-ending punctuation
        if text.endswith(('.', '!', '?', '"', "'")):
            return True
        
        # Check for natural ending phrases
        ending_phrases = [
            r'(and that\'s|that\'s why|so that\'s|which is)',
            r'(you know|right\?|makes sense)',
            r'(the end|basically|essentially)',
        ]
        
        last_words = ' '.join([w['text'] for w in words[-5:]] if len(words) >= 5 else [w['text'] for w in words]).lower()
        
        for pattern in ending_phrases:
            if re.search(pattern, last_words):
                return True
        
        return False
    
    def _score_segment(self, text: str, words: List[Dict]) -> Dict[str, Any]:
        """
        Score a segment for story completeness and engagement.
        
        Returns dict with:
        - total_score (0-100)
        - has_setup, has_conflict, has_payoff (bool)
        - engagement_score, structure_score (0-100)
        """
        text_lower = text.lower()
        
        # Check for story elements
        has_setup = self._has_pattern(text_lower, self.setup_patterns)
        has_conflict = self._has_pattern(text_lower, self.conflict_patterns)
        has_payoff = self._has_pattern(text_lower, self.payoff_patterns)
        
        # Story structure score (need at least 2 of 3 elements)
        story_elements = sum([has_setup, has_conflict, has_payoff])
        
        # Base structure score
        if story_elements >= 3:
            structure_score = 60  # Perfect structure
        elif story_elements == 2:
            structure_score = 45  # Good structure
        elif story_elements == 1:
            structure_score = 20  # Partial structure
        else:
            structure_score = 0   # No clear structure
        
        # Engagement score (viral potential words)
        engagement_count = sum(
            1 for word in self.engagement_words
            if word in text_lower
        )
        engagement_score = min(engagement_count * 5, 25)  # Max 25 points
        
        # Length bonus (sweet spot is 30-150 words)
        word_count = len(words)
        length_bonus = 0
        if 40 <= word_count <= 120:
            length_bonus = 10  # Sweet spot
        elif 30 <= word_count <= 150:
            length_bonus = 5   # Good range
        
        # Sentence structure bonus
        sentences = re.split(r'[.!?]+', text)
        sentence_count = len([s for s in sentences if s.strip()])
        
        sentence_bonus = 0
        if 3 <= sentence_count <= 8:
            sentence_bonus = 5  # Good sentence count
        
        # Calculate total score
        total_score = structure_score + engagement_score + length_bonus + sentence_bonus
        
        # Cap at 100
        total_score = min(100, total_score)
        
        return {
            'total_score': total_score,
            'has_setup': has_setup,
            'has_conflict': has_conflict,
            'has_payoff': has_payoff,
            'engagement_score': engagement_score,
            'structure_score': structure_score,
            'story_elements': story_elements,
        }
    
    def _has_pattern(self, text: str, patterns: List[str]) -> bool:
        """Check if text contains any of the patterns."""
        for pattern in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False
    
    def _remove_overlaps(self, segments: List[Dict]) -> List[Dict]:
        """
        Remove overlapping segments, keeping higher-scored ones.
        
        Uses a greedy approach: take the highest scoring segment,
        then take the next highest that doesn't overlap, etc.
        """
        if not segments:
            return []
        
        # Segments should already be sorted by score (descending)
        filtered = []
        
        for segment in segments:
            # Check if this segment overlaps with any already selected
            overlaps = False
            for selected in filtered:
                # Calculate overlap
                overlap_start = max(segment['start_time'], selected['start_time'])
                overlap_end = min(segment['end_time'], selected['end_time'])
                
                if overlap_end > overlap_start:
                    # There is overlap
                    overlap_duration = overlap_end - overlap_start
                    segment_duration = segment['end_time'] - segment['start_time']
                    
                    # If overlap is more than 30% of segment, skip it
                    if overlap_duration / segment_duration > 0.3:
                        overlaps = True
                        break
            
            if not overlaps:
                filtered.append(segment)
        
        return filtered
    
    def find_segment_at_time(
        self,
        transcript: Dict[str, Any],
        time: float,
        target_duration: float = 45.0,
    ) -> Optional[Dict[str, Any]]:
        """
        Find a story-complete segment around a specific time.
        
        Useful for extracting a clip around a known interesting moment.
        
        Args:
            transcript: Transcript with words
            time: Target time to find segment around
            target_duration: Approximate desired duration
        
        Returns:
            Best segment found near the time, or None
        """
        words = transcript.get('words', [])
        
        if not words:
            return None
        
        # Find word index closest to target time
        closest_idx = 0
        min_diff = float('inf')
        
        for i, word in enumerate(words):
            diff = abs(word['start'] - time)
            if diff < min_diff:
                min_diff = diff
                closest_idx = i
        
        # Search around this point
        search_start = max(0, closest_idx - 50)
        
        best_segment = None
        
        for start_idx in range(search_start, min(closest_idx + 20, len(words) - 30)):
            segment = self._find_story_at_position(
                words,
                start_idx,
                min_dur=target_duration * 0.5,
                max_dur=target_duration * 1.5,
                min_words=30,
            )
            
            if segment:
                # Check if segment contains target time
                if segment['start_time'] <= time <= segment['end_time']:
                    if best_segment is None or segment['story_score'] > best_segment['story_score']:
                        best_segment = segment
        
        return best_segment

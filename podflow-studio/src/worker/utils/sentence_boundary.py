#!/usr/bin/env python3
"""
Sentence Boundary Detection for Natural Cut Points

Provides functions to identify natural sentence and clause boundaries
in transcripts for creating smooth, flowing edits.
"""

import re
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass


@dataclass
class SentenceBoundary:
    """A natural cut point in the transcript."""
    time: float
    text_before: str  # Last few words before boundary
    text_after: str   # First few words after boundary
    boundary_type: str  # 'sentence', 'clause', 'paragraph', 'topic'
    confidence: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'time': self.time,
            'text_before': self.text_before,
            'text_after': self.text_after,
            'boundary_type': self.boundary_type,
            'confidence': self.confidence,
        }


# Sentence end patterns
SENTENCE_END_PATTERN = re.compile(r'[.!?]+["\')\]]?\s*$')
# Clause boundary patterns
CLAUSE_PATTERN = re.compile(r'[,;:]\s*$')
# Topic change indicators
TOPIC_CHANGE_WORDS = {
    'so', 'now', 'anyway', 'actually', 'basically', 'honestly',
    'look', 'listen', 'okay', 'alright', 'well', 'but', 'however',
    'meanwhile', 'speaking of', 'by the way', 'moving on',
}


def detect_sentence_boundaries(
    transcript: Dict[str, Any],
    min_sentence_duration: float = 2.0,
) -> List[SentenceBoundary]:
    """
    Detect sentence boundaries from Whisper transcript.
    
    Args:
        transcript: Whisper transcript with segments and/or words
        min_sentence_duration: Minimum duration between sentence boundaries
        
    Returns:
        List of SentenceBoundary objects
    """
    boundaries = []
    
    # Try word-level detection first
    words = transcript.get('words', [])
    if words:
        boundaries = _detect_from_words(words, min_sentence_duration)
    
    # Fallback to segment-level detection
    if not boundaries:
        segments = transcript.get('segments', [])
        if segments:
            boundaries = _detect_from_segments(segments, min_sentence_duration)
    
    return boundaries


def _detect_from_words(
    words: List[Dict[str, Any]],
    min_duration: float,
) -> List[SentenceBoundary]:
    """Detect boundaries from word-level timestamps."""
    boundaries = []
    last_boundary_time = 0.0
    
    for i, word in enumerate(words):
        text = word.get('word', word.get('text', '')).strip()
        end_time = word.get('end', 0)
        
        if not text:
            continue
        
        # Check if too close to last boundary
        if end_time - last_boundary_time < min_duration:
            continue
        
        # Check for sentence end
        if SENTENCE_END_PATTERN.search(text):
            # Get context
            text_before = _get_context_before(words, i, 5)
            text_after = _get_context_after(words, i, 5)
            
            boundaries.append(SentenceBoundary(
                time=end_time + 0.2,  # Small padding after punctuation
                text_before=text_before,
                text_after=text_after,
                boundary_type='sentence',
                confidence=0.9,
            ))
            last_boundary_time = end_time
            continue
        
        # Check for clause boundary (lower priority)
        if CLAUSE_PATTERN.search(text):
            # Only add clause boundaries if there's a significant pause
            next_word = words[i + 1] if i + 1 < len(words) else None
            if next_word:
                pause = next_word.get('start', 0) - end_time
                if pause > 0.3:  # Significant pause after clause
                    text_before = _get_context_before(words, i, 3)
                    text_after = _get_context_after(words, i, 3)
                    
                    boundaries.append(SentenceBoundary(
                        time=end_time + 0.15,
                        text_before=text_before,
                        text_after=text_after,
                        boundary_type='clause',
                        confidence=0.6,
                    ))
                    last_boundary_time = end_time
        
        # Check for topic change indicators
        lower_text = text.lower().strip('.,!?')
        if lower_text in TOPIC_CHANGE_WORDS:
            # Look for preceding pause
            prev_word = words[i - 1] if i > 0 else None
            if prev_word:
                pause = word.get('start', 0) - prev_word.get('end', 0)
                if pause > 0.5:  # Significant pause before topic change
                    text_before = _get_context_before(words, i - 1, 3)
                    text_after = _get_context_after(words, i - 1, 5)
                    
                    boundaries.append(SentenceBoundary(
                        time=word.get('start', 0) - 0.1,
                        text_before=text_before,
                        text_after=text_after,
                        boundary_type='topic',
                        confidence=0.5,
                    ))
                    last_boundary_time = word.get('start', 0)
    
    return boundaries


def _detect_from_segments(
    segments: List[Dict[str, Any]],
    min_duration: float,
) -> List[SentenceBoundary]:
    """Detect boundaries from segment-level timestamps."""
    boundaries = []
    last_boundary_time = 0.0
    
    for i, segment in enumerate(segments):
        text = segment.get('text', '').strip()
        end_time = segment.get('end', 0)
        
        if not text:
            continue
        
        # Check if too close to last boundary
        if end_time - last_boundary_time < min_duration:
            continue
        
        # Each segment is typically a sentence or clause
        if SENTENCE_END_PATTERN.search(text):
            text_before = text[-50:] if len(text) > 50 else text
            next_segment = segments[i + 1] if i + 1 < len(segments) else None
            text_after = next_segment.get('text', '')[:50] if next_segment else ''
            
            boundaries.append(SentenceBoundary(
                time=end_time + 0.2,
                text_before=text_before,
                text_after=text_after,
                boundary_type='sentence',
                confidence=0.8,
            ))
            last_boundary_time = end_time
    
    return boundaries


def _get_context_before(words: List[Dict], index: int, count: int) -> str:
    """Get text of words before index."""
    start = max(0, index - count + 1)
    return ' '.join(
        w.get('word', w.get('text', '')).strip()
        for w in words[start:index + 1]
    )


def _get_context_after(words: List[Dict], index: int, count: int) -> str:
    """Get text of words after index."""
    end = min(len(words), index + count + 1)
    return ' '.join(
        w.get('word', w.get('text', '')).strip()
        for w in words[index + 1:end]
    )


def find_nearest_boundary(
    boundaries: List[SentenceBoundary],
    target_time: float,
    max_distance: float = 3.0,
    preferred_types: Optional[List[str]] = None,
) -> Optional[SentenceBoundary]:
    """
    Find the nearest sentence boundary to a target time.
    
    Args:
        boundaries: List of detected boundaries
        target_time: Target time in seconds
        max_distance: Maximum distance to search
        preferred_types: Preferred boundary types (e.g., ['sentence'])
        
    Returns:
        Nearest SentenceBoundary or None
    """
    if not boundaries:
        return None
    
    preferred_types = preferred_types or ['sentence', 'clause', 'topic']
    
    candidates = []
    for boundary in boundaries:
        distance = abs(boundary.time - target_time)
        if distance <= max_distance:
            # Score based on distance and type preference
            type_score = preferred_types.index(boundary.boundary_type) if boundary.boundary_type in preferred_types else 10
            score = distance + type_score * 0.5
            candidates.append((boundary, score))
    
    if not candidates:
        return None
    
    # Sort by score (lower is better)
    candidates.sort(key=lambda x: x[1])
    return candidates[0][0]


def get_natural_clip_boundaries(
    transcript: Dict[str, Any],
    clip_start: float,
    clip_end: float,
    search_window: float = 2.0,
) -> Tuple[float, float, Dict[str, Any]]:
    """
    Adjust clip boundaries to align with natural sentence boundaries.
    
    Args:
        transcript: Whisper transcript
        clip_start: Original clip start time
        clip_end: Original clip end time
        search_window: How far to search for boundaries
        
    Returns:
        Tuple of (adjusted_start, adjusted_end, adjustment_info)
    """
    boundaries = detect_sentence_boundaries(transcript)
    
    if not boundaries:
        return clip_start, clip_end, {'adjusted': False, 'reason': 'no_boundaries'}
    
    # Find boundary near start
    start_boundary = find_nearest_boundary(
        boundaries,
        clip_start,
        max_distance=search_window,
        preferred_types=['sentence', 'topic'],
    )
    
    # Find boundary near end
    end_boundary = find_nearest_boundary(
        boundaries,
        clip_end,
        max_distance=search_window,
        preferred_types=['sentence'],
    )
    
    new_start = clip_start
    new_end = clip_end
    adjustments = []
    
    # Adjust start to begin at/after a boundary
    if start_boundary and start_boundary.time > clip_start - search_window:
        if start_boundary.time < clip_start:
            # Extend clip to include complete sentence
            new_start = max(clip_start - search_window, start_boundary.time - 0.1)
            adjustments.append(f'start_extended_to_{start_boundary.boundary_type}')
        elif start_boundary.time < clip_start + search_window / 2:
            # Start at boundary
            new_start = start_boundary.time
            adjustments.append(f'start_snapped_to_{start_boundary.boundary_type}')
    
    # Adjust end to end at a boundary
    if end_boundary and end_boundary.time > clip_end - search_window / 2:
        if end_boundary.time > clip_end:
            # Extend to complete sentence
            new_end = min(clip_end + search_window, end_boundary.time + 0.2)
            adjustments.append(f'end_extended_to_{end_boundary.boundary_type}')
        else:
            # End at boundary
            new_end = end_boundary.time
            adjustments.append(f'end_snapped_to_{end_boundary.boundary_type}')
    
    return new_start, new_end, {
        'adjusted': bool(adjustments),
        'adjustments': adjustments,
        'start_boundary': start_boundary.to_dict() if start_boundary else None,
        'end_boundary': end_boundary.to_dict() if end_boundary else None,
    }


def validate_cut_flow(
    transcript: Dict[str, Any],
    cuts: List[Tuple[float, float]],
) -> List[Dict[str, Any]]:
    """
    Validate that a list of cuts create a flowing edit.
    
    Args:
        transcript: Whisper transcript
        cuts: List of (start, end) tuples representing cuts
        
    Returns:
        List of validation issues
    """
    issues = []
    boundaries = detect_sentence_boundaries(transcript)
    words = transcript.get('words', [])
    
    for i, (start, end) in enumerate(cuts):
        cut_issues = []
        
        # Check if cut starts mid-sentence (not at boundary)
        start_boundary = find_nearest_boundary(boundaries, start, max_distance=1.0)
        if not start_boundary or abs(start_boundary.time - start) > 0.5:
            cut_issues.append({
                'type': 'mid_sentence_start',
                'time': start,
                'severity': 'warning',
            })
        
        # Check if cut ends mid-sentence
        end_boundary = find_nearest_boundary(boundaries, end, max_distance=1.0)
        if not end_boundary or abs(end_boundary.time - end) > 0.5:
            cut_issues.append({
                'type': 'mid_sentence_end',
                'time': end,
                'severity': 'warning',
            })
        
        # Check for mid-word cuts using words
        if words:
            from vad_utils import is_mid_word_cut, extract_word_boundaries
            word_boundaries = extract_word_boundaries(transcript)
            
            is_mid_start, word_start = is_mid_word_cut(word_boundaries, start)
            if is_mid_start:
                cut_issues.append({
                    'type': 'mid_word_start',
                    'time': start,
                    'word': word_start.word if word_start else None,
                    'severity': 'error',
                })
            
            is_mid_end, word_end = is_mid_word_cut(word_boundaries, end)
            if is_mid_end:
                cut_issues.append({
                    'type': 'mid_word_end',
                    'time': end,
                    'word': word_end.word if word_end else None,
                    'severity': 'error',
                })
        
        if cut_issues:
            issues.append({
                'cut_index': i,
                'start': start,
                'end': end,
                'issues': cut_issues,
            })
    
    return issues


# CLI for testing
if __name__ == "__main__":
    import json
    import sys
    
    # Example transcript
    example_transcript = {
        'words': [
            {'word': 'So', 'start': 0.0, 'end': 0.2},
            {'word': 'I', 'start': 0.25, 'end': 0.3},
            {'word': 'was', 'start': 0.35, 'end': 0.5},
            {'word': 'thinking', 'start': 0.55, 'end': 0.9},
            {'word': 'about', 'start': 0.95, 'end': 1.2},
            {'word': 'this.', 'start': 1.25, 'end': 1.5},
            {'word': 'And', 'start': 2.0, 'end': 2.2},
            {'word': 'you', 'start': 2.25, 'end': 2.4},
            {'word': 'know,', 'start': 2.45, 'end': 2.7},
            {'word': 'it', 'start': 2.75, 'end': 2.85},
            {'word': 'makes', 'start': 2.9, 'end': 3.1},
            {'word': 'sense.', 'start': 3.15, 'end': 3.5},
        ]
    }
    
    print("Detecting sentence boundaries...")
    boundaries = detect_sentence_boundaries(example_transcript)
    
    print(f"\nFound {len(boundaries)} boundaries:")
    for b in boundaries:
        print(f"  [{b.time:.2f}s] {b.boundary_type}: ...{b.text_before}")
    
    print("\nTesting clip boundary adjustment...")
    new_start, new_end, info = get_natural_clip_boundaries(
        example_transcript,
        clip_start=0.4,  # Mid-word
        clip_end=3.2,    # Close to sentence end
    )
    print(f"Original: 0.4 - 3.2")
    print(f"Adjusted: {new_start:.2f} - {new_end:.2f}")
    print(f"Info: {json.dumps(info, indent=2)}")

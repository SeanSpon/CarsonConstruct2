"""
Clip Scoring

Deterministic scoring formula for clip candidates.

Score components:
1. Speech density (0-35 pts): Higher density = more content
2. Hook strength (0-25 pts): Energy in first 3 seconds
3. Length score (0-20 pts): Prefer 15-30s clips
4. Boundary bonus (0-10 pts): Clips that start/end on sentences
5. Payoff bonus (0-10 pts): Silence → speech patterns

Total: 0-100 points
"""

from dataclasses import dataclass
from typing import List, Optional
import numpy as np

from .candidates import Candidate
from ..transcription import Transcript


@dataclass
class ScoredClip:
    """A scored and ranked clip."""
    id: str
    start: float
    end: float
    score: float
    reason: str
    
    # Score breakdown
    density_score: float = 0.0
    hook_score: float = 0.0
    length_score: float = 0.0
    boundary_score: float = 0.0
    payoff_score: float = 0.0
    
    # Original metrics
    speech_density: float = 0.0
    
    @property
    def duration(self) -> float:
        return self.end - self.start
    
    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'start': self.start,
            'end': self.end,
            'duration': self.duration,
            'score': self.score,
            'reason': self.reason,
            'breakdown': {
                'density': self.density_score,
                'hook': self.hook_score,
                'length': self.length_score,
                'boundary': self.boundary_score,
                'payoff': self.payoff_score,
            },
            'speech_density': self.speech_density,
        }


def score_density(speech_density: float) -> float:
    """
    Score based on speech density.
    
    2.0 words/sec = 10 pts
    3.0 words/sec = 25 pts
    4.0+ words/sec = 35 pts
    
    Returns: 0-35 points
    """
    if speech_density < 1.5:
        return 0.0
    elif speech_density < 2.0:
        return (speech_density - 1.5) / 0.5 * 10
    elif speech_density < 3.0:
        return 10 + (speech_density - 2.0) / 1.0 * 15
    elif speech_density < 4.0:
        return 25 + (speech_density - 3.0) / 1.0 * 10
    else:
        return 35.0


def score_hook(
    transcript: Transcript,
    start: float,
    hook_duration: float = 3.0
) -> float:
    """
    Score the "hook" - first few seconds of the clip.
    
    Good hooks have:
    - High speech density in first 3 seconds
    - Complete sentences starting
    
    Returns: 0-25 points
    """
    hook_end = start + hook_duration
    hook_words = transcript.get_words_in_range(start, hook_end)
    
    # Speech density in hook
    word_count = len(hook_words)
    density = word_count / hook_duration if hook_duration > 0 else 0
    
    # Base score from density
    if density >= 3.0:
        score = 20.0
    elif density >= 2.0:
        score = 10.0 + (density - 2.0) * 10
    elif density >= 1.0:
        score = (density - 1.0) * 10
    else:
        score = 0.0
    
    # Bonus if hook starts at sentence boundary
    for seg in transcript.segments:
        if abs(seg.start - start) < 0.3:
            score += 5.0
            break
    
    return min(25.0, score)


def score_length(duration: float, ideal_min: float = 15.0, ideal_max: float = 30.0) -> float:
    """
    Score based on clip length.
    
    Ideal range: 15-30 seconds
    Acceptable: 10-45 seconds
    
    Returns: 0-20 points
    """
    if ideal_min <= duration <= ideal_max:
        return 20.0
    elif 10.0 <= duration < ideal_min:
        # Slightly too short
        return 10.0 + (duration - 10.0) / (ideal_min - 10.0) * 10
    elif ideal_max < duration <= 45.0:
        # Slightly too long
        return 20.0 - (duration - ideal_max) / (45.0 - ideal_max) * 10
    elif duration < 10.0:
        return duration  # Very short = low score
    else:
        return max(0, 10.0 - (duration - 45.0) / 15.0 * 10)


def score_boundaries(
    transcript: Transcript,
    start: float,
    end: float,
    tolerance: float = 0.5
) -> float:
    """
    Score based on whether clip starts/ends on sentence boundaries.
    
    Returns: 0-10 points
    """
    score = 0.0
    
    # Check if start aligns with segment start
    for seg in transcript.segments:
        if abs(seg.start - start) < tolerance:
            score += 5.0
            break
    
    # Check if end aligns with segment end
    for seg in transcript.segments:
        if abs(seg.end - end) < tolerance:
            score += 5.0
            break
    
    return score


def score_payoff(candidate: Candidate) -> float:
    """
    Score payoff moments (silence → speech).
    
    Returns: 0-10 points
    """
    if candidate.reason != "silence_break":
        return 0.0
    
    # Longer silence = bigger payoff potential
    silence_duration = candidate.energy_contrast
    
    if silence_duration >= 3.0:
        return 10.0
    elif silence_duration >= 2.0:
        return 7.0
    elif silence_duration >= 1.5:
        return 5.0
    else:
        return 3.0


def score_candidate(
    candidate: Candidate,
    transcript: Transcript
) -> ScoredClip:
    """
    Score a single candidate.
    
    Args:
        candidate: The candidate to score
        transcript: Full transcript for context
        
    Returns:
        ScoredClip with full breakdown
    """
    # Calculate component scores
    density_pts = score_density(candidate.speech_density)
    hook_pts = score_hook(transcript, candidate.start)
    length_pts = score_length(candidate.duration)
    boundary_pts = score_boundaries(transcript, candidate.start, candidate.end)
    payoff_pts = score_payoff(candidate)
    
    # Total score
    total = density_pts + hook_pts + length_pts + boundary_pts + payoff_pts
    total = min(100.0, max(0.0, total))
    
    return ScoredClip(
        id="",  # Will be assigned after ranking
        start=candidate.start,
        end=candidate.end,
        score=round(total, 1),
        reason=candidate.reason,
        density_score=round(density_pts, 1),
        hook_score=round(hook_pts, 1),
        length_score=round(length_pts, 1),
        boundary_score=round(boundary_pts, 1),
        payoff_score=round(payoff_pts, 1),
        speech_density=candidate.speech_density
    )


def score_and_rank(
    candidates: List[Candidate],
    transcript: Transcript,
    top_n: int = 10,
    min_gap: float = 30.0
) -> List[ScoredClip]:
    """
    Score all candidates and return top N non-overlapping clips.
    
    Args:
        candidates: List of detected candidates
        transcript: Full transcript
        top_n: Number of clips to return
        min_gap: Minimum seconds between clip starts
        
    Returns:
        List of top N scored clips, ranked by score
    """
    # Score all candidates
    scored = [score_candidate(c, transcript) for c in candidates]
    
    # Sort by score (descending)
    scored.sort(key=lambda c: c.score, reverse=True)
    
    # Select top N with minimum gap
    selected = []
    
    for clip in scored:
        if len(selected) >= top_n:
            break
        
        # Check if too close to existing selected clips
        too_close = False
        for existing in selected:
            if abs(clip.start - existing.start) < min_gap:
                too_close = True
                break
        
        if not too_close:
            selected.append(clip)
    
    # Assign IDs
    for i, clip in enumerate(selected):
        clip.id = f"clip_{i + 1:03d}"
    
    return selected

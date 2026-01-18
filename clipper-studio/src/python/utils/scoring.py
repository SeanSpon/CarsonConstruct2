"""
Scoring and clip selection utilities for Clipper Studio
"""

from typing import List, Dict


def calculate_final_scores(clips: List[Dict]) -> List[Dict]:
    """
    Apply hook multiplier to get final scores.
    
    Args:
        clips: List of detected clips with base scores and hook data
    
    Returns:
        List of clips with final_score added
    """
    scored_clips = []
    
    for clip in clips:
        base_score = clip.get('score', 50)
        hook_multiplier = clip.get('hookMultiplier', 1.0)
        
        # Apply hook multiplier
        final_score = min(100, base_score * hook_multiplier)
        
        scored_clip = {
            **clip,
            'score': round(final_score, 1)
        }
        scored_clips.append(scored_clip)
    
    return scored_clips


def select_final_clips(clips: List[Dict], max_clips: int = 20, min_gap: float = 30.0) -> List[Dict]:
    """
    Select top clips with no overlap.
    
    Args:
        clips: List of scored clips
        max_clips: Maximum number of clips to return
        min_gap: Minimum seconds between clip starts
    
    Returns:
        List of selected clips, sorted by timestamp
    """
    if not clips:
        return []
    
    # Sort by score descending
    sorted_clips = sorted(clips, key=lambda x: x.get('score', 0), reverse=True)
    
    selected = []
    
    for clip in sorted_clips:
        if len(selected) >= max_clips:
            break
        
        # Check overlap with already selected clips
        overlaps = False
        for existing in selected:
            # Clips overlap if they're within min_gap of each other
            if abs(clip['start'] - existing['start']) < min_gap:
                overlaps = True
                break
            # Also check actual time overlap
            if (clip['start'] < existing['end'] and clip['end'] > existing['start']):
                overlaps = True
                break
        
        if not overlaps:
            # Assign final ID
            clip_with_id = {
                **clip,
                'id': f"clip_{len(selected) + 1}"
            }
            selected.append(clip_with_id)
    
    # Sort by timestamp for display
    return sorted(selected, key=lambda x: x['start'])

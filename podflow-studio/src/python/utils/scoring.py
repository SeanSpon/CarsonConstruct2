"""
Clip scoring and selection utilities
"""

import numpy as np
from typing import List, Dict, Optional
from .audio import calculate_hook_strength

def calculate_final_scores(
    clips: List[Dict],
    y: Optional[np.ndarray] = None,
    sr: Optional[int] = None,
    features: Optional[Dict] = None,
) -> List[Dict]:
    """
    Calculate final scores for all clips, including hook strength.
    
    Args:
        clips: List of detected clips
        y: Audio time series
        sr: Sample rate
    
    Returns:
        Clips with updated final scores
    """
    scored_clips = []
    
    for clip in clips:
        if "finalScore" in clip:
            scored_clips.append(clip)
            continue

        if "hookStrength" not in clip or clip["hookStrength"] == 0:
            hook_data = calculate_hook_strength(
                y, sr, clip["startTime"], clip["endTime"], features=features
            )
            clip["hookStrength"] = hook_data["strength_score"]
            clip["hookMultiplier"] = hook_data["multiplier"]

        algorithm_score = clip.get("algorithmScore", 50)
        hook_multiplier = clip.get("hookMultiplier", 1.0)
        final_score = algorithm_score * hook_multiplier
        clip["finalScore"] = round(min(100, final_score), 1)
        
        scored_clips.append(clip)
    
    return scored_clips


def merge_overlapping_clips(clips: List[Dict], overlap_threshold: float = 10.0) -> List[Dict]:
    """
    Merge clips that overlap significantly.
    
    Args:
        clips: List of clips
        overlap_threshold: Seconds of overlap to trigger merge
    
    Returns:
        Merged clips list
    """
    if not clips:
        return []
    
    # Sort by start time
    sorted_clips = sorted(clips, key=lambda c: c['startTime'])
    
    merged = [sorted_clips[0]]
    
    for clip in sorted_clips[1:]:
        last = merged[-1]
        
        # Check for overlap
        overlap = last['endTime'] - clip['startTime']
        
        if overlap > overlap_threshold:
            # Merge: extend the end time and keep the higher score
            clip_score = clip.get('finalScore', clip.get('algorithmScore', 0))
            last_score = last.get('finalScore', last.get('algorithmScore', 0))
            if clip_score > last_score:
                # Replace with higher scoring clip, but extend times
                merged[-1] = {
                    **clip,
                    'startTime': min(last['startTime'], clip['startTime']),
                    'endTime': max(last['endTime'], clip['endTime']),
                    'duration': max(last['endTime'], clip['endTime']) - min(last['startTime'], clip['startTime'])
                }
            else:
                # Keep current, extend end time
                merged[-1]['endTime'] = max(last['endTime'], clip['endTime'])
                merged[-1]['duration'] = merged[-1]['endTime'] - merged[-1]['startTime']
        else:
            merged.append(clip)
    
    return merged


def select_final_clips(
    clips: List[Dict], 
    max_clips: int = 20, 
    min_gap: float = 30.0
) -> List[Dict]:
    """
    Select best clips while maintaining minimum gap between them.
    
    Args:
        clips: List of scored clips
        max_clips: Maximum number of clips to return
        min_gap: Minimum gap in seconds between clip starts
    
    Returns:
        Selected clips
    """
    if not clips:
        return []
    
    # Sort by final score (or algorithm score if final not set)
    sorted_clips = sorted(
        clips, 
        key=lambda c: c.get('finalScore', c.get('algorithmScore', 0)), 
        reverse=True
    )
    
    selected = []
    
    for clip in sorted_clips:
        if len(selected) >= max_clips:
            break
        
        # Check gap from all selected clips
        has_conflict = False
        for existing in selected:
            gap = abs(clip['startTime'] - existing['startTime'])
            if gap < min_gap:
                has_conflict = True
                break
        
        if not has_conflict:
            selected.append(clip)
    
    # Sort final selection by start time
    selected = sorted(selected, key=lambda c: c['startTime'])
    
    # Re-assign IDs
    for i, clip in enumerate(selected):
        clip['id'] = f"{clip['pattern']}_{i + 1}"
    
    return selected

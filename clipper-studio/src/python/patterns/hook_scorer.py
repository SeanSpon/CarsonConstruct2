"""
Hook Strength Scorer

Rates the first 3 seconds of a clip.
If the first 3 seconds are boring, people swipe.
A great moment buried after a slow start = wasted clip.

Returns:
- multiplier: 0.7 (weak) to 1.5 (strong)
- strength: 'weak', 'medium', or 'strong'
- strength_score: 0-100 for UI display
"""

import numpy as np
import librosa
from typing import Dict


def calculate_hook_strength(y: np.ndarray, sr: int, clip_start: float, clip_end: float) -> Dict:
    """
    Rate the first 3 seconds of a clip.
    
    Args:
        y: Full audio time series
        sr: Sample rate
        clip_start: Clip start time in seconds
        clip_end: Clip end time in seconds
    
    Returns:
        Dict with multiplier, strength label, and strength_score
    """
    
    # Extract first 3 seconds of clip
    start_sample = int(clip_start * sr)
    hook_duration = min(3.0, clip_end - clip_start)
    hook_end_sample = int((clip_start + hook_duration) * sr)
    
    # Bounds checking
    start_sample = max(0, min(start_sample, len(y) - 1))
    hook_end_sample = max(start_sample + 1, min(hook_end_sample, len(y)))
    
    hook_audio = y[start_sample:hook_end_sample]
    
    if len(hook_audio) == 0:
        return {
            'multiplier': 1.0,
            'energy_ratio': 1.0,
            'strength': 'medium',
            'strength_score': 50
        }
    
    # Calculate energy of hook
    hook_rms = librosa.feature.rms(y=hook_audio)[0]
    avg_hook_energy = np.mean(hook_rms) if len(hook_rms) > 0 else 0
    
    # Compare to overall audio energy
    full_rms = librosa.feature.rms(y=y)[0]
    overall_avg = np.mean(full_rms) if len(full_rms) > 0 else 1
    
    # Avoid division by zero
    if overall_avg == 0:
        overall_avg = 1e-10
    
    # Calculate ratio
    energy_ratio = avg_hook_energy / overall_avg
    
    # Map to multiplier
    # Ratio 0.5 or below = 0.7x (weak hook)
    # Ratio 1.0 = 1.0x (average hook)
    # Ratio 1.5+ = 1.5x (strong hook)
    
    if energy_ratio <= 0.5:
        multiplier = 0.7
    elif energy_ratio >= 1.5:
        multiplier = 1.5
    else:
        # Linear interpolation between 0.5-1.5 ratio -> 0.7-1.5 multiplier
        multiplier = 0.7 + (energy_ratio - 0.5) * (0.8 / 1.0)
    
    # Determine strength label
    if multiplier >= 1.3:
        strength = 'strong'
    elif multiplier >= 1.0:
        strength = 'medium'
    else:
        strength = 'weak'
    
    # Convert to 0-100 score for UI
    # 0.7 multiplier = 0 score
    # 1.0 multiplier = 50 score
    # 1.5 multiplier = 100 score
    strength_score = ((multiplier - 0.7) / 0.8) * 100
    strength_score = max(0, min(100, strength_score))
    
    return {
        'multiplier': round(multiplier, 2),
        'energy_ratio': round(energy_ratio, 2),
        'strength': strength,
        'strength_score': round(strength_score, 1)
    }

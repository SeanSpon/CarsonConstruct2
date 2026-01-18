"""
Dead Space Detection

Finds silence regions > threshold for auto-edit feature.
"""

import numpy as np
import librosa
from typing import List, Dict

def detect_dead_spaces(
    y: np.ndarray, 
    sr: int, 
    duration: float,
    min_silence: float = 3.0,
    max_silence: float = 30.0
) -> List[Dict]:
    """
    Find dead space (silence/very low energy) regions.
    
    Args:
        y: Audio time series
        sr: Sample rate
        duration: Total duration in seconds
        min_silence: Minimum silence duration to detect (default 3s)
        max_silence: Maximum silence duration (split if longer)
    
    Returns:
        List of dead space regions with remove flag
    """
    
    # Calculate RMS energy in small windows
    hop_length = int(sr * 0.05)  # 50ms windows
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    times = librosa.times_like(rms, sr=sr, hop_length=hop_length)
    
    if len(rms) == 0:
        return []
    
    # Define silence threshold (bottom 15% of energy)
    silence_threshold = np.percentile(rms, 15)
    
    # Find silence regions
    dead_spaces = []
    in_silence = False
    silence_start = 0
    
    for i, (time, energy) in enumerate(zip(times, rms)):
        if energy < silence_threshold and not in_silence:
            in_silence = True
            silence_start = time
        elif energy >= silence_threshold and in_silence:
            in_silence = False
            silence_end = time
            silence_duration = silence_end - silence_start
            
            # Only include if longer than minimum
            if silence_duration >= min_silence:
                # Split if too long
                if silence_duration > max_silence:
                    num_splits = int(np.ceil(silence_duration / max_silence))
                    split_duration = silence_duration / num_splits
                    
                    for j in range(num_splits):
                        split_start = silence_start + j * split_duration
                        split_end = split_start + split_duration
                        
                        dead_spaces.append({
                            'id': f"dead_{len(dead_spaces) + 1}",
                            'startTime': round(split_start, 2),
                            'endTime': round(split_end, 2),
                            'duration': round(split_duration, 2),
                            'remove': True  # Default to remove
                        })
                else:
                    dead_spaces.append({
                        'id': f"dead_{len(dead_spaces) + 1}",
                        'startTime': round(silence_start, 2),
                        'endTime': round(silence_end, 2),
                        'duration': round(silence_duration, 2),
                        'remove': True  # Default to remove
                    })
    
    # Handle silence at end
    if in_silence:
        silence_end = duration
        silence_duration = silence_end - silence_start
        
        if silence_duration >= min_silence:
            dead_spaces.append({
                'id': f"dead_{len(dead_spaces) + 1}",
                'startTime': round(silence_start, 2),
                'endTime': round(silence_end, 2),
                'duration': round(silence_duration, 2),
                'remove': True
            })
    
    return dead_spaces

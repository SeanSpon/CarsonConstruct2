"""
Laughter Detection

Pattern: Burst energy clusters with specific spectral characteristics

Real examples:
- Genuine laughter after a joke
- Audience reaction
- Contagious laughter moments

Uses spectral centroid + energy bursts to identify laughter.
"""

import numpy as np
import librosa
from typing import List, Dict

def detect_laughter_moments(
    y: np.ndarray, 
    sr: int, 
    duration: float,
    start_time: float = 0,
    end_time: float = None,
    min_clip_duration: float = 15,
    max_clip_duration: float = 90
) -> List[Dict]:
    """
    Find laughter moments using energy bursts and spectral analysis.
    """
    
    if end_time is None:
        end_time = duration
    
    # Step 1: Calculate features
    hop_length = int(sr * 0.05)  # 50ms windows
    
    # RMS energy
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    times = librosa.times_like(rms, sr=sr, hop_length=hop_length)
    
    # Spectral centroid (laughter tends to have higher centroid)
    spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)[0]
    
    # Zero crossing rate (laughter has rapid changes)
    zcr = librosa.feature.zero_crossing_rate(y, hop_length=hop_length)[0]
    
    if len(rms) == 0:
        return []
    
    # Normalize features
    rms_norm = (rms - np.min(rms)) / (np.max(rms) - np.min(rms) + 0.001)
    centroid_norm = (spectral_centroid - np.min(spectral_centroid)) / (np.max(spectral_centroid) - np.min(spectral_centroid) + 0.001)
    zcr_norm = (zcr - np.min(zcr)) / (np.max(zcr) - np.min(zcr) + 0.001)
    
    # Step 2: Calculate laughter likelihood score
    # Laughter characteristics: bursts of energy with high spectral centroid and ZCR
    min_len = min(len(rms_norm), len(centroid_norm), len(zcr_norm), len(times))
    
    # Calculate energy derivative (bursts)
    energy_diff = np.abs(np.diff(rms_norm[:min_len]))
    energy_diff = np.pad(energy_diff, (0, 1), mode='edge')
    
    # Laughter score combining features
    laughter_score = (
        0.3 * rms_norm[:min_len] +           # High energy
        0.3 * centroid_norm[:min_len] +      # High spectral centroid
        0.2 * zcr_norm[:min_len] +           # High zero crossings
        0.2 * energy_diff                     # Burst pattern
    )
    
    # Smooth the score
    window_size = 10  # 500ms smoothing
    if len(laughter_score) >= window_size:
        laughter_score = np.convolve(laughter_score, np.ones(window_size)/window_size, mode='same')
    
    # Step 3: Find high-laughter regions
    threshold = np.percentile(laughter_score, 85)  # Top 15%
    
    laughter_regions = []
    in_region = False
    region_start = 0
    region_start_idx = 0
    
    for i in range(min_len):
        time = times[i]
        score = laughter_score[i]
        
        # Skip if outside analysis range
        if time < start_time or time > end_time:
            if in_region:
                region_end = time
                region_duration = region_end - region_start
                if 2 <= region_duration <= 15:  # Laughter typically 2-15 seconds
                    laughter_regions.append({
                        'start': region_start,
                        'end': region_end,
                        'duration': region_duration,
                        'start_idx': region_start_idx,
                        'end_idx': i,
                        'peak_score': np.max(laughter_score[region_start_idx:i])
                    })
                in_region = False
            continue
        
        if score > threshold and not in_region:
            in_region = True
            region_start = time
            region_start_idx = i
        elif score <= threshold and in_region:
            in_region = False
            region_end = time
            region_duration = region_end - region_start
            
            if 2 <= region_duration <= 15:  # Laughter typically 2-15 seconds
                laughter_regions.append({
                    'start': region_start,
                    'end': region_end,
                    'duration': region_duration,
                    'start_idx': region_start_idx,
                    'end_idx': i,
                    'peak_score': np.max(laughter_score[region_start_idx:i])
                })
    
    # Handle region at end
    if in_region:
        region_end = min(times[-1], end_time)
        region_duration = region_end - region_start
        if 2 <= region_duration <= 15:
            laughter_regions.append({
                'start': region_start,
                'end': region_end,
                'duration': region_duration,
                'start_idx': region_start_idx,
                'end_idx': min_len - 1,
                'peak_score': np.max(laughter_score[region_start_idx:])
            })
    
    # Step 4: Convert regions to clips (with context before the laughter)
    laughter_clips = []
    
    for region in laughter_regions:
        # Include 10-15 seconds before the laughter (setup/joke)
        context_before = min(15, region['start'] - start_time)
        clip_start = region['start'] - context_before
        
        # Include the full laughter + a bit after
        clip_end = min(end_time, region['end'] + 3)
        clip_duration = clip_end - clip_start
        
        # Enforce duration limits
        if clip_duration < min_clip_duration:
            extra = min_clip_duration - clip_duration
            clip_start = max(start_time, clip_start - extra / 2)
            clip_end = min(end_time, clip_end + extra / 2)
            clip_duration = clip_end - clip_start
        
        if clip_duration > max_clip_duration:
            # Keep the laughter moment, trim context
            clip_start = max(start_time, region['start'] - 10)
            clip_end = min(end_time, region['end'] + 3)
            clip_duration = clip_end - clip_start
        
        # Calculate algorithm score
        intensity_score = min(40, region['peak_score'] * 50)
        duration_score = min(30, (region['duration'] / 10) * 30)
        distinctness_score = min(30, (region['peak_score'] - threshold) / threshold * 30)
        
        algorithm_score = intensity_score + duration_score + distinctness_score
        
        laughter_clips.append({
            'id': f"laughter_{len(laughter_clips) + 1}",
            'startTime': round(clip_start, 2),
            'endTime': round(clip_end, 2),
            'duration': round(clip_duration, 2),
            'pattern': 'laughter',
            'patternLabel': 'Laughter Moment',
            'description': f"{region['duration']:.1f}s laughter burst",
            'algorithmScore': round(min(100, algorithm_score), 1),
            'hookStrength': round(min(100, intensity_score * 2), 1),
            'hookMultiplier': round(1.0 + (region['peak_score'] - 0.5) * 0.3, 2),
        })
    
    return laughter_clips

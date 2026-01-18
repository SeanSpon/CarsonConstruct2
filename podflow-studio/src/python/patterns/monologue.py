"""
Energy Monologue Detection

Pattern: Sustained high energy (15-60 seconds) + fast speech pace

Real examples:
- Passionate rants about a topic
- Hot takes / controversial opinions
- Excited storytelling
- Heated debates

Uses onset density to detect fast speech (word rate).
"""

import numpy as np
import librosa
from typing import List, Dict

def detect_energy_monologues(
    y: np.ndarray, 
    sr: int, 
    duration: float,
    start_time: float = 0,
    end_time: float = None,
    min_clip_duration: float = 15,
    max_clip_duration: float = 90
) -> List[Dict]:
    """
    Find sustained high-energy speech segments.
    """
    
    if end_time is None:
        end_time = duration
    
    # Step 1: Calculate RMS energy
    hop_length = int(sr * 0.05)  # 50ms windows
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    times = librosa.times_like(rms, sr=sr, hop_length=hop_length)
    
    if len(rms) == 0:
        return []
    
    # Smooth RMS
    window_size = 6
    if len(rms) >= window_size:
        rms_smooth = np.convolve(rms, np.ones(window_size)/window_size, mode='same')
    else:
        rms_smooth = rms
    
    # Step 2: Calculate speech onset density (word rate proxy)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)
    
    # Smooth onset envelope
    if len(onset_env) >= window_size:
        onset_smooth = np.convolve(onset_env, np.ones(window_size)/window_size, mode='same')
    else:
        onset_smooth = onset_env
    
    # Step 3: Define thresholds (using global percentiles)
    energy_threshold = np.percentile(rms_smooth, 70)  # Top 30% energy
    onset_threshold = np.percentile(onset_smooth, 60)  # Top 40% speech activity
    
    # Step 4: Find high-energy + high-onset regions
    min_len = min(len(rms_smooth), len(onset_smooth), len(times))
    
    high_energy_regions = []
    in_region = False
    region_start = 0
    region_start_idx = 0
    
    for i in range(min_len):
        time = times[i]
        energy = rms_smooth[i]
        onset = onset_smooth[i] if i < len(onset_smooth) else 0
        
        # Skip if outside analysis range
        if time < start_time or time > end_time:
            if in_region:
                # End any current region
                region_end = time
                region_duration = region_end - region_start
                if region_duration >= 15:  # At least 15 seconds
                    high_energy_regions.append({
                        'start': region_start,
                        'end': region_end,
                        'duration': region_duration,
                        'start_idx': region_start_idx,
                        'end_idx': i
                    })
                in_region = False
            continue
        
        # Check if both energy and onset are high
        is_high = energy > energy_threshold and onset > onset_threshold
        
        if is_high and not in_region:
            in_region = True
            region_start = time
            region_start_idx = i
        elif not is_high and in_region:
            # Allow brief dips (up to 1 second)
            lookahead = min(i + 20, min_len)  # 1 second lookahead
            if any(rms_smooth[j] > energy_threshold and onset_smooth[j] > onset_threshold 
                   for j in range(i, lookahead)):
                continue
            
            in_region = False
            region_end = time
            region_duration = region_end - region_start
            
            if region_duration >= 15:  # At least 15 seconds
                high_energy_regions.append({
                    'start': region_start,
                    'end': region_end,
                    'duration': region_duration,
                    'start_idx': region_start_idx,
                    'end_idx': i
                })
    
    # Handle region at end
    if in_region:
        region_end = min(times[-1], end_time)
        region_duration = region_end - region_start
        if region_duration >= 15:
            high_energy_regions.append({
                'start': region_start,
                'end': region_end,
                'duration': region_duration,
                'start_idx': region_start_idx,
                'end_idx': min_len - 1
            })
    
    # Step 5: Convert regions to clips
    monologue_clips = []
    
    for region in high_energy_regions:
        # Calculate scores based on region characteristics
        region_energy = rms_smooth[region['start_idx']:region['end_idx']]
        region_onset = onset_smooth[region['start_idx']:region['end_idx']]
        
        if len(region_energy) == 0:
            continue
        
        # Energy consistency (lower variance = more sustained)
        energy_mean = np.mean(region_energy)
        energy_std = np.std(region_energy)
        consistency = 1 - (energy_std / (energy_mean + 0.001))
        
        # Average onset rate (higher = faster speech)
        onset_mean = np.mean(region_onset)
        onset_ratio = onset_mean / (onset_threshold + 0.001)
        
        # Duration score (longer sustained = better, up to 45s)
        duration_score = min(30, (region['duration'] / 45) * 30)
        energy_score = min(35, consistency * 35)
        pace_score = min(35, onset_ratio * 20)
        
        algorithm_score = duration_score + energy_score + pace_score
        
        # Split if too long
        if region['duration'] > max_clip_duration:
            # Split into multiple clips
            num_clips = int(np.ceil(region['duration'] / max_clip_duration))
            clip_duration = region['duration'] / num_clips
            
            for j in range(num_clips):
                clip_start = region['start'] + j * clip_duration
                clip_end = clip_start + clip_duration
                
                monologue_clips.append({
                    'id': f"monologue_{len(monologue_clips) + 1}",
                    'startTime': round(clip_start, 2),
                    'endTime': round(min(clip_end, end_time), 2),
                    'duration': round(min(clip_duration, clip_end - clip_start), 2),
                    'pattern': 'monologue',
                    'patternLabel': 'Energy Monologue',
                    'description': f"{region['duration']:.0f}s sustained energy, fast pace",
                    'algorithmScore': round(min(100, algorithm_score - j * 5), 1),  # Slight penalty for later splits
                    'hookStrength': round(min(100, onset_ratio * 40), 1),
                    'hookMultiplier': round(1.0 + (consistency - 0.5) * 0.2, 2),
                })
        else:
            # Add padding for context
            clip_start = max(start_time, region['start'] - 2)
            clip_end = min(end_time, region['end'] + 2)
            clip_duration = clip_end - clip_start
            
            # Enforce minimum duration
            if clip_duration < min_clip_duration:
                extra = min_clip_duration - clip_duration
                clip_start = max(start_time, clip_start - extra / 2)
                clip_end = min(end_time, clip_end + extra / 2)
                clip_duration = clip_end - clip_start
            
            monologue_clips.append({
                'id': f"monologue_{len(monologue_clips) + 1}",
                'startTime': round(clip_start, 2),
                'endTime': round(clip_end, 2),
                'duration': round(clip_duration, 2),
                'pattern': 'monologue',
                'patternLabel': 'Energy Monologue',
                'description': f"{region['duration']:.0f}s sustained energy, fast pace",
                'algorithmScore': round(min(100, algorithm_score), 1),
                'hookStrength': round(min(100, onset_ratio * 40), 1),
                'hookMultiplier': round(1.0 + (consistency - 0.5) * 0.2, 2),
            })
    
    return monologue_clips

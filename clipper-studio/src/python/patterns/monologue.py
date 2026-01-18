"""
Energy Monologue Detection

Pattern: [Sustained High Energy] + [Fast Pace] + [15-60 seconds]

Real examples:
- Passionate rant about something
- Hot take delivery
- Story climax
- "Let me tell you something..." energy
- Inspirational speech moment

This is the "hot take/rant detector."
"""

import numpy as np
import librosa
from typing import List, Dict


def detect_energy_monologues(y: np.ndarray, sr: int, duration: float) -> List[Dict]:
    """
    Find sustained high-energy speech segments.
    
    Args:
        y: Audio time series
        sr: Sample rate
        duration: Total duration in seconds
    
    Returns:
        List of detected energy monologues with scores
    """
    
    # Step 1: Calculate RMS energy
    hop_length = int(sr * 0.05)  # 50ms
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    times = librosa.times_like(rms, sr=sr, hop_length=hop_length)
    
    if len(rms) == 0:
        return []
    
    # Step 2: Calculate speech onset density (proxy for pace)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)
    
    # Step 3: Define "high energy" threshold
    energy_threshold = np.percentile(rms, 70)  # Top 30%
    median_onset = np.median(onset_env) if len(onset_env) > 0 else 0
    
    # Step 4: Find sustained high-energy regions
    high_energy_regions = []
    region_start = None
    region_start_idx = 0
    
    # Minimum 70% of frames in a region must be high-energy
    min_high_ratio = 0.7
    
    for i, energy in enumerate(rms):
        if energy > energy_threshold:
            if region_start is None:
                region_start = times[i]
                region_start_idx = i
        else:
            if region_start is not None:
                region_end = times[i]
                region_duration = region_end - region_start
                
                # Check if region was long enough (15+ seconds)
                if region_duration >= 15.0:
                    # Calculate what % of this region was actually high-energy
                    region_rms = rms[region_start_idx:i]
                    high_ratio = np.mean(region_rms > energy_threshold * 0.8)
                    
                    if high_ratio >= min_high_ratio:
                        # Calculate average onset density in this region
                        region_onset = onset_env[region_start_idx:i] if i <= len(onset_env) else onset_env[region_start_idx:]
                        avg_onset = np.mean(region_onset) if len(region_onset) > 0 else 0
                        avg_energy = np.mean(region_rms)
                        
                        # Is pace actually fast? (above median onset density)
                        if avg_onset > median_onset * 0.8:  # Allow some flexibility
                            # Score based on:
                            # - Duration (longer = more sustained passion, capped at 60s contribution)
                            # - Energy level (higher = more intense)
                            # - Pace (faster = more energetic delivery)
                            
                            capped_duration = min(region_duration, 60.0)
                            duration_score = (capped_duration / 60.0) * 40
                            
                            energy_ratio = avg_energy / energy_threshold if energy_threshold > 0 else 1
                            energy_score = min(30, (energy_ratio - 0.5) * 30)
                            
                            pace_ratio = avg_onset / median_onset if median_onset > 0 else 1
                            pace_score = min(30, (pace_ratio - 0.5) * 30)
                            
                            total_score = duration_score + energy_score + pace_score
                            
                            # Clip boundaries
                            clip_start = max(0, region_start - 2.0)  # Buffer before
                            clip_end = min(duration, region_end + 2.0)  # Buffer after
                            
                            # Cap clip at 60 seconds
                            if clip_end - clip_start > 60:
                                clip_end = clip_start + 60
                            
                            high_energy_regions.append({
                                'id': f"monologue_{len(high_energy_regions) + 1}",
                                'start': clip_start,
                                'end': clip_end,
                                'startTime': clip_start,
                                'endTime': clip_end,
                                'duration': clip_end - clip_start,
                                'score': round(total_score, 1),
                                'pattern': 'monologue',
                                'patternLabel': 'Energy Monologue',
                                'description': f"{region_duration:.0f}s high-energy segment",
                                'raw_duration': region_duration,
                                'avg_energy': round(float(avg_energy), 4),
                                'avg_pace': round(float(avg_onset), 4),
                                'status': 'pending',
                                'trimStartOffset': 0,
                                'trimEndOffset': 0
                            })
                
                region_start = None
                region_start_idx = 0
    
    # Handle case where audio ends during a high-energy region
    if region_start is not None:
        region_end = times[-1] if len(times) > 0 else duration
        region_duration = region_end - region_start
        
        if region_duration >= 15.0:
            region_rms = rms[region_start_idx:]
            high_ratio = np.mean(region_rms > energy_threshold * 0.8)
            
            if high_ratio >= min_high_ratio:
                region_onset = onset_env[region_start_idx:] if region_start_idx < len(onset_env) else []
                avg_onset = np.mean(region_onset) if len(region_onset) > 0 else median_onset
                avg_energy = np.mean(region_rms)
                
                if avg_onset > median_onset * 0.8:
                    capped_duration = min(region_duration, 60.0)
                    duration_score = (capped_duration / 60.0) * 40
                    energy_ratio = avg_energy / energy_threshold if energy_threshold > 0 else 1
                    energy_score = min(30, (energy_ratio - 0.5) * 30)
                    pace_ratio = avg_onset / median_onset if median_onset > 0 else 1
                    pace_score = min(30, (pace_ratio - 0.5) * 30)
                    total_score = duration_score + energy_score + pace_score
                    
                    clip_start = max(0, region_start - 2.0)
                    clip_end = min(duration, region_end + 2.0)
                    if clip_end - clip_start > 60:
                        clip_end = clip_start + 60
                    
                    high_energy_regions.append({
                        'id': f"monologue_{len(high_energy_regions) + 1}",
                        'start': clip_start,
                        'end': clip_end,
                        'startTime': clip_start,
                        'endTime': clip_end,
                        'duration': clip_end - clip_start,
                        'score': round(total_score, 1),
                        'pattern': 'monologue',
                        'patternLabel': 'Energy Monologue',
                        'description': f"{region_duration:.0f}s high-energy segment",
                        'raw_duration': region_duration,
                        'avg_energy': round(float(avg_energy), 4),
                        'avg_pace': round(float(avg_onset), 4),
                        'status': 'pending',
                        'trimStartOffset': 0,
                        'trimEndOffset': 0
                    })
    
    return high_energy_regions

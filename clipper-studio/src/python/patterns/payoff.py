"""
Payoff Moment Detection

Pattern: [Silence/Low Energy 1.5-5 sec] → [Energy Spike]

Real examples:
- "So I told him... [pause] ...you're fired."
- "And then she said... [pause] ...I'm pregnant."
- Setup → Punchline
- Build-up → Drop
- Question → Answer bomb

This is the "punchline detector."
"""

import numpy as np
import librosa
from typing import List, Dict


def detect_payoff_moments(y: np.ndarray, sr: int, duration: float) -> List[Dict]:
    """
    Find moments where silence/low-energy is followed by energy spike.
    
    Args:
        y: Audio time series
        sr: Sample rate
        duration: Total duration in seconds
    
    Returns:
        List of detected payoff moments with scores
    """
    
    # Step 1: Calculate RMS energy in small windows
    hop_length = int(sr * 0.05)  # 50ms windows
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    times = librosa.times_like(rms, sr=sr, hop_length=hop_length)
    
    if len(rms) == 0:
        return []
    
    # Step 2: Define thresholds
    silence_threshold = np.percentile(rms, 20)  # Bottom 20% = "quiet"
    spike_threshold = np.percentile(rms, 75)    # Top 25% = "loud"
    
    # Step 3: Find silence regions
    silence_regions = []
    in_silence = False
    silence_start = 0
    
    for i, energy in enumerate(rms):
        if energy < silence_threshold and not in_silence:
            in_silence = True
            silence_start = times[i]
        elif energy >= silence_threshold and in_silence:
            in_silence = False
            silence_end = times[i]
            silence_duration = silence_end - silence_start
            
            # Valid silence: 1.5 - 5 seconds
            if 1.5 <= silence_duration <= 5.0:
                silence_regions.append({
                    'start': silence_start,
                    'end': silence_end,
                    'duration': silence_duration
                })
    
    # Step 4: Check what comes AFTER each silence
    payoff_moments = []
    
    for silence in silence_regions:
        # Look at 0.5 - 3 seconds after silence ends
        check_start = silence['end']
        check_end = min(check_start + 3.0, times[-1] if len(times) > 0 else duration)
        
        # Get energy in this window
        start_idx = np.searchsorted(times, check_start)
        end_idx = np.searchsorted(times, check_end)
        
        if start_idx >= end_idx or start_idx >= len(rms):
            continue
            
        post_silence_energy = rms[start_idx:end_idx]
        
        if len(post_silence_energy) == 0:
            continue
        
        max_energy = np.max(post_silence_energy)
        
        # Is there a spike? (must be 2x+ the spike threshold for reliability)
        if max_energy > spike_threshold * 1.5:
            # Calculate spike intensity (how much above threshold)
            spike_intensity = max_energy / spike_threshold
            
            # Check spike sustains for at least 0.5s (not just noise)
            sustained_count = np.sum(post_silence_energy > spike_threshold)
            sustained_duration = sustained_count * 0.05  # 50ms per frame
            
            if sustained_duration < 0.5:
                continue  # Spike too brief, likely noise
            
            # Score based on:
            # - Silence duration (longer = more build-up)
            # - Spike intensity (louder = bigger payoff)
            silence_score = min(40, (silence['duration'] / 5.0) * 40)
            spike_score = min(60, (spike_intensity - 1.0) * 30)
            
            score = silence_score + spike_score
            
            # Clip boundaries
            clip_start = max(0, silence['start'] - 3.0)  # Include context before silence
            clip_end = min(duration, check_end + 5.0)    # Include payoff + reaction
            
            payoff_moments.append({
                'id': f"payoff_{len(payoff_moments) + 1}",
                'start': clip_start,
                'end': clip_end,
                'startTime': clip_start,
                'endTime': clip_end,
                'duration': clip_end - clip_start,
                'score': round(score, 1),
                'pattern': 'payoff',
                'patternLabel': 'Payoff Moment',
                'description': f"{silence['duration']:.1f}s pause → energy spike",
                'silence_duration': silence['duration'],
                'spike_intensity': round(spike_intensity, 2),
                'status': 'pending',
                'trimStartOffset': 0,
                'trimEndOffset': 0
            })
    
    return payoff_moments

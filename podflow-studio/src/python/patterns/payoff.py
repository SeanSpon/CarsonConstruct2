"""
Payoff Moment Detection

Pattern: [Silence/Low Energy 1.5-5 sec] → [Energy Spike]

Real examples:
- "So I told him... [pause] ...you're fired."
- "And then she said... [pause] ...I'm pregnant."
- Setup → Punchline / Build-up → Drop / Question → Answer

Uses LOCAL baseline (10s before silence, not whole episode).
"""

import numpy as np
import librosa
from typing import List, Dict

def detect_payoff_moments(
    y: np.ndarray, 
    sr: int, 
    duration: float,
    start_time: float = 0,
    end_time: float = None,
    min_clip_duration: float = 15,
    max_clip_duration: float = 90
) -> List[Dict]:
    """
    Find moments where silence/low-energy is followed by energy spike.
    Uses local baseline comparison for better accuracy.
    """
    
    if end_time is None:
        end_time = duration
    
    # Step 1: Calculate RMS energy in small windows
    hop_length = int(sr * 0.05)  # 50ms windows
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    times = librosa.times_like(rms, sr=sr, hop_length=hop_length)
    
    if len(rms) == 0:
        return []
    
    # Smooth RMS with moving average (300ms window = 6 frames)
    window_size = 6
    if len(rms) >= window_size:
        rms = np.convolve(rms, np.ones(window_size)/window_size, mode='same')
    
    # Step 2: Find silence regions using LOCAL baseline
    silence_regions = []
    in_silence = False
    silence_start = 0
    silence_start_idx = 0
    
    for i, (time, energy) in enumerate(zip(times, rms)):
        # Skip if outside analysis range
        if time < start_time or time > end_time:
            continue
        
        # Calculate LOCAL baseline (10 seconds before current position)
        local_start_idx = max(0, i - int(10 / 0.05))  # 10s = 200 frames at 50ms
        local_window = rms[local_start_idx:i] if i > local_start_idx else rms[:i]
        
        if len(local_window) < 10:
            continue
        
        # Local threshold: bottom 25% of recent energy
        local_silence_thresh = np.percentile(local_window, 25)
        
        if energy < local_silence_thresh and not in_silence:
            in_silence = True
            silence_start = time
            silence_start_idx = i
        elif energy >= local_silence_thresh and in_silence:
            in_silence = False
            silence_end = time
            silence_duration = silence_end - silence_start
            
            # Valid silence: 1.5 - 5 seconds
            if 1.5 <= silence_duration <= 5.0:
                silence_regions.append({
                    'start': silence_start,
                    'end': silence_end,
                    'duration': silence_duration,
                    'start_idx': silence_start_idx,
                    'end_idx': i
                })
            in_silence = False
    
    # Step 3: Check what comes AFTER each silence
    payoff_moments = []
    
    for silence in silence_regions:
        silence_end_idx = silence['end_idx']
        
        # Local baseline: 10 seconds BEFORE the silence
        baseline_start_idx = max(0, silence['start_idx'] - int(10 / 0.05))
        baseline_window = rms[baseline_start_idx:silence['start_idx']]
        
        if len(baseline_window) < 20:
            continue
        
        local_mean = np.mean(baseline_window)
        local_std = np.std(baseline_window)
        spike_threshold = local_mean + (1.5 * local_std)  # 1.5 std above mean
        
        # Look at 0.5 - 3 seconds after silence ends
        check_start_idx = silence_end_idx
        check_end_idx = min(len(rms), silence_end_idx + int(3 / 0.05))
        
        if check_start_idx >= check_end_idx:
            continue
        
        post_silence_energy = rms[check_start_idx:check_end_idx]
        
        if len(post_silence_energy) < 5:
            continue
        
        max_energy = np.max(post_silence_energy)
        max_idx = np.argmax(post_silence_energy)
        
        # Is there a meaningful spike?
        if max_energy > spike_threshold:
            # Check spike sustains for at least 0.5s
            sustained_count = np.sum(post_silence_energy > spike_threshold * 0.8)
            sustained_duration = sustained_count * 0.05
            
            if sustained_duration < 0.5:
                continue
            
            # Calculate spike intensity relative to local baseline
            spike_intensity = max_energy / (local_mean + 0.001)
            
            # Score based on silence duration + spike intensity + sustain
            silence_score = min(35, (silence['duration'] / 5.0) * 35)
            spike_score = min(45, (spike_intensity - 1.0) * 22)
            sustain_score = min(20, sustained_duration * 10)
            
            algorithm_score = silence_score + spike_score + sustain_score
            
            # Clip boundaries - include context
            clip_start = max(start_time, silence['start'] - 5.0)
            clip_end = min(end_time, silence['end'] + 5.0 + sustained_duration)
            
            # Enforce duration limits
            clip_duration = clip_end - clip_start
            if clip_duration < min_clip_duration:
                # Extend to meet minimum
                extra = min_clip_duration - clip_duration
                clip_start = max(start_time, clip_start - extra / 2)
                clip_end = min(end_time, clip_end + extra / 2)
                clip_duration = clip_end - clip_start
            
            if clip_duration > max_clip_duration:
                # Trim to maximum, keeping the payoff moment centered
                clip_start = max(start_time, silence['end'] - max_clip_duration * 0.3)
                clip_end = clip_start + max_clip_duration
                clip_duration = max_clip_duration
            
            payoff_moments.append({
                'id': f"payoff_{len(payoff_moments) + 1}",
                'startTime': round(clip_start, 2),
                'endTime': round(clip_end, 2),
                'duration': round(clip_duration, 2),
                'pattern': 'payoff',
                'patternLabel': 'Payoff Moment',
                'description': f"{silence['duration']:.1f}s pause → {sustained_duration:.1f}s energy spike",
                'algorithmScore': round(min(100, algorithm_score), 1),
                'hookStrength': round(min(100, spike_intensity * 30), 1),
                'hookMultiplier': round(1.0 + (spike_intensity - 1.5) * 0.1, 2),
                'silenceDuration': round(silence['duration'], 2),
                'spikeIntensity': round(spike_intensity, 2),
            })
    
    return payoff_moments

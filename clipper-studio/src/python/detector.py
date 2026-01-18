#!/usr/bin/env python3
"""
Clipper Studio - Main Detection Pipeline

Two patterns. Done right.
1. Payoff Moment: Silence → Energy Spike (punchlines, reveals)
2. Energy Monologue: Sustained high energy + fast pace (rants, hot takes)

Outputs JSON progress updates to stdout for Electron to parse.
"""

import sys
import json
import tempfile
import os

def send_progress(step: str, progress: int, message: str):
    """Send progress update to Electron via stdout"""
    print(json.dumps({
        "type": "progress",
        "step": step,
        "progress": progress,
        "message": message
    }), flush=True)


def send_complete(clips: list, waveform: list):
    """Send completion message with results"""
    print(json.dumps({
        "type": "complete",
        "clips": clips,
        "waveform": waveform
    }), flush=True)


def send_error(error: str):
    """Send error message"""
    print(json.dumps({
        "type": "error",
        "error": error
    }), flush=True)


def main(video_path: str):
    """Main detection pipeline - 2 patterns only"""
    
    # Import dependencies
    try:
        import librosa
        import numpy as np
    except ImportError as e:
        send_error(f"Missing Python dependency: {e}. Run: pip install librosa numpy scipy")
        sys.exit(1)
    
    # Import our modules
    from patterns.payoff import detect_payoff_moments
    from patterns.monologue import detect_energy_monologues
    from patterns.hook_scorer import calculate_hook_strength
    from utils.audio import extract_audio, generate_waveform
    from utils.scoring import calculate_final_scores, select_final_clips
    
    with tempfile.TemporaryDirectory() as tmpdir:
        audio_path = os.path.join(tmpdir, "audio.wav")
        
        # Step 1: Extract audio from video
        send_progress("extracting", 5, "Extracting audio from video...")
        try:
            extract_audio(video_path, audio_path)
        except Exception as e:
            send_error(f"Failed to extract audio: {e}")
            sys.exit(1)
        
        send_progress("extracting", 15, "Loading audio for analysis...")
        
        # Load audio with librosa
        try:
            y, sr = librosa.load(audio_path, sr=22050)
            duration = librosa.get_duration(y=y, sr=sr)
        except Exception as e:
            send_error(f"Failed to load audio: {e}")
            sys.exit(1)
        
        send_progress("extracting", 20, "Audio loaded successfully")
        
        # Step 2: Detect Payoff Moments (silence → spike)
        send_progress("payoff", 30, "Detecting payoff moments...")
        try:
            payoff_moments = detect_payoff_moments(y, sr, duration)
            send_progress("payoff", 50, f"Found {len(payoff_moments)} potential payoff moments")
        except Exception as e:
            send_error(f"Payoff detection failed: {e}")
            sys.exit(1)
        
        # Step 3: Detect Energy Monologues (sustained high energy + fast pace)
        send_progress("monologue", 55, "Detecting energy monologues...")
        try:
            monologue_moments = detect_energy_monologues(y, sr, duration)
            send_progress("monologue", 75, f"Found {len(monologue_moments)} potential monologues")
        except Exception as e:
            send_error(f"Monologue detection failed: {e}")
            sys.exit(1)
        
        # Step 4: Combine and score with hook strength
        send_progress("scoring", 80, "Calculating hook strength...")
        
        all_moments = payoff_moments + monologue_moments
        
        # Calculate hook strength for each moment
        for moment in all_moments:
            try:
                hook_data = calculate_hook_strength(y, sr, moment['start'], moment['end'])
                moment['hookStrength'] = int(hook_data['strength_score'])
                moment['hookMultiplier'] = hook_data['multiplier']
            except:
                moment['hookStrength'] = 50
                moment['hookMultiplier'] = 1.0
        
        send_progress("scoring", 90, "Selecting best clips...")
        
        # Calculate final scores and select top clips
        scored_clips = calculate_final_scores(all_moments)
        final_clips = select_final_clips(scored_clips, max_clips=20, min_gap=30)
        
        send_progress("scoring", 95, "Generating waveform...")
        
        # Generate waveform for UI
        waveform = generate_waveform(y, num_points=1000)
        
        send_progress("scoring", 100, f"Complete! Found {len(final_clips)} clips")
        
        # Send final results
        send_complete(final_clips, waveform)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        send_error("Usage: python detector.py <video_path>")
        sys.exit(1)
    
    video_path = sys.argv[1]
    
    if not os.path.exists(video_path):
        send_error(f"Video file not found: {video_path}")
        sys.exit(1)
    
    main(video_path)

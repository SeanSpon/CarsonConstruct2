#!/usr/bin/env python3
"""
PodFlow Studio - Main Detection Pipeline

Hybrid approach:
1. Algorithms for timing detection (fast, reliable)
2. Optional AI for semantic understanding (titles, validation)

Patterns detected:
- Payoff: Silence → Energy Spike (punchlines, reveals)
- Monologue: Sustained high energy + fast pace (rants, hot takes)
- Laughter: Burst energy clusters (comedic moments)
- Dead Spaces: Silence > 3s (for auto-edit)
"""

import sys
import json
import tempfile
import os

def send_progress(progress: int, message: str):
    """Send progress update to Electron via stdout"""
    print(f"PROGRESS:{progress}:{message}", flush=True)

def send_result(clips: list, dead_spaces: list, transcript: dict = None):
    """Send final results"""
    result = {
        "clips": clips,
        "deadSpaces": dead_spaces,
        "transcript": transcript
    }
    print(f"RESULT:{json.dumps(result)}", flush=True)

def send_error(error: str):
    """Send error message"""
    print(f"ERROR:{error}", flush=True)

def extract_audio_ffmpeg(video_path: str, audio_path: str):
    """Extract audio from video using FFmpeg"""
    import subprocess
    
    cmd = [
        'ffmpeg', '-y',
        '-i', video_path,
        '-vn',  # No video
        '-acodec', 'pcm_s16le',  # PCM format for librosa
        '-ar', '22050',  # Sample rate
        '-ac', '1',  # Mono
        audio_path
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f"FFmpeg error: {result.stderr}")

def normalize_audio(y, sr):
    """Normalize audio for consistent analysis"""
    import numpy as np
    
    # Remove DC offset
    y = y - np.mean(y)
    
    # Normalize to peak
    max_val = np.max(np.abs(y))
    if max_val > 0:
        y = y / max_val * 0.95
    
    return y

def main(video_path: str, settings: dict):
    """Main detection pipeline"""
    
    # Import dependencies
    try:
        import librosa
        import numpy as np
    except ImportError as e:
        send_error(f"Missing Python dependency: {e}. Run: pip install librosa numpy scipy soundfile")
        sys.exit(1)
    
    # Import pattern detectors
    from patterns.payoff import detect_payoff_moments
    from patterns.monologue import detect_energy_monologues
    from patterns.laughter import detect_laughter_moments
    from patterns.silence import detect_dead_spaces
    from utils.audio import generate_waveform
    from utils.scoring import calculate_final_scores, select_final_clips, merge_overlapping_clips
    
    target_count = settings.get('target_count', 10)
    min_duration = settings.get('min_duration', 15)
    max_duration = settings.get('max_duration', 90)
    skip_intro = settings.get('skip_intro', 90)
    skip_outro = settings.get('skip_outro', 60)
    use_ai = settings.get('use_ai_enhancement', False)
    openai_key = settings.get('openai_api_key', '')
    
    with tempfile.TemporaryDirectory() as tmpdir:
        audio_path = os.path.join(tmpdir, "audio.wav")
        
        # Step 1: Extract audio
        send_progress(5, "Extracting audio from video...")
        try:
            extract_audio_ffmpeg(video_path, audio_path)
        except Exception as e:
            send_error(f"Failed to extract audio: {e}")
            sys.exit(1)
        
        send_progress(15, "Loading audio for analysis...")
        
        # Load audio with librosa
        try:
            y, sr = librosa.load(audio_path, sr=22050)
            duration = librosa.get_duration(y=y, sr=sr)
        except Exception as e:
            send_error(f"Failed to load audio: {e}")
            sys.exit(1)
        
        send_progress(20, "Normalizing audio...")
        y = normalize_audio(y, sr)
        
        # Define analysis boundaries
        start_time = skip_intro
        end_time = max(0, duration - skip_outro)
        
        if start_time >= end_time:
            send_error("Video too short after skipping intro/outro")
            sys.exit(1)
        
        # Step 2: Detect Payoff Moments (silence → spike)
        send_progress(30, "Detecting payoff moments...")
        try:
            payoff_clips = detect_payoff_moments(
                y, sr, duration,
                start_time=start_time,
                end_time=end_time,
                min_clip_duration=min_duration,
                max_clip_duration=max_duration
            )
            send_progress(40, f"Found {len(payoff_clips)} payoff moments")
        except Exception as e:
            send_error(f"Payoff detection failed: {e}")
            sys.exit(1)
        
        # Step 3: Detect Energy Monologues
        send_progress(45, "Detecting energy monologues...")
        try:
            monologue_clips = detect_energy_monologues(
                y, sr, duration,
                start_time=start_time,
                end_time=end_time,
                min_clip_duration=min_duration,
                max_clip_duration=max_duration
            )
            send_progress(55, f"Found {len(monologue_clips)} monologue moments")
        except Exception as e:
            send_error(f"Monologue detection failed: {e}")
            sys.exit(1)
        
        # Step 4: Detect Laughter Moments
        send_progress(60, "Detecting laughter moments...")
        try:
            laughter_clips = detect_laughter_moments(
                y, sr, duration,
                start_time=start_time,
                end_time=end_time,
                min_clip_duration=min_duration,
                max_clip_duration=max_duration
            )
            send_progress(65, f"Found {len(laughter_clips)} laughter moments")
        except Exception as e:
            # Laughter detection is optional, don't fail
            laughter_clips = []
        
        # Step 5: Detect Dead Spaces (for auto-edit)
        send_progress(70, "Detecting dead spaces...")
        try:
            dead_spaces = detect_dead_spaces(y, sr, duration, min_silence=3.0)
            send_progress(72, f"Found {len(dead_spaces)} dead spaces")
        except Exception as e:
            dead_spaces = []
        
        # Step 6: Merge and score clips
        send_progress(75, "Merging and scoring clips...")
        all_clips = payoff_clips + monologue_clips + laughter_clips
        all_clips = merge_overlapping_clips(all_clips)
        all_clips = calculate_final_scores(all_clips, y, sr)
        
        send_progress(80, "Selecting best clips...")
        final_clips = select_final_clips(all_clips, max_clips=target_count * 2, min_gap=30)
        
        # Step 7: AI Enhancement (optional)
        transcript = None
        if use_ai and openai_key:
            try:
                send_progress(85, "Transcribing audio with Whisper...")
                from ai.transcription import transcribe_with_whisper
                transcript = transcribe_with_whisper(audio_path, openai_key)
                
                send_progress(90, "Enhancing clips with AI...")
                from ai.clip_enhancement import enhance_clips_with_ai
                final_clips = enhance_clips_with_ai(final_clips, transcript, openai_key)
            except Exception as e:
                send_progress(90, f"AI enhancement skipped: {e}")
        else:
            send_progress(90, "Skipping AI enhancement...")
        
        # Final selection (top N by score)
        final_clips = sorted(final_clips, key=lambda c: c.get('finalScore', c.get('algorithmScore', 0)), reverse=True)
        final_clips = final_clips[:target_count]
        
        send_progress(95, f"Complete! Found {len(final_clips)} clips")
        
        # Send results
        send_result(final_clips, dead_spaces, transcript)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        send_error("Usage: python detector.py <video_path> <settings_json>")
        sys.exit(1)
    
    video_path = sys.argv[1]
    
    try:
        settings = json.loads(sys.argv[2])
    except json.JSONDecodeError as e:
        send_error(f"Invalid settings JSON: {e}")
        sys.exit(1)
    
    if not os.path.exists(video_path):
        send_error(f"Video file not found: {video_path}")
        sys.exit(1)
    
    main(video_path, settings)

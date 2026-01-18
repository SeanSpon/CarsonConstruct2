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


def send_complete(clips: list, waveform: list, debug: dict = None):
    """Send completion message with results"""
    payload = {
        "type": "complete",
        "clips": clips,
        "waveform": waveform,
    }
    if debug is not None:
        payload["debug"] = debug
    print(json.dumps(payload), flush=True)


def send_error(error: str):
    """Send error message"""
    print(json.dumps({
        "type": "error",
        "error": error
    }), flush=True)


def main(video_path: str, debug: bool = False):
    """Main detection pipeline - 2 patterns only"""
    
    # Import dependencies
    try:
        import librosa
        import numpy as np
    except ImportError as e:
        send_error(f"Missing Python dependency: {e}. Run: pip install librosa numpy scipy")
        sys.exit(1)
    
    # Import our modules
    from features import extract_features
    from patterns.payoff import detect_payoff_moments
    from patterns.monologue import detect_energy_monologues
    from utils.audio import extract_audio, generate_waveform
    from utils.clipworthiness import apply_clipworthiness
    from utils.scoring import calculate_final_scores, select_final_clips
    from vad_utils import snap_clip_to_segments
    
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
        
        # Step 2: Build feature cache + VAD
        send_progress("features", 25, "Extracting audio features...")
        feature_settings = {"baseline_window_s": 15.0}
        features = extract_features(y, sr, settings=feature_settings)

        bounds = {
            "start_time": 0.0,
            "end_time": duration,
            "min_duration": 15.0,
            "max_duration": 90.0,
        }

        # Step 3: Detect Payoff Moments (silence → spike)
        send_progress("payoff", 30, "Detecting payoff moments...")
        try:
            payoff_moments = detect_payoff_moments(features, bounds, {"debug": debug})
            send_progress("payoff", 50, f"Found {len(payoff_moments)} potential payoff moments")
        except Exception as e:
            send_error(f"Payoff detection failed: {e}")
            sys.exit(1)
        
        # Step 4: Detect Energy Monologues (sustained high energy + dense speech)
        send_progress("monologue", 55, "Detecting energy monologues...")
        try:
            monologue_moments = detect_energy_monologues(features, bounds, {"debug": debug})
            send_progress("monologue", 75, f"Found {len(monologue_moments)} potential monologues")
        except Exception as e:
            send_error(f"Monologue detection failed: {e}")
            sys.exit(1)
        
        # Step 5: Snap boundaries + score with clipworthiness
        send_progress("scoring", 80, "Snapping and scoring clips...")

        all_moments = payoff_moments + monologue_moments
        snapped = []
        for moment in all_moments:
            new_start, new_end, snapped_flag, snap_reason = snap_clip_to_segments(
                moment["startTime"],
                moment["endTime"],
                features.get("vad_segments", []),
                (0.0, duration),
                bounds["min_duration"],
                bounds["max_duration"],
                snap_window_s=2.0,
                tail_padding_s=0.4,
            )
            moment["startTime"] = round(new_start, 2)
            moment["endTime"] = round(new_end, 2)
            moment["duration"] = round(new_end - new_start, 2)
            moment["start"] = moment["startTime"]
            moment["end"] = moment["endTime"]
            if debug:
                moment.setdefault("debug", {})
                moment["debug"]["snapApplied"] = snapped_flag
                moment["debug"]["snapReason"] = snap_reason
            snapped.append(moment)

        scored_clips, debug_stats = apply_clipworthiness(
            snapped, features, {"debug": debug}, debug=debug
        )
        scored_clips = calculate_final_scores(scored_clips)

        send_progress(
            "scoring",
            85,
            f"Gated {debug_stats['gatedOut']} of {debug_stats['candidates']} candidates",
        )

        send_progress("scoring", 90, "Selecting best clips...")
        final_clips = select_final_clips(scored_clips, max_clips=20, min_gap=30)
        
        send_progress("scoring", 95, "Generating waveform...")
        
        # Generate waveform for UI
        waveform = generate_waveform(y, num_points=1000)
        
        send_progress("scoring", 100, f"Complete! Found {len(final_clips)} clips")
        
        # Send final results
        debug_payload = None
        if debug:
            debug_payload = {"gating": debug_stats}

        send_complete(final_clips, waveform, debug=debug_payload)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        send_error("Usage: python detector.py <video_path> [--debug]")
        sys.exit(1)

    video_path = sys.argv[1]
    debug_flag = "--debug" in sys.argv[2:]

    if not os.path.exists(video_path):
        send_error(f"Video file not found: {video_path}")
        sys.exit(1)

    main(video_path, debug=debug_flag)

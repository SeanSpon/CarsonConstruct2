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

CACHE_VERSION = 1

def send_progress(progress: int, message: str):
    """Send progress update to Electron via stdout"""
    print(f"PROGRESS:{progress}:{message}", flush=True)

def send_result(clips: list, dead_spaces: list, transcript: dict = None, speakers: list = None, debug: dict = None):
    """Send final results"""
    result = {
        "clips": clips,
        "deadSpaces": dead_spaces,
        "transcript": transcript,
        "speakers": speakers or [],
    }
    if debug is not None:
        result["debug"] = debug
    print(f"RESULT:{json.dumps(result)}", flush=True)

def send_error(error: str):
    """Send error message"""
    print(f"ERROR:{error}", flush=True)

def _safe_read_json(path: str):
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None

def _write_json(path: str, payload: dict):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=True)

def _algo_cache_key(input_hash: str, settings: dict) -> str:
    payload = {
        "version": CACHE_VERSION,
        "input_hash": input_hash,
        "settings": {
            "target_count": settings.get("target_count"),
            "min_duration": settings.get("min_duration"),
            "max_duration": settings.get("max_duration"),
            "skip_intro": settings.get("skip_intro"),
            "skip_outro": settings.get("skip_outro"),
            "feature_settings": settings.get("feature_settings", {}),
            "vad_snapping": settings.get("vad_snapping", {}),
            "min_silence": settings.get("min_silence", 3.0),
            "max_silence": settings.get("max_silence", 30.0),
        },
    }
    return json.dumps(payload, sort_keys=True, ensure_ascii=True)

def _ai_cache_key(input_hash: str, algo_key: str, settings: dict) -> str:
    payload = {
        "version": CACHE_VERSION,
        "input_hash": input_hash,
        "algo_key": algo_key,
        "ai_model": settings.get("ai_model", "gpt-4o-mini"),
        "context_pack_id": settings.get("context_pack_id", "default"),
        "ai_top_k": settings.get("ai_top_k", 25),
        "target_count": settings.get("target_count", 10),
    }
    return json.dumps(payload, sort_keys=True, ensure_ascii=True)

def _transcript_cache_key(input_hash: str) -> str:
    payload = {
        "version": CACHE_VERSION,
        "input_hash": input_hash,
        "model": "whisper-1",
    }
    return json.dumps(payload, sort_keys=True, ensure_ascii=True)

def extract_audio_ffmpeg(video_path: str, audio_path: str, ffmpeg_path: str = None):
    """Extract audio from video using FFmpeg"""
    import subprocess
    import shutil
    
    print(f"DEBUG:extract_audio_ffmpeg called", flush=True)
    print(f"DEBUG:Received ffmpeg_path: {ffmpeg_path}", flush=True)
    
    # Determine FFmpeg path with fallbacks
    ffmpeg_cmd = None
    
    # 1. Try provided path
    if ffmpeg_path:
        exists = os.path.exists(ffmpeg_path)
        is_file = os.path.isfile(ffmpeg_path) if exists else False
        print(f"DEBUG:Provided path exists={exists}, isfile={is_file}", flush=True)
        if exists and is_file:
            # Verify it's a reasonable size (real ffmpeg is > 50MB usually)
            try:
                size = os.path.getsize(ffmpeg_path)
                print(f"DEBUG:FFmpeg binary size: {size / 1024 / 1024:.1f} MB", flush=True)
                if size > 1000000:  # At least 1MB
                    ffmpeg_cmd = ffmpeg_path
                    print(f"DEBUG:Using provided FFmpeg: {ffmpeg_cmd}", flush=True)
                else:
                    print(f"DEBUG:FFmpeg binary too small ({size} bytes), might be corrupted", flush=True)
            except Exception as e:
                print(f"DEBUG:Error checking ffmpeg size: {e}", flush=True)
        else:
            print(f"DEBUG:Provided FFmpeg path doesn't exist or not a file: {ffmpeg_path}", flush=True)
    
    # 2. Try system PATH
    if not ffmpeg_cmd:
        print(f"DEBUG:Trying system PATH...", flush=True)
        system_ffmpeg = shutil.which('ffmpeg')
        if system_ffmpeg:
            ffmpeg_cmd = system_ffmpeg
            print(f"DEBUG:Using system FFmpeg: {ffmpeg_cmd}", flush=True)
        else:
            print(f"DEBUG:FFmpeg not found in system PATH", flush=True)
    
    # 3. Try common Windows install locations
    if not ffmpeg_cmd:
        print(f"DEBUG:Trying common Windows locations...", flush=True)
        common_paths = [
            r'C:\ffmpeg\bin\ffmpeg.exe',
            r'C:\ffmpeg\ffmpeg.exe',
            r'C:\Program Files\ffmpeg\bin\ffmpeg.exe',
            r'C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe',
            os.path.expanduser(r'~\ffmpeg\bin\ffmpeg.exe'),
        ]
        for path in common_paths:
            if os.path.exists(path) and os.path.isfile(path):
                ffmpeg_cmd = path
                print(f"DEBUG:Using FFmpeg from common location: {ffmpeg_cmd}", flush=True)
                break
    
    if not ffmpeg_cmd:
        raise Exception(
            "FFmpeg not found. Please install FFmpeg:\n"
            "  Option 1: winget install FFmpeg\n"
            "  Option 2: Download from https://ffmpeg.org/download.html and add to PATH\n"
            "  Option 3: Extract to C:\\ffmpeg\\bin\\ffmpeg.exe"
        )
    
    cmd = [
        ffmpeg_cmd, '-y',
        '-i', video_path,
        '-vn',  # No video
        '-acodec', 'pcm_s16le',  # PCM format for librosa
        '-ar', '22050',  # Sample rate
        '-ac', '1',  # Mono
        audio_path
    ]
    
    print(f"DEBUG:Running FFmpeg: {ffmpeg_cmd}", flush=True)
    print(f"DEBUG:Input: {video_path}", flush=True)
    print(f"DEBUG:Output: {audio_path}", flush=True)
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        print(f"DEBUG:FFmpeg return code: {result.returncode}", flush=True)
        if result.returncode != 0:
            print(f"DEBUG:FFmpeg stderr: {result.stderr[:500] if result.stderr else 'empty'}", flush=True)
            raise Exception(f"FFmpeg error (code {result.returncode}): {result.stderr}")
    except subprocess.TimeoutExpired:
        raise Exception("FFmpeg timed out after 5 minutes")
    except FileNotFoundError as e:
        raise Exception(f"FFmpeg executable not found at {ffmpeg_cmd}: {e}")

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
    
    target_count = settings.get("target_count", 10)
    min_duration = settings.get("min_duration", 15)
    max_duration = settings.get("max_duration", 90)
    skip_intro = settings.get("skip_intro", 90)
    skip_outro = settings.get("skip_outro", 60)
    use_ai = settings.get("use_ai_enhancement", False)
    openai_key = settings.get("openai_api_key", "")
    debug = settings.get("debug", False)
    input_hash = settings.get("input_hash", "")
    cache_dir = settings.get("cache_dir")
    ai_cache_dir = settings.get("ai_cache_dir")
    ffmpeg_path = settings.get("ffmpeg_path")

    ai_enabled = bool(use_ai and openai_key)
    if use_ai and not openai_key:
        send_progress(85, "AI enabled without API key; using algorithm-only...")

    algo_cache_key = _algo_cache_key(input_hash, settings)
    ai_cache_key = _ai_cache_key(input_hash, algo_cache_key, settings)
    transcript_cache_key = _transcript_cache_key(input_hash)

    cached_algo = None
    cached_transcript = None
    cached_ai = None
    detections_cache_path = None
    transcript_cache_path = None
    ai_cache_path = None

    if cache_dir:
        detections_cache_path = os.path.join(cache_dir, "detections.json")
        transcript_cache_path = os.path.join(cache_dir, "transcript.json")
        ai_cache_path = os.path.join(cache_dir, "ai_clips.json")

        algo_payload = _safe_read_json(detections_cache_path)
        if algo_payload and algo_payload.get("cache_key") == algo_cache_key:
            cached_algo = algo_payload

        transcript_payload = _safe_read_json(transcript_cache_path)
        if transcript_payload and transcript_payload.get("cache_key") == transcript_cache_key:
            cached_transcript = transcript_payload.get("transcript")

        ai_payload = _safe_read_json(ai_cache_path)
        if ai_payload and ai_payload.get("cache_key") == ai_cache_key:
            cached_ai = ai_payload.get("clips")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        audio_path = os.path.join(tmpdir, "audio.wav")
        need_audio = cached_algo is None or (ai_enabled and cached_transcript is None)

        if need_audio:
            send_progress(5, "Extracting audio from video...")
            try:
                extract_audio_ffmpeg(video_path, audio_path, ffmpeg_path)
            except Exception as e:
                send_error(f"Failed to extract audio: {e}")
                sys.exit(1)

        algorithm_clips = []
        dead_spaces = []
        debug_stats = {}
        duration = None

        if cached_algo is not None:
            send_progress(25, "Cache hit: detections")
            algorithm_clips = cached_algo.get("clips", [])
            dead_spaces = cached_algo.get("deadSpaces", [])
            debug_stats = cached_algo.get("debug_stats", {})
            duration = cached_algo.get("duration")
        else:
            # Import dependencies only when needed
            try:
                import librosa
                import numpy as np
            except ImportError as e:
                send_error(f"Missing Python dependency: {e}. Run: pip install librosa numpy scipy soundfile")
                sys.exit(1)

            # Import pattern detectors
            from features import extract_features
            from patterns.payoff import detect_payoff_moments
            from patterns.monologue import detect_energy_monologues
            from patterns.laughter import detect_laughter_moments
            from patterns.debate import detect_debate_moments
            from patterns.silence import detect_dead_spaces
            from utils.scoring import select_final_clips, merge_overlapping_clips
            from utils.clipworthiness import apply_clipworthiness
            from vad_utils import snap_clip_to_segments

            send_progress(15, "Loading audio for analysis...")
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

            # Step 2: Build feature cache + VAD
            send_progress(25, "Extracting audio features...")
            feature_settings = settings.get("feature_settings", {})
            features = extract_features(y, sr, settings=feature_settings)

            bounds = {
                "start_time": start_time,
                "end_time": end_time,
                "min_duration": min_duration,
                "max_duration": max_duration,
            }

            # Step 3: Detect Payoff Moments (silence → spike)
            send_progress(30, "Detecting payoff moments...")
            try:
                payoff_clips = detect_payoff_moments(
                    features, bounds, settings
                )
                send_progress(40, f"Found {len(payoff_clips)} payoff moments")
            except Exception as e:
                send_error(f"Payoff detection failed: {e}")
                sys.exit(1)

            # Step 4: Detect Energy Monologues
            send_progress(45, "Detecting energy monologues...")
            try:
                monologue_clips = detect_energy_monologues(
                    features, bounds, settings
                )
                send_progress(55, f"Found {len(monologue_clips)} monologue moments")
            except Exception as e:
                send_error(f"Monologue detection failed: {e}")
                sys.exit(1)

            # Step 5: Detect Laughter Moments
            send_progress(60, "Detecting laughter moments...")
            try:
                laughter_clips = detect_laughter_moments(
                    features, bounds, settings
                )
                send_progress(65, f"Found {len(laughter_clips)} laughter moments")
            except Exception:
                # Laughter detection is optional, don't fail
                laughter_clips = []

            # Step 6: Detect Debate / Turn-taking
            send_progress(67, "Detecting debate moments...")
            try:
                debate_clips = detect_debate_moments(features, bounds, settings)
                send_progress(69, f"Found {len(debate_clips)} debate moments")
            except Exception:
                debate_clips = []

            # Step 7: Detect Dead Spaces (for auto-edit)
            send_progress(70, "Detecting dead spaces...")
            try:
                dead_spaces = detect_dead_spaces(
                    features,
                    bounds,
                    {
                        **settings,
                        "min_silence": settings.get("min_silence", 3.0),
                        "max_silence": settings.get("max_silence", 30.0),
                    },
                )
                send_progress(72, f"Found {len(dead_spaces)} dead spaces")
            except Exception:
                dead_spaces = []

            # Step 8: Snap boundaries + gate + score
            send_progress(75, "Snapping and scoring clips...")
            all_clips = payoff_clips + monologue_clips + laughter_clips + debate_clips

            snap_settings = settings.get("vad_snapping", {})
            snapped_clips = []
            for clip in all_clips:
                new_start, new_end, snapped, snap_reason = snap_clip_to_segments(
                    clip["startTime"],
                    clip["endTime"],
                    features.get("vad_segments", []),
                    (start_time, end_time),
                    min_duration,
                    max_duration,
                    snap_window_s=snap_settings.get("snap_window_s", 2.0),
                    tail_padding_s=snap_settings.get("tail_padding_s", 0.4),
                )
                clip["startTime"] = round(new_start, 2)
                clip["endTime"] = round(new_end, 2)
                clip["duration"] = round(new_end - new_start, 2)
                if debug:
                    clip.setdefault("debug", {})
                    clip["debug"]["snapApplied"] = snapped
                    clip["debug"]["snapReason"] = snap_reason
                snapped_clips.append(clip)

            scored_clips, debug_stats = apply_clipworthiness(
                snapped_clips, features, settings, mode="podflow", debug=debug
            )
            send_progress(
                78,
                f"Gated {debug_stats['gatedOut']} of {debug_stats['candidates']} candidates",
            )

            scored_clips = merge_overlapping_clips(scored_clips)

            send_progress(80, "Selecting best clips...")
            algorithm_clips = select_final_clips(scored_clips, max_clips=target_count * 2, min_gap=30)

            if detections_cache_path:
                _write_json(
                    detections_cache_path,
                    {
                        "cache_key": algo_cache_key,
                        "clips": algorithm_clips,
                        "deadSpaces": dead_spaces,
                        "debug_stats": debug_stats,
                        "duration": duration,
                    },
                )

        # AI Enhancement (optional)
        transcript = None
        if ai_enabled:
            if cached_transcript is not None:
                send_progress(85, "Cache hit: transcript")
                transcript = cached_transcript
            else:
                try:
                    send_progress(85, "Transcribing audio with Whisper...")
                    from ai.transcription import transcribe_with_whisper
                    transcript = transcribe_with_whisper(audio_path, openai_key)
                    if transcript_cache_path:
                        _write_json(
                            transcript_cache_path,
                            {"cache_key": transcript_cache_key, "transcript": transcript},
                        )
                except Exception as e:
                    send_progress(85, f"Transcription skipped: {e}")

            if cached_ai is not None:
                send_progress(90, "Cache hit: AI enrichment")
                final_clips = cached_ai
            else:
                try:
                    send_progress(90, "Running translator + thinker...")
                    from ai.orchestrator import run_ai_enhancement
                    final_clips = run_ai_enhancement(algorithm_clips, transcript, settings)
                    if ai_cache_path:
                        _write_json(
                            ai_cache_path,
                            {"cache_key": ai_cache_key, "clips": final_clips},
                        )
                except Exception as e:
                    send_progress(90, f"AI enhancement skipped: {e}")
                    final_clips = algorithm_clips
        else:
            send_progress(90, "Skipping AI enhancement...")
            final_clips = algorithm_clips

        # Speaker Diarization (identify who's speaking when)
        speaker_segments = []
        enable_diarization = settings.get("enable_diarization", True)
        num_speakers = settings.get("num_speakers")  # None = auto-detect
        hf_token = settings.get("hf_token") or os.environ.get("HF_TOKEN")
        
        if enable_diarization and need_audio:
            diarization_cache_path = os.path.join(cache_dir, "diarization.json") if cache_dir else None
            cached_diarization = None
            
            if diarization_cache_path:
                diarization_payload = _safe_read_json(diarization_cache_path)
                if diarization_payload and diarization_payload.get("input_hash") == input_hash:
                    cached_diarization = diarization_payload.get("speakers")
            
            if cached_diarization is not None:
                send_progress(92, "Cache hit: speaker diarization")
                speaker_segments = cached_diarization
            else:
                try:
                    send_progress(92, "Running speaker diarization...")
                    from ai.speaker_diarization import run_speaker_diarization
                    
                    diarization_result = run_speaker_diarization(
                        audio_path,
                        method="auto",  # Try pyannote first, fallback to VAD
                        num_speakers=num_speakers,
                        huggingface_token=hf_token,
                        transcript=transcript,
                    )
                    
                    # Convert to serializable format
                    speaker_segments = [
                        {
                            "speakerId": seg.speaker_id,
                            "speakerName": seg.speaker_label,
                            "startTime": round(seg.start_time, 2),
                            "endTime": round(seg.end_time, 2),
                            "confidence": round(seg.confidence, 2),
                        }
                        for seg in diarization_result.segments
                    ]
                    
                    send_progress(93, f"Found {diarization_result.speaker_count} speakers")
                    
                    # Cache diarization results
                    if diarization_cache_path:
                        _write_json(
                            diarization_cache_path,
                            {
                                "input_hash": input_hash,
                                "speakers": speaker_segments,
                                "speaker_count": diarization_result.speaker_count,
                                "speaker_stats": diarization_result.speaker_stats,
                            },
                        )
                except Exception as e:
                    send_progress(93, f"Speaker diarization skipped: {e}")
                    speaker_segments = []

        # Final selection (top N by score or thinker order)
        if not ai_enabled:
            final_clips = sorted(
                final_clips,
                key=lambda c: c.get('finalScore', c.get('algorithmScore', 0)),
                reverse=True,
            )
        final_clips = final_clips[:target_count]

        send_progress(95, f"Complete! Found {len(final_clips)} clips")

        debug_payload = None
        if debug:
            debug_payload = {
                "gating": debug_stats,
                "featureWindowSeconds": settings.get("feature_settings", {}).get("baseline_window_s", 15.0),
            }

        # Send results
        send_result(final_clips, dead_spaces, transcript, speaker_segments, debug=debug_payload)


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

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
import hashlib

CACHE_VERSION = 5  # Bumped to invalidate old caches without silence_mask

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

def should_skip_stage(output_path: str, force: bool = False) -> bool:
    """Check if stage output exists and should be skipped."""
    if force:
        return False
    return os.path.exists(output_path) and os.path.getsize(output_path) > 0

def _safe_read_json(path: str):
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None

def _write_json(path: str, payload: dict, indent: int = None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=True, indent=indent)

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


def transcribe_with_openai_chunked(audio_path: str, openai_key: str, ffmpeg_path: str = None, chunk_duration_s: int = 600) -> dict:
    """
    Transcribe audio using OpenAI Whisper API, chunking large files.
    
    OpenAI has a 25MB file size limit. For larger files, we split into chunks
    and merge the transcripts.
    
    Args:
        audio_path: Path to the audio file
        openai_key: OpenAI API key
        ffmpeg_path: Path to ffmpeg binary
        chunk_duration_s: Duration of each chunk in seconds (default 10 min)
    
    Returns:
        Transcript dict with segments, words, and text
    """
    import subprocess
    import shutil
    
    # Check file size
    file_size = os.path.getsize(audio_path)
    max_size = 24 * 1024 * 1024  # 24MB to be safe (limit is 25MB)
    
    if file_size <= max_size:
        # File is small enough, transcribe directly
        return _transcribe_single_file(audio_path, openai_key)
    
    send_progress(22, f"Large file ({file_size / 1024 / 1024:.1f}MB) - splitting into chunks...")
    
    # Get audio duration
    import librosa
    y, sr = librosa.load(audio_path, sr=None, mono=True)
    total_duration = len(y) / sr
    
    # Calculate number of chunks
    num_chunks = int(total_duration / chunk_duration_s) + 1
    send_progress(22, f"Transcribing in {num_chunks} chunks...")
    
    # Find ffmpeg
    ffmpeg_cmd = ffmpeg_path or shutil.which('ffmpeg') or 'ffmpeg'
    
    # Create temp directory for chunks
    chunk_dir = os.path.join(os.path.dirname(audio_path), "audio_chunks")
    os.makedirs(chunk_dir, exist_ok=True)
    
    all_segments = []
    full_text_parts = []
    
    try:
        for i in range(num_chunks):
            start_time = i * chunk_duration_s
            chunk_path = os.path.join(chunk_dir, f"chunk_{i:03d}.wav")
            
            # Extract chunk using ffmpeg
            cmd = [
                ffmpeg_cmd, '-y',
                '-ss', str(start_time),
                '-i', audio_path,
                '-t', str(chunk_duration_s),
                '-acodec', 'pcm_s16le',
                '-ar', '16000',  # OpenAI prefers 16kHz
                '-ac', '1',
                chunk_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            if result.returncode != 0:
                send_progress(22, f"Warning: Failed to extract chunk {i+1}")
                continue
            
            # Check chunk size
            chunk_size = os.path.getsize(chunk_path)
            if chunk_size < 1000:  # Skip tiny chunks (end of file)
                continue
            
            send_progress(22, f"Transcribing chunk {i+1}/{num_chunks}...")
            
            try:
                chunk_transcript = _transcribe_single_file(chunk_path, openai_key)
                
                # Adjust segment times by adding the chunk offset
                for seg in chunk_transcript.get("segments", []):
                    seg["start"] = seg["start"] + start_time
                    seg["end"] = seg["end"] + start_time
                    all_segments.append(seg)
                
                if chunk_transcript.get("text"):
                    full_text_parts.append(chunk_transcript["text"])
                    
            except Exception as e:
                send_progress(22, f"Warning: Chunk {i+1} transcription failed: {e}")
                continue
        
        # Clean up chunks
        shutil.rmtree(chunk_dir, ignore_errors=True)
        
        # Sort segments by start time
        all_segments.sort(key=lambda s: s["start"])
        
        return {
            "segments": all_segments,
            "words": [],
            "text": " ".join(full_text_parts)
        }
        
    except Exception as e:
        shutil.rmtree(chunk_dir, ignore_errors=True)
        raise e


def _transcribe_single_file(audio_path: str, openai_key: str) -> dict:
    """Transcribe a single audio file using OpenAI Whisper API."""
    import openai
    
    client = openai.OpenAI(api_key=openai_key)
    
    with open(audio_path, "rb") as audio_file:
        response = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="verbose_json",
            timestamp_granularities=["segment"]
        )
    
    segments = []
    for seg in getattr(response, 'segments', []):
        segments.append({
            "start": seg.get('start', 0) if isinstance(seg, dict) else getattr(seg, 'start', 0),
            "end": seg.get('end', 0) if isinstance(seg, dict) else getattr(seg, 'end', 0),
            "text": seg.get('text', '') if isinstance(seg, dict) else getattr(seg, 'text', '')
        })
    
    return {
        "segments": segments,
        "words": [],
        "text": getattr(response, 'text', '')
    }


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


def detect_dead_spaces(features: dict, min_silence_s: float = 2.0) -> list:
    """
    Detect dead spaces (extended silence) in the audio.
    
    Dead spaces are periods of silence longer than min_silence_s.
    These are good candidates for removal in auto-editing.
    
    Args:
        features: Feature dict with 'times', 'silence_mask' or 'rms_db'
        min_silence_s: Minimum silence duration to count as "dead space"
    
    Returns:
        List of dead space dicts with id, startTime, endTime, duration, remove
    """
    import numpy as np
    
    times = np.array(features.get("times", []))
    silence_mask = np.array(features.get("silence_mask", []))
    
    if len(times) == 0 or len(silence_mask) == 0:
        return []
    
    hop_s = features.get("frame_duration", 0.1)
    min_frames = int(min_silence_s / hop_s)
    
    dead_spaces = []
    in_silence = False
    silence_start = 0
    silence_frames = 0
    dead_id = 0
    
    for i, (t, is_silent) in enumerate(zip(times, silence_mask)):
        if is_silent:
            if not in_silence:
                in_silence = True
                silence_start = t
                silence_frames = 1
            else:
                silence_frames += 1
        else:
            if in_silence and silence_frames >= min_frames:
                # End of significant silence
                dead_id += 1
                dead_spaces.append({
                    "id": f"dead_{dead_id:03d}",
                    "startTime": float(silence_start),
                    "endTime": float(times[i-1] if i > 0 else t),
                    "duration": float(silence_frames * hop_s),
                    "remove": True,
                    "type": "silence",
                })
            in_silence = False
            silence_frames = 0
    
    # Handle silence at end of audio
    if in_silence and silence_frames >= min_frames:
        dead_id += 1
        dead_spaces.append({
            "id": f"dead_{dead_id:03d}",
            "startTime": float(silence_start),
            "endTime": float(times[-1]),
            "duration": float(silence_frames * hop_s),
            "remove": True,
            "type": "silence",
        })
    
    return dead_spaces


def run_mvp_pipeline(video_path: str, settings: dict):
    """
    MVP Detection Pipeline with deterministic scoring and stage resume.
    
    Stages:
    A) Extract audio -> audio.wav
    B) Transcribe -> transcript.json
    C) Compute features -> features.json
    D) Detect candidates -> candidates.json
    E) Score + de-dupe -> clips.json
    F) Export clips (handled by Electron)
    G) Caption burn (handled by Electron)
    """
    try:
        import numpy as np
        import librosa
        
        from features import extract_features, features_to_json, features_from_json
        from utils.mvp_candidates import detect_all_candidates, candidates_to_json, candidates_from_json
        from utils.mvp_scoring import score_and_select_clips
    except ImportError as e:
        send_error(f"Failed to import required modules: {e}. Please install dependencies: pip install -r requirements.txt")
        sys.exit(1)
    
    # Settings
    job_dir = settings.get("job_dir") or settings.get("cache_dir")
    force = settings.get("force_rerun", False)
    openai_key = settings.get("openai_api_key", "")
    ffmpeg_path = settings.get("ffmpeg_path")
    top_n = settings.get("target_count", 10)
    
    # Get initial duration estimate for adaptive settings
    # Will be refined after audio extraction
    video_duration_hint = settings.get("video_duration", 0)
    
    # Requested settings (may be adapted for short videos)
    requested_skip_intro = settings.get("skip_intro", 30)
    requested_skip_outro = settings.get("skip_outro", 30)
    requested_min_duration = settings.get("min_duration", 45)
    requested_max_duration = settings.get("max_duration", 150)
    
    # For short videos, use adaptive settings
    # Will be finalized after we know actual duration
    skip_intro = requested_skip_intro
    skip_outro = requested_skip_outro
    min_duration = requested_min_duration
    max_duration = requested_max_duration
    
    if not job_dir:
        send_error("MVP mode requires job_dir or cache_dir")
        sys.exit(1)
    
    os.makedirs(job_dir, exist_ok=True)
    
    # Output paths (clips_path will be set after adaptive settings)
    audio_path = os.path.join(job_dir, "audio.wav")
    features_path = os.path.join(job_dir, "features.json")
    transcript_path = os.path.join(job_dir, "transcript.json")
    candidates_path = os.path.join(job_dir, "candidates.json")
    # clips_path will be set after adaptive settings are computed
    
    # Stage A: Extract audio (UI: "Preparing your video")
    if not should_skip_stage(audio_path, force):
        send_progress(5, "Preparing your video...")
        try:
            extract_audio_ffmpeg(video_path, audio_path, ffmpeg_path)
        except Exception as e:
            send_error(f"Failed to extract audio: {e}")
            sys.exit(1)
    else:
        send_progress(5, "Preparing your video...")
    
    # Stage B: Transcribe
    transcript = None
    # Stage B: Transcribe (or load uploaded transcript)
    transcript = None
    if not should_skip_stage(transcript_path, force):
        send_progress(20, "Listening to the conversation...")
        # First check if transcript already exists (uploaded by user)
        existing_transcript = _safe_read_json(transcript_path)
        if existing_transcript and existing_transcript.get("segments"):
            send_progress(20, "Listening to the conversation...")
            transcript = existing_transcript
            _write_json(transcript_path, transcript, indent=2)
        else:
            # Only try to transcribe if no transcript was uploaded
            send_progress(20, "Listening to the conversation...")
            transcript = None
            
            # Try faster-whisper (local) first
            try:
                from faster_whisper import WhisperModel
                send_progress(22, "Transcribing locally...")
                # Use base model for good quality/speed balance
                model = WhisperModel("base", device="auto", compute_type="auto")
                segments_list, _ = model.transcribe(audio_path, language="en", vad_filter=True)
                
                # Convert to standard format
                segments = []
                for seg in segments_list:
                    segments.append({
                        "start": seg.start,
                        "end": seg.end,
                        "text": seg.text
                    })
                
                transcript = {
                    "segments": segments,
                    "words": [],
                    "text": " ".join([s["text"] for s in segments])
                }
            except ImportError:
                # faster-whisper not available, try OpenAI API if key is available
                if openai_key:
                    try:
                        send_progress(22, "Transcribing via OpenAI...")
                        transcript = transcribe_with_openai_chunked(audio_path, openai_key, ffmpeg_path)
                    except Exception as e:
                        send_progress(23, f"OpenAI transcription failed: {e}")
                        transcript = {"segments": [], "words": [], "text": ""}
                else:
                    send_progress(23, "No transcription available (install faster-whisper or provide OpenAI key)")
                    transcript = {"segments": [], "words": [], "text": ""}
            except Exception as e:
                send_progress(20, f"Transcription error: {e}, continuing without...")
                transcript = {"segments": [], "words": [], "text": ""}
            
            _write_json(transcript_path, transcript, indent=2)
    else:
        send_progress(20, "Listening to the conversation...")
        transcript = _safe_read_json(transcript_path) or {"segments": [], "words": [], "text": ""}
    
    # Stage C: Compute features
    features = None
    duration = 0
    if not should_skip_stage(features_path, force):
        send_progress(35, "Understanding the story...")
        try:
            y, sr = librosa.load(audio_path, sr=22050)
            y = normalize_audio(y, sr)
            duration = librosa.get_duration(y=y, sr=sr)
            
            # Extract features with MVP settings
            feature_settings = {
                "mvp_mode": True,
                "hop_s": settings.get("hop_s", 0.10),
                "rms_window_s": settings.get("rms_window_s", 0.40),
                "baseline_window_s": settings.get("baseline_window_s", 20.0),
                "silence_threshold_db": settings.get("silence_threshold_db", -35),
            }
            features = extract_features(y, sr, settings=feature_settings, transcript=transcript)
            features["duration"] = duration
            
            # Save to JSON
            features_json = features_to_json(features)
            _write_json(features_path, features_json, indent=2)
            
        except Exception as e:
            send_error(f"Failed to compute features: {e}")
            sys.exit(1)
    else:
        send_progress(35, "Understanding the story...")
        features_json = _safe_read_json(features_path)
        if features_json:
            features = features_from_json(features_json)
            duration = features.get("duration", 0)
        else:
            send_error("Failed to load cached features")
            sys.exit(1)
    
    # ========================================
    # ADAPTIVE SETTINGS FOR SHORT VIDEOS
    # ========================================
    # Now that we know actual duration, adapt settings for short videos
    if duration > 0:
        # For very short videos (< 60s), use much more lenient settings
        if duration < 60:
            # Minimum clip is 5s or 30% of video
            min_duration = max(5, duration * 0.3)
            # Max clip is the full video minus a bit
            max_duration = max(min_duration + 5, duration * 0.95)
            # No skip intro/outro for short videos
            skip_intro = 0
            skip_outro = 0
            send_progress(36, f"Short video ({duration:.0f}s): adapting settings...")
        elif duration < 180:
            # For medium videos (1-3 min), reduce settings proportionally
            min_duration = max(8, min(requested_min_duration, duration * 0.3))
            max_duration = max(min_duration + 10, min(requested_max_duration, duration * 0.9))
            skip_intro = min(requested_skip_intro, duration * 0.1)
            skip_outro = min(requested_skip_outro, duration * 0.1)
        # For longer videos, keep the requested settings
    
    # Now compute clips_path with final (adapted) settings
    scoring_key = hashlib.sha256(json.dumps({
        "min_duration": min_duration,
        "max_duration": max_duration,
        "top_n": top_n,
        "version": CACHE_VERSION,
    }, sort_keys=True).encode()).hexdigest()[:8]
    clips_path = os.path.join(job_dir, f"clips_{scoring_key}.json")
    
    # Clean up old clips files with different settings
    for old_file in os.listdir(job_dir):
        if old_file.startswith("clips_") and old_file.endswith(".json") and old_file != f"clips_{scoring_key}.json":
            try:
                os.remove(os.path.join(job_dir, old_file))
            except:
                pass
    
    # Define analysis bounds
    start_time = skip_intro
    end_time = max(start_time + 10, duration - skip_outro)
    
    bounds = {
        "start_time": start_time,
        "end_time": end_time,
        "min_duration": min_duration,
        "max_duration": max_duration,
    }
    
    # Stage D: Detect candidates
    candidates = []
    if not should_skip_stage(candidates_path, force):
        send_progress(50, "Finding strong moments...")
        try:
            detection_settings = {
                "hop_s": settings.get("hop_s", 0.10),
                "spike_threshold_db": settings.get("spike_threshold_db", 8.0),
                "spike_sustain_s": settings.get("spike_sustain_s", 0.7),
                "silence_threshold_db": settings.get("silence_threshold_db", -35),
                "silence_run_s": settings.get("silence_run_s", 1.2),
                "contrast_window_s": settings.get("contrast_window_s", 2.0),
                "laughter_z_rms": settings.get("laughter_z_rms", 1.5),
                "laughter_gap_s": settings.get("laughter_gap_s", 0.3),
                "laughter_min_s": settings.get("laughter_min_s", 1.0),
            }
            candidates = detect_all_candidates(features, bounds, detection_settings)
            
            send_progress(60, "Finding strong moments...")
            
            candidates_json = candidates_to_json(candidates)
            _write_json(candidates_path, candidates_json, indent=2)
            
        except Exception as e:
            send_error(f"Failed to detect candidates: {e}")
            sys.exit(1)
    else:
        send_progress(50, "Finding strong moments...")
        candidates_json = _safe_read_json(candidates_path)
        if candidates_json:
            candidates = candidates_from_json(candidates_json)
        else:
            send_error("Failed to load cached candidates")
            sys.exit(1)
    
    # Stage E: Score and select clips
    clips = []
    if not should_skip_stage(clips_path, force):
        send_progress(70, "Building story clips...")
        try:
            # Adaptive clip lengths based on video duration
            if duration < 60:
                # For short videos: try very small clips
                adaptive_clip_lengths = [5, 8, 10, 15, 20, int(duration * 0.8)]
            elif duration < 180:
                adaptive_clip_lengths = [15, 20, 30, 45, min(60, int(duration * 0.7))]
            else:
                adaptive_clip_lengths = settings.get("clip_lengths", [30, 45, 60, 90, 120])
            
            scoring_settings = {
                "clip_lengths": adaptive_clip_lengths,
                "min_clip_s": min_duration,
                "max_clip_s": max_duration,
                "snap_window_s": settings.get("snap_window_s", 2.0),
                "start_padding_s": settings.get("start_padding_s", 0.6),
                "end_padding_s": settings.get("end_padding_s", 0.8),
                "iou_threshold": settings.get("iou_threshold", 0.6),
                "top_n": top_n,
            }
            features["duration"] = duration
            clips = score_and_select_clips(candidates, features, transcript, scoring_settings)

            # Fallback: if no clips were selected, take top candidates directly
            if len(clips) == 0 and candidates:
                send_progress(80, "Building story clips...")
                fallback = candidates[: top_n or 10]
                clips = []
                for i, cand in enumerate(fallback):
                    start = cand.get("start") or cand.get("start_time") or 0
                    end = cand.get("end") or cand.get("end_time") or start + 15  # default 15s duration
                    clips.append({
                        "id": f"fallback_{i+1:03d}",
                        "startTime": float(start),
                        "endTime": float(end),
                        "duration": max(0, end - start),
                        "pattern": cand.get("pattern", "fallback"),
                        "patternLabel": cand.get("patternLabel", f"Moment {i+1}"),
                        "description": cand.get("description", ""),
                        "score": cand.get("score", 0),
                        "score_breakdown": cand.get("score_breakdown", {}),
                    })
            
            # Ultimate fallback: if still no clips AND no candidates, create a single clip from the whole video
            if len(clips) == 0 and len(candidates) == 0 and duration > 0:
                send_progress(80, "No patterns found - creating full clip...")
                clips = [{
                    "id": "full_001",
                    "startTime": 0.0,
                    "endTime": float(duration),
                    "duration": float(duration),
                    "pattern": "full_video",
                    "patternLabel": "Full Video",
                    "description": "No clip-worthy moments detected - full video included for review",
                    "score": 50,
                    "score_breakdown": {"note": "fallback_full_video"},
                }]

            send_progress(85, "Finalizing results...")
            
            # Save clips.json with params
            clips_output = {
                "clips": clips,
                "params": {
                    "top_n": top_n,
                    "min_duration": min_duration,
                    "max_duration": max_duration,
                    "clip_lengths_tried": scoring_settings["clip_lengths"],
                    "iou_threshold": scoring_settings["iou_threshold"],
                }
            }
            _write_json(clips_path, clips_output, indent=2)
            
        except Exception as e:
            send_error(f"Failed to score clips: {e}")
            sys.exit(1)
    else:
        send_progress(70, "Building story clips...")
        clips_output = _safe_read_json(clips_path)
        if clips_output and "clips" in clips_output:
            clips = clips_output["clips"]
            send_progress(85, "Finalizing results...")
        else:
            send_error("Failed to load cached clips")
            sys.exit(1)
    
    # The clips from score_and_select_clips are already in the right format
    # Just add any missing fields for UI compatibility
    formatted_clips = []
    for i, clip in enumerate(clips):
        # Extract mood from score_breakdown
        mood = clip.get("score_breakdown", {}).get("mood", "impactful")
        
        formatted_clip = {
            "id": clip.get("id", f"clip_{i+1:03d}"),
            "startTime": clip.get("startTime", clip.get("start", 0)),
            "endTime": clip.get("endTime", clip.get("end", 0)),
            "duration": clip.get("duration", 0),
            "pattern": clip.get("pattern", "payoff"),
            "patternLabel": clip.get("patternLabel", f"Clip @ {_format_timestamp(clip.get('startTime', 0))}"),
            "description": clip.get("description", ""),
            "algorithmScore": clip.get("algorithmScore", clip.get("score", 0)),
            "finalScore": clip.get("finalScore", clip.get("score", 0)),
            "hookStrength": clip.get("hookStrength", 50),
            "hookMultiplier": clip.get("hookMultiplier", 1.0),
            "trimStartOffset": clip.get("trimStartOffset", 0),
            "trimEndOffset": clip.get("trimEndOffset", 0),
            "status": clip.get("status", "pending"),
            "title": clip.get("title") or f"Clip {i+1}",
            "mood": mood,  # Add mood field
            # MVP-specific fields
            "score_breakdown": clip.get("score_breakdown"),
            "source_candidate": clip.get("source_candidate"),
            "snapped": clip.get("snapped", False),
            "snap_reason": clip.get("snap_reason", ""),
        }
        formatted_clips.append(formatted_clip)
    
    # ============================================================
    # Stage F: Story Quality Gates (NEW - narrative-first filtering)
    # ============================================================
    send_progress(87, "Stage F: Applying story quality gates...")
    
    try:
        from story_gate import apply_story_gates
        
        survivors, dropped, gate_stats = apply_story_gates(formatted_clips, transcript)
        
        send_progress(90, f"Story gates: {gate_stats['survived']}/{gate_stats['total']} clips passed")
        
        # Use survivors as final clips
        final_clips = survivors
        
        # If all clips were dropped, include some dropped ones with warnings
        if len(final_clips) == 0 and len(dropped) > 0:
            send_progress(91, "All clips dropped by story gates - including top dropped with warnings")
            # Sort by whatever confidence we have and take top 3
            dropped_sorted = sorted(dropped, key=lambda c: c.get("story_gate", {}).get("confidence", 0), reverse=True)
            for clip in dropped_sorted[:3]:
                clip["status"] = "needs_review"
                clip["storyWarning"] = "Clip may not tell a complete story"
                final_clips.append(clip)
        
    except ImportError as e:
        send_progress(88, f"Story gates not available: {e} - using all clips")
        final_clips = formatted_clips
    except Exception as e:
        send_progress(88, f"Story gate error: {e} - using all clips")
        final_clips = formatted_clips
    
    # ============================================================
    # Stage G: Detect Dead Spaces (for auto-edit mode)
    # ============================================================
    send_progress(92, "Finding dead air to remove...")
    
    # Debug: check if silence_mask is present
    has_times = "times" in features and len(features["times"]) > 0
    has_silence = "silence_mask" in features and len(features.get("silence_mask", [])) > 0
    send_progress(92, f"Features: times={has_times}, silence_mask={has_silence}")
    
    dead_spaces = detect_dead_spaces(features, min_silence_s=2.0)
    send_progress(93, f"Found {len(dead_spaces)} dead spaces to remove")
    
    # Calculate time saved
    total_dead_time = sum(d.get("duration", 0) for d in dead_spaces)
    send_progress(95, f"Complete! Removing {total_dead_time:.1f}s of dead air")
    
    # Send results
    debug_payload = {
        "mvp_mode": True,
        "job_dir": job_dir,
        "candidates_count": len(candidates),
        "clips_before_gates": len(formatted_clips),
        "clips_count": len(final_clips),
        "dead_spaces_count": len(dead_spaces),
        "dead_time_seconds": total_dead_time,
        "story_gates_applied": True,
    }
    send_result(final_clips, dead_spaces, transcript, [], debug=debug_payload)


def _format_timestamp(seconds: float) -> str:
    """Format seconds as HH:MM:SS or MM:SS"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def main(video_path: str, settings: dict):
    """Main detection pipeline"""
    
    # Check for MVP mode
    mvp_mode = settings.get("mvp_mode", False)
    if mvp_mode:
        return run_mvp_pipeline(video_path, settings)
    
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

        send_progress(96, f"Complete! Found {len(final_clips)} clips")

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

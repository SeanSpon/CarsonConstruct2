"""
Whisper API Transcription

Uses OpenAI Whisper API for transcription with word-level timestamps.
Cost: ~$0.006/minute = ~$0.36/hour
"""

import os
import shutil
import subprocess
import tempfile
from typing import Callable, Dict, List, Optional, Tuple

def _ffprobe_duration_seconds(path: str, ffprobe_bin: str) -> Optional[float]:
    try:
        proc = subprocess.run(
            [
                ffprobe_bin,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                path,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True,
        )
        raw = (proc.stdout or "").strip()
        return float(raw) if raw else None
    except Exception:
        return None


def _extract_whisper_response(transcript) -> Dict:
    result = {
        "text": transcript.text if hasattr(transcript, "text") else "",
        "words": [],
        "segments": [],
    }

    if hasattr(transcript, "words") and transcript.words:
        result["words"] = [
            {
                "word": w.word if hasattr(w, "word") else w.get("word", ""),
                "start": w.start if hasattr(w, "start") else w.get("start", 0),
                "end": w.end if hasattr(w, "end") else w.get("end", 0),
            }
            for w in transcript.words
        ]

    if hasattr(transcript, "segments") and transcript.segments:
        result["segments"] = [
            {
                "text": s.text if hasattr(s, "text") else s.get("text", ""),
                "start": s.start if hasattr(s, "start") else s.get("start", 0),
                "end": s.end if hasattr(s, "end") else s.get("end", 0),
            }
            for s in transcript.segments
        ]

    return result


def _offset_timestamps(transcript: Dict, offset_s: float) -> Dict:
    if offset_s <= 0:
        return transcript

    out = {
        "text": transcript.get("text", ""),
        "words": [],
        "segments": [],
    }
    for w in transcript.get("words", []) or []:
        out["words"].append(
            {
                **w,
                "start": (w.get("start", 0) or 0) + offset_s,
                "end": (w.get("end", 0) or 0) + offset_s,
            }
        )
    for s in transcript.get("segments", []) or []:
        out["segments"].append(
            {
                **s,
                "start": (s.get("start", 0) or 0) + offset_s,
                "end": (s.get("end", 0) or 0) + offset_s,
            }
        )
    return out


def _merge_chunk_results(chunks: List[Dict]) -> Dict:
    merged_words: List[Dict] = []
    merged_segments: List[Dict] = []
    texts: List[str] = []

    for c in chunks:
        text = (c.get("text") or "").strip()
        if text:
            texts.append(text)
        merged_words.extend(c.get("words", []) or [])
        merged_segments.extend(c.get("segments", []) or [])

    return {
        "text": " ".join(texts).strip(),
        "words": merged_words,
        "segments": merged_segments,
    }


def _split_audio_for_whisper(
    audio_path: str,
    ffmpeg_bin: str,
    chunk_seconds: int,
    out_dir: str,
) -> List[str]:
    os.makedirs(out_dir, exist_ok=True)

    # Re-encode during splitting to ensure valid, small MP3 chunks.
    out_pattern = os.path.join(out_dir, "chunk_%05d.mp3")
    subprocess.run(
        [
            ffmpeg_bin,
            "-y",
            "-i",
            audio_path,
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-b:a",
            "32k",
            "-f",
            "segment",
            "-segment_time",
            str(int(chunk_seconds)),
            "-reset_timestamps",
            "1",
            out_pattern,
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=True,
    )

    chunk_files = [os.path.join(out_dir, f) for f in os.listdir(out_dir) if f.lower().endswith(".mp3")]
    chunk_files.sort()
    return chunk_files


def transcribe_with_whisper(
    audio_path: str,
    api_key: str,
    *,
    ffmpeg_path: Optional[str] = None,
    chunk_seconds: int = 20 * 60,
    max_bytes: int = 25 * 1024 * 1024,
    progress_callback: Optional[Callable[[int, int, str], None]] = None,
) -> Dict:
    """
    Transcribe audio using OpenAI Whisper API.
    
    Args:
        audio_path: Path to audio file (WAV, MP3, etc.)
        api_key: OpenAI API key
    
    Returns:
        Dictionary with text, words (with timestamps), and segments
    """
    try:
        from openai import OpenAI
    except ImportError:
        raise ImportError("openai package not installed. Run: pip install openai")
    
    client = OpenAI(api_key=api_key)
    
    try:
        file_size = os.path.getsize(audio_path)
    except Exception:
        file_size = 0

    def _transcribe_one(path: str) -> Tuple[Optional[Dict], Optional[str]]:
        with open(path, "rb") as audio_file:
            try:
                transcript = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="verbose_json",
                    timestamp_granularities=["word", "segment"],
                )
                return _extract_whisper_response(transcript), None
            except Exception as e:
                return None, str(e)

    def _progress(current: int, total: int, message: str) -> None:
        if progress_callback:
            try:
                progress_callback(int(current), int(total), str(message))
            except Exception:
                pass

    # Small enough: single request.
    if file_size and file_size <= max_bytes:
        _progress(1, 1, "Whisper API: uploading audio")
        one, err = _transcribe_one(audio_path)
        if err:
            return {"text": "", "words": [], "segments": [], "error": err}
        _progress(1, 1, "Whisper API: transcription complete")
        return one or {"text": "", "words": [], "segments": []}

    # Too large: split into chunks and stitch timestamps.
    ffmpeg_bin = ffmpeg_path or shutil.which("ffmpeg") or "ffmpeg"

    if ffmpeg_path:
        ffmpeg_dir = os.path.dirname(ffmpeg_bin) or "."
        ffmpeg_ext = os.path.splitext(ffmpeg_bin)[1]
        sibling_ffprobe = os.path.join(ffmpeg_dir, f"ffprobe{ffmpeg_ext}")
        ffprobe_bin = sibling_ffprobe if os.path.exists(sibling_ffprobe) else "ffprobe"
    else:
        ffprobe_bin = shutil.which("ffprobe") or "ffprobe"

    tmp_dir = tempfile.mkdtemp(prefix="whisper_chunks_")
    try:
        _progress(0, 1, f"Whisper API: splitting audio into ~{int(chunk_seconds)//60} min chunks")
        chunk_files = _split_audio_for_whisper(audio_path, ffmpeg_bin, chunk_seconds, tmp_dir)
        if not chunk_files:
            return {
                "text": "",
                "words": [],
                "segments": [],
                "error": "Failed to split audio for Whisper (no chunks produced)",
            }

        total = len(chunk_files)
        _progress(0, total, f"Whisper API: {total} chunks ready")

        stitched: List[Dict] = []
        offset_s = 0.0
        for idx, chunk_path in enumerate(chunk_files, start=1):
            _progress(idx, total, f"Whisper API: transcribing chunk {idx}/{total}")
            one, err = _transcribe_one(chunk_path)
            if err:
                return {"text": "", "words": [], "segments": [], "error": err}

            stitched.append(_offset_timestamps(one or {"text": "", "words": [], "segments": []}, offset_s))

            dur = _ffprobe_duration_seconds(chunk_path, ffprobe_bin)
            if dur is None:
                dur = float(chunk_seconds)
            offset_s += float(dur)

        _progress(total, total, "Whisper API: transcription complete")

        return _merge_chunk_results(stitched)
    except Exception as e:
        return {"text": "", "words": [], "segments": [], "error": str(e)}
    finally:
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass


def get_transcript_for_clip(transcript: Dict, start_time: float, end_time: float) -> str:
    """
    Extract transcript text for a specific time range.
    
    Args:
        transcript: Full transcript with words
        start_time: Clip start in seconds
        end_time: Clip end in seconds
    
    Returns:
        Transcript text for the time range
    """
    if not transcript or not transcript.get('words'):
        # Try to use segments instead
        if transcript and transcript.get('segments'):
            matching_segments = [
                s['text'] for s in transcript['segments']
                if s['start'] >= start_time - 1 and s['end'] <= end_time + 1
            ]
            return ' '.join(matching_segments).strip()
        return ''
    
    # Filter words within time range (with small buffer)
    matching_words = [
        w['word'] for w in transcript['words']
        if start_time - 0.5 <= w['start'] <= end_time + 0.5
    ]
    
    return ' '.join(matching_words).strip()

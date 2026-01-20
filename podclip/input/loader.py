"""
Video/Audio Loader

Handles:
- Loading video files
- Extracting audio with FFmpeg
- Validating file format and duration
"""

import os
import subprocess
import shutil
import json
from dataclasses import dataclass
from typing import Optional, Tuple


@dataclass
class VideoInfo:
    """Information about the input video."""
    path: str
    duration: float  # seconds
    width: int
    height: int
    fps: float
    audio_path: Optional[str] = None


def find_ffmpeg() -> str:
    """
    Find FFmpeg binary. Tries:
    1. System PATH
    2. Common install locations
    
    Returns path to ffmpeg binary or raises FileNotFoundError.
    """
    # Try system PATH
    ffmpeg = shutil.which('ffmpeg')
    if ffmpeg:
        return ffmpeg
    
    # Common locations (Windows)
    common_paths = [
        r'C:\ffmpeg\bin\ffmpeg.exe',
        r'C:\Program Files\ffmpeg\bin\ffmpeg.exe',
        os.path.expanduser(r'~\ffmpeg\bin\ffmpeg.exe'),
    ]
    
    for path in common_paths:
        if os.path.isfile(path):
            return path
    
    raise FileNotFoundError(
        "FFmpeg not found. Please install FFmpeg and add it to PATH.\n"
        "  Windows: winget install FFmpeg\n"
        "  Mac: brew install ffmpeg\n"
        "  Linux: apt install ffmpeg"
    )


def find_ffprobe() -> str:
    """Find FFprobe binary."""
    # Try system PATH
    ffprobe = shutil.which('ffprobe')
    if ffprobe:
        return ffprobe
    
    # Try same directory as ffmpeg
    ffmpeg = find_ffmpeg()
    ffprobe = os.path.join(os.path.dirname(ffmpeg), 'ffprobe')
    if os.path.isfile(ffprobe):
        return ffprobe
    ffprobe = ffprobe + '.exe'
    if os.path.isfile(ffprobe):
        return ffprobe
    
    raise FileNotFoundError("FFprobe not found.")


def validate_video(video_path: str, min_duration: float = 30.0) -> Tuple[bool, str]:
    """
    Validate that the file is a valid video with sufficient duration.
    
    Args:
        video_path: Path to video file
        min_duration: Minimum duration in seconds
        
    Returns:
        (is_valid, error_message)
    """
    if not os.path.isfile(video_path):
        return False, f"File not found: {video_path}"
    
    try:
        info = get_video_info(video_path)
        
        if info.duration < min_duration:
            return False, f"Video too short: {info.duration:.1f}s (minimum: {min_duration}s)"
        
        if info.width == 0 or info.height == 0:
            return False, "Invalid video dimensions"
        
        return True, ""
        
    except Exception as e:
        return False, f"Failed to read video: {e}"


def get_video_info(video_path: str) -> VideoInfo:
    """
    Get video metadata using FFprobe.
    
    Args:
        video_path: Path to video file
        
    Returns:
        VideoInfo dataclass with video metadata
    """
    ffprobe = find_ffprobe()
    
    cmd = [
        ffprobe,
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        video_path
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        raise RuntimeError(f"FFprobe failed: {result.stderr}")
    
    data = json.loads(result.stdout)
    
    # Get duration from format
    duration = float(data.get('format', {}).get('duration', 0))
    
    # Find video stream
    width = 0
    height = 0
    fps = 0.0
    
    for stream in data.get('streams', []):
        if stream.get('codec_type') == 'video':
            width = stream.get('width', 0)
            height = stream.get('height', 0)
            
            # Parse frame rate (can be "30/1" or "29.97")
            fps_str = stream.get('r_frame_rate', '30/1')
            if '/' in fps_str:
                num, den = fps_str.split('/')
                fps = float(num) / float(den) if float(den) > 0 else 30.0
            else:
                fps = float(fps_str)
            break
    
    return VideoInfo(
        path=video_path,
        duration=duration,
        width=width,
        height=height,
        fps=fps
    )


def load_video(video_path: str) -> VideoInfo:
    """
    Load video file and return metadata.
    Validates the file exists and is readable.
    
    Args:
        video_path: Path to video file
        
    Returns:
        VideoInfo with metadata
    """
    valid, error = validate_video(video_path, min_duration=0)
    if not valid:
        raise ValueError(error)
    
    return get_video_info(video_path)


def extract_audio(
    video_path: str,
    output_path: str,
    sample_rate: int = 16000,
    mono: bool = True
) -> str:
    """
    Extract audio from video using FFmpeg.
    
    Output format: WAV (PCM 16-bit) for maximum compatibility with speech recognition.
    
    Args:
        video_path: Input video path
        output_path: Output audio path (should end in .wav)
        sample_rate: Sample rate in Hz (default 16000 for Whisper)
        mono: Convert to mono (default True)
        
    Returns:
        Path to extracted audio file
    """
    ffmpeg = find_ffmpeg()
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
    
    cmd = [
        ffmpeg,
        '-y',  # Overwrite output
        '-i', video_path,
        '-vn',  # No video
        '-acodec', 'pcm_s16le',  # 16-bit PCM
        '-ar', str(sample_rate),  # Sample rate
    ]
    
    if mono:
        cmd.extend(['-ac', '1'])  # Mono
    
    cmd.append(output_path)
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        raise RuntimeError(f"Audio extraction failed: {result.stderr}")
    
    if not os.path.isfile(output_path):
        raise RuntimeError("Audio extraction produced no output")
    
    return output_path

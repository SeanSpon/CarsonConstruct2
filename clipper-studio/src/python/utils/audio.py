"""
Audio utility functions for Clipper Studio
"""

import subprocess
import numpy as np
from typing import List


def extract_audio(video_path: str, audio_path: str):
    """
    Extract audio from video file using FFmpeg.
    
    Args:
        video_path: Path to input video file
        audio_path: Path to output audio file (WAV)
    """
    cmd = [
        "ffmpeg",
        "-i", video_path,
        "-vn",              # No video
        "-acodec", "pcm_s16le",  # PCM format for librosa
        "-ar", "22050",     # Sample rate (librosa default)
        "-ac", "1",         # Mono
        "-y",               # Overwrite output
        audio_path
    ]
    
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg failed: {result.stderr}")


def generate_waveform(y: np.ndarray, num_points: int = 1000) -> List[float]:
    """
    Downsample audio to N points for visualization.
    
    Args:
        y: Audio time series
        num_points: Number of points in output waveform
    
    Returns:
        List of normalized amplitude values (0-1)
    """
    if len(y) == 0:
        return [0.0] * num_points
    
    chunk_size = max(1, len(y) // num_points)
    waveform = []
    
    for i in range(num_points):
        start = i * chunk_size
        end = min(start + chunk_size, len(y))
        if start < len(y):
            chunk = y[start:end]
            # Use RMS for smoother visualization
            waveform.append(float(np.sqrt(np.mean(chunk ** 2))))
        else:
            waveform.append(0.0)
    
    # Normalize to 0-1 range
    max_val = max(waveform) if waveform else 1.0
    if max_val > 0:
        waveform = [v / max_val for v in waveform]
    
    return waveform

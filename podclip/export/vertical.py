"""
Vertical Video Export

Exports clips as vertical (9:16) videos with:
- Center crop from horizontal source
- Burned-in captions (optional)
- High-quality H.264 encoding

Uses FFmpeg exclusively.
"""

import os
import subprocess
from dataclasses import dataclass
from typing import List, Optional, Callable

from ..input.loader import find_ffmpeg


@dataclass
class ExportSettings:
    """Export configuration."""
    # Output dimensions (9:16 vertical)
    width: int = 1080
    height: int = 1920
    
    # Encoding settings
    codec: str = "libx264"
    preset: str = "fast"
    crf: int = 23  # Quality (lower = better, 18-28 typical)
    
    # Audio
    audio_codec: str = "aac"
    audio_bitrate: str = "192k"
    
    # Output format
    format: str = "mp4"


def get_crop_filter(
    input_width: int,
    input_height: int,
    output_width: int = 1080,
    output_height: int = 1920
) -> str:
    """
    Generate FFmpeg crop filter for 9:16 center crop.
    
    Method: Crop at native resolution to 9:16, then scale to target.
    """
    # Calculate crop dimensions at native resolution
    # For 9:16: width = height * 9/16
    target_ratio = 9 / 16
    
    crop_width = int(input_height * target_ratio)
    crop_height = input_height
    
    # Ensure crop doesn't exceed input
    if crop_width > input_width:
        crop_width = input_width
        crop_height = int(input_width / target_ratio)
    
    # Center the crop
    crop_x = (input_width - crop_width) // 2
    crop_y = (input_height - crop_height) // 2
    
    # Build filter: crop, then scale
    filter_str = f"crop={crop_width}:{crop_height}:{crop_x}:{crop_y}"
    filter_str += f",scale={output_width}:{output_height}"
    
    return filter_str


def export_vertical_clip(
    source_file: str,
    output_file: str,
    start_time: float,
    end_time: float,
    input_width: int,
    input_height: int,
    caption_file: Optional[str] = None,
    settings: Optional[ExportSettings] = None,
    progress_callback: Optional[Callable[[float], None]] = None
) -> str:
    """
    Export a single clip as vertical video.
    
    Args:
        source_file: Input video file
        output_file: Output video file path
        start_time: Clip start time in seconds
        end_time: Clip end time in seconds
        input_width: Source video width
        input_height: Source video height
        caption_file: Optional .ass caption file to burn in
        settings: Export settings (uses defaults if None)
        progress_callback: Optional callback for progress updates (0.0-1.0)
        
    Returns:
        Path to exported file
    """
    settings = settings or ExportSettings()
    ffmpeg = find_ffmpeg()
    
    duration = end_time - start_time
    
    # Build video filter chain
    crop_filter = get_crop_filter(
        input_width, input_height,
        settings.width, settings.height
    )
    
    video_filter = crop_filter
    
    # Add caption burning if caption file provided
    if caption_file and os.path.isfile(caption_file):
        # Escape path for FFmpeg (Windows compatibility)
        safe_path = caption_file.replace('\\', '/').replace(':', '\\:')
        video_filter += f",ass='{safe_path}'"
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_file) or '.', exist_ok=True)
    
    # Build FFmpeg command
    cmd = [
        ffmpeg,
        '-y',  # Overwrite output
        '-ss', str(start_time),  # Seek before input (faster)
        '-i', source_file,
        '-t', str(duration),
        '-vf', video_filter,
        '-c:v', settings.codec,
        '-preset', settings.preset,
        '-crf', str(settings.crf),
        '-c:a', settings.audio_codec,
        '-b:a', settings.audio_bitrate,
        output_file
    ]
    
    # Run FFmpeg
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True
    )
    
    # Monitor progress from stderr
    stderr_output = ""
    while True:
        line = process.stderr.readline()
        if not line and process.poll() is not None:
            break
        
        stderr_output += line
        
        # Parse progress if callback provided
        if progress_callback and "time=" in line:
            try:
                # Extract time from FFmpeg output
                time_str = line.split("time=")[1].split()[0]
                parts = time_str.split(":")
                current_time = float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
                progress = min(1.0, current_time / duration)
                progress_callback(progress)
            except (IndexError, ValueError):
                pass
    
    # Wait for completion
    return_code = process.wait()
    
    if return_code != 0:
        raise RuntimeError(f"FFmpeg failed with code {return_code}: {stderr_output}")
    
    if not os.path.isfile(output_file):
        raise RuntimeError("FFmpeg produced no output file")
    
    return output_file


def export_batch(
    clips: List[dict],
    source_file: str,
    output_dir: str,
    input_width: int,
    input_height: int,
    caption_dir: Optional[str] = None,
    settings: Optional[ExportSettings] = None,
    progress_callback: Optional[Callable[[int, int, str], None]] = None
) -> List[str]:
    """
    Export multiple clips.
    
    Args:
        clips: List of clip dicts with 'id', 'start', 'end' keys
        source_file: Input video file
        output_dir: Directory to write output files
        input_width: Source video width
        input_height: Source video height
        caption_dir: Optional directory containing .ass files
        settings: Export settings
        progress_callback: Optional callback (current, total, clip_id)
        
    Returns:
        List of exported file paths
    """
    settings = settings or ExportSettings()
    exported = []
    
    os.makedirs(output_dir, exist_ok=True)
    
    for i, clip in enumerate(clips):
        clip_id = clip.get('id', f'clip_{i + 1:03d}')
        start = clip['start']
        end = clip['end']
        
        if progress_callback:
            progress_callback(i + 1, len(clips), clip_id)
        
        # Output file
        output_file = os.path.join(output_dir, f"{clip_id}.{settings.format}")
        
        # Look for caption file
        caption_file = None
        if caption_dir:
            caption_path = os.path.join(caption_dir, f"{clip_id}.ass")
            if os.path.isfile(caption_path):
                caption_file = caption_path
        
        try:
            export_vertical_clip(
                source_file=source_file,
                output_file=output_file,
                start_time=start,
                end_time=end,
                input_width=input_width,
                input_height=input_height,
                caption_file=caption_file,
                settings=settings
            )
            exported.append(output_file)
        except Exception as e:
            print(f"Warning: Failed to export {clip_id}: {e}")
    
    return exported


def get_video_dimensions(video_path: str) -> tuple:
    """
    Get video dimensions using FFprobe.
    
    Returns:
        (width, height) tuple
    """
    from ..input.loader import find_ffprobe
    
    ffprobe = find_ffprobe()
    
    cmd = [
        ffprobe,
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_streams',
        '-select_streams', 'v:0',
        video_path
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        raise RuntimeError(f"FFprobe failed: {result.stderr}")
    
    import json
    data = json.loads(result.stdout)
    
    for stream in data.get('streams', []):
        if stream.get('codec_type') == 'video':
            return stream.get('width', 0), stream.get('height', 0)
    
    raise RuntimeError("No video stream found")

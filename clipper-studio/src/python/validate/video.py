"""
Video validation for Clipper Studio.

Checks:
- Resolution matches expected (9:16 for shorts)
- FPS is constant (no variable frame rate issues)
- No black frames exceeding threshold

These are MECHANICAL checks, not content quality judgments.
"""

import subprocess
import json
import os
from typing import Dict, Optional, Tuple
from .result import ValidationResult, ErrorSeverity


class VideoValidator:
    """Validates video file properties."""
    
    def __init__(
        self,
        expected_aspect_ratio: Tuple[int, int] = (9, 16),  # width:height
        expected_fps: Optional[float] = None,              # None = any constant fps
        max_black_frame_duration: float = 0.5,             # seconds
        min_resolution_height: int = 720,
    ):
        self.expected_aspect_ratio = expected_aspect_ratio
        self.expected_fps = expected_fps
        self.max_black_frame_duration = max_black_frame_duration
        self.min_resolution_height = min_resolution_height
    
    def validate(
        self,
        video_path: str,
        check_black_frames: bool = False,  # Expensive, optional
    ) -> ValidationResult:
        """
        Validate a video file.
        
        Args:
            video_path: Path to video file
            check_black_frames: Whether to scan for black frames (slow)
        
        Returns:
            ValidationResult with any errors found
        """
        result = ValidationResult(
            valid=True,
            item_id=os.path.basename(video_path),
            validator_name='VideoValidator',
        )
        
        # Get video metadata via ffprobe
        metadata = self._get_video_metadata(video_path, result)
        if metadata is None:
            return result
        
        # Check resolution/aspect ratio
        self._check_resolution(result, metadata)
        
        # Check FPS
        self._check_fps(result, metadata)
        
        # Check for black frames (optional, expensive)
        if check_black_frames:
            self._check_black_frames(result, video_path)
        
        return result
    
    def _get_video_metadata(
        self,
        video_path: str,
        result: ValidationResult,
    ) -> Optional[Dict]:
        """Get video metadata using ffprobe."""
        if not os.path.exists(video_path):
            result.add_error(
                code="VIDEO_FILE_NOT_FOUND",
                message=f"Video file not found: {video_path}",
                severity=ErrorSeverity.HARD_FAILURE,
            )
            return None
        
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            video_path,
        ]
        
        try:
            output = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30,
            )
            
            if output.returncode != 0:
                result.add_error(
                    code="VIDEO_FFPROBE_FAILED",
                    message=f"ffprobe failed: {output.stderr}",
                    severity=ErrorSeverity.HARD_FAILURE,
                )
                return None
            
            return json.loads(output.stdout)
        
        except subprocess.TimeoutExpired:
            result.add_error(
                code="VIDEO_FFPROBE_TIMEOUT",
                message="ffprobe timed out",
                severity=ErrorSeverity.HARD_FAILURE,
            )
            return None
        except json.JSONDecodeError as e:
            result.add_error(
                code="VIDEO_FFPROBE_PARSE_ERROR",
                message=f"Failed to parse ffprobe output: {e}",
                severity=ErrorSeverity.HARD_FAILURE,
            )
            return None
        except FileNotFoundError:
            result.add_error(
                code="VIDEO_FFPROBE_NOT_FOUND",
                message="ffprobe not found. Please install FFmpeg.",
                severity=ErrorSeverity.HARD_FAILURE,
            )
            return None
    
    def _check_resolution(self, result: ValidationResult, metadata: Dict):
        """Check video resolution and aspect ratio."""
        video_stream = None
        for stream in metadata.get('streams', []):
            if stream.get('codec_type') == 'video':
                video_stream = stream
                break
        
        if video_stream is None:
            result.add_error(
                code="VIDEO_NO_VIDEO_STREAM",
                message="No video stream found in file",
                severity=ErrorSeverity.HARD_FAILURE,
            )
            return
        
        width = video_stream.get('width', 0)
        height = video_stream.get('height', 0)
        
        if height < self.min_resolution_height:
            result.add_error(
                code="VIDEO_LOW_RESOLUTION",
                message=f"Video height {height}px is below minimum {self.min_resolution_height}px",
                severity=ErrorSeverity.WARNING,
                width=width,
                height=height,
                min_height=self.min_resolution_height,
            )
        
        # Check aspect ratio
        if width > 0 and height > 0:
            actual_ratio = width / height
            expected_ratio = self.expected_aspect_ratio[0] / self.expected_aspect_ratio[1]
            ratio_tolerance = 0.05  # 5% tolerance
            
            if abs(actual_ratio - expected_ratio) > ratio_tolerance:
                result.add_error(
                    code="VIDEO_WRONG_ASPECT_RATIO",
                    message=f"Video aspect ratio {width}:{height} ({actual_ratio:.3f}) "
                            f"does not match expected {self.expected_aspect_ratio[0]}:{self.expected_aspect_ratio[1]} ({expected_ratio:.3f})",
                    severity=ErrorSeverity.ERROR,
                    width=width,
                    height=height,
                    actual_ratio=actual_ratio,
                    expected_ratio=expected_ratio,
                )
    
    def _check_fps(self, result: ValidationResult, metadata: Dict):
        """Check video frame rate."""
        video_stream = None
        for stream in metadata.get('streams', []):
            if stream.get('codec_type') == 'video':
                video_stream = stream
                break
        
        if video_stream is None:
            return
        
        # Parse frame rate (can be "30/1" or "30000/1001" format)
        fps_str = video_stream.get('r_frame_rate', video_stream.get('avg_frame_rate', '0/1'))
        try:
            num, den = map(int, fps_str.split('/'))
            fps = num / den if den > 0 else 0
        except (ValueError, ZeroDivisionError):
            fps = 0
        
        if fps == 0:
            result.add_error(
                code="VIDEO_INVALID_FPS",
                message="Could not determine video frame rate",
                severity=ErrorSeverity.WARNING,
            )
            return
        
        # Check if expected FPS is specified
        if self.expected_fps is not None:
            fps_tolerance = 0.5
            if abs(fps - self.expected_fps) > fps_tolerance:
                result.add_error(
                    code="VIDEO_WRONG_FPS",
                    message=f"Video FPS {fps:.2f} does not match expected {self.expected_fps:.2f}",
                    severity=ErrorSeverity.WARNING,
                    actual_fps=fps,
                    expected_fps=self.expected_fps,
                )
        
        # Check for variable frame rate (compare r_frame_rate vs avg_frame_rate)
        avg_fps_str = video_stream.get('avg_frame_rate', fps_str)
        try:
            num, den = map(int, avg_fps_str.split('/'))
            avg_fps = num / den if den > 0 else fps
        except (ValueError, ZeroDivisionError):
            avg_fps = fps
        
        if abs(fps - avg_fps) > 1.0:
            result.add_error(
                code="VIDEO_VARIABLE_FPS",
                message=f"Video may have variable frame rate (r_frame_rate={fps:.2f}, avg={avg_fps:.2f})",
                severity=ErrorSeverity.WARNING,
                r_frame_rate=fps,
                avg_frame_rate=avg_fps,
            )
    
    def _check_black_frames(self, result: ValidationResult, video_path: str):
        """
        Check for extended black frames in video.
        
        This is an expensive operation that actually decodes the video.
        """
        cmd = [
            "ffmpeg",
            "-i", video_path,
            "-vf", f"blackdetect=d={self.max_black_frame_duration}:pix_th=0.10",
            "-an",
            "-f", "null",
            "-",
        ]
        
        try:
            output = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout
            )
            
            # Parse stderr for black frame detection
            # Format: [blackdetect @ 0x...] black_start:0 black_end:1.5 black_duration:1.5
            stderr = output.stderr
            black_regions = []
            
            for line in stderr.split('\n'):
                if 'black_start:' in line:
                    try:
                        parts = line.split()
                        start = None
                        duration = None
                        for part in parts:
                            if part.startswith('black_start:'):
                                start = float(part.split(':')[1])
                            elif part.startswith('black_duration:'):
                                duration = float(part.split(':')[1])
                        if start is not None and duration is not None:
                            black_regions.append((start, duration))
                    except (ValueError, IndexError):
                        continue
            
            for start, duration in black_regions:
                if duration > self.max_black_frame_duration:
                    result.add_error(
                        code="VIDEO_BLACK_FRAMES",
                        message=f"Black frames detected: {duration:.2f}s at {start:.2f}s",
                        severity=ErrorSeverity.ERROR,
                        black_start=start,
                        black_duration=duration,
                    )
        
        except subprocess.TimeoutExpired:
            result.add_error(
                code="VIDEO_BLACK_DETECT_TIMEOUT",
                message="Black frame detection timed out",
                severity=ErrorSeverity.WARNING,
            )
        except FileNotFoundError:
            result.add_error(
                code="VIDEO_FFMPEG_NOT_FOUND",
                message="ffmpeg not found for black frame detection",
                severity=ErrorSeverity.WARNING,
            )


def get_video_duration(video_path: str) -> Optional[float]:
    """Get video duration in seconds using ffprobe."""
    cmd = [
        "ffprobe",
        "-v", "quiet",
        "-show_entries", "format=duration",
        "-of", "csv=p=0",
        video_path,
    ]
    
    try:
        output = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if output.returncode == 0:
            return float(output.stdout.strip())
    except (subprocess.TimeoutExpired, ValueError):
        pass
    
    return None

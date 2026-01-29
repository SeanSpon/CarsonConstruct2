"""
Manage export formats and presets for different social media platforms
"""
import os
import subprocess
from typing import Dict, List, Optional


class FormatManager:
    """
    Manages export format presets for different platforms.
    
    Each format includes:
    - Resolution (width x height)
    - Frame rate (fps)
    - Bitrate (video and audio)
    - Max duration (platform limits)
    - Codec settings
    """
    
    FORMATS = {
        'instagram_reel': {
            'name': 'Instagram Reel',
            'description': '1080x1920, 30fps, optimized for Instagram',
            'width': 1080,
            'height': 1920,
            'fps': 30,
            'bitrate': '5000k',
            'audio_bitrate': '192k',
            'max_duration': 90,
            'suffix': '_instagram',
            'codec': 'libx264',
            'audio_codec': 'aac'
        },
        'instagram_story': {
            'name': 'Instagram Story',
            'description': '1080x1920, 30fps, max 15 seconds',
            'width': 1080,
            'height': 1920,
            'fps': 30,
            'bitrate': '4000k',
            'audio_bitrate': '128k',
            'max_duration': 15,
            'suffix': '_story',
            'codec': 'libx264',
            'audio_codec': 'aac'
        },
        'tiktok': {
            'name': 'TikTok',
            'description': '1080x1920, 30fps, optimized for TikTok',
            'width': 1080,
            'height': 1920,
            'fps': 30,
            'bitrate': '4000k',
            'audio_bitrate': '192k',
            'max_duration': 180,
            'suffix': '_tiktok',
            'codec': 'libx264',
            'audio_codec': 'aac'
        },
        'youtube_shorts': {
            'name': 'YouTube Shorts',
            'description': '1080x1920, 60fps, max 60 seconds',
            'width': 1080,
            'height': 1920,
            'fps': 60,
            'bitrate': '8000k',
            'audio_bitrate': '192k',
            'max_duration': 60,
            'suffix': '_youtube',
            'codec': 'libx264',
            'audio_codec': 'aac'
        },
        'twitter': {
            'name': 'Twitter/X',
            'description': '1080x1920, 30fps',
            'width': 1080,
            'height': 1920,
            'fps': 30,
            'bitrate': '5000k',
            'audio_bitrate': '128k',
            'max_duration': 140,
            'suffix': '_twitter',
            'codec': 'libx264',
            'audio_codec': 'aac'
        },
        'high_quality': {
            'name': 'High Quality',
            'description': '1080x1920, 60fps, maximum quality',
            'width': 1080,
            'height': 1920,
            'fps': 60,
            'bitrate': '10000k',
            'audio_bitrate': '320k',
            'max_duration': None,  # No limit
            'suffix': '_hq',
            'codec': 'libx264',
            'audio_codec': 'aac'
        },
        'landscape_1080p': {
            'name': 'Landscape 1080p',
            'description': '1920x1080, 30fps, standard landscape',
            'width': 1920,
            'height': 1080,
            'fps': 30,
            'bitrate': '8000k',
            'audio_bitrate': '192k',
            'max_duration': None,
            'suffix': '_landscape',
            'codec': 'libx264',
            'audio_codec': 'aac'
        }
    }
    
    def export_clip(
        self,
        input_path: str,
        output_dir: str,
        format_id: str,
        filename: str = None
    ) -> str:
        """
        Export a clip in the specified format using FFmpeg.
        
        Args:
            input_path: Source video file
            output_dir: Output directory
            format_id: Format identifier (e.g., 'instagram_reel')
            filename: Optional custom filename (without extension)
        
        Returns:
            Path to exported file
        
        Raises:
            ValueError: If format_id is unknown
            RuntimeError: If FFmpeg export fails
        """
        if format_id not in self.FORMATS:
            raise ValueError(f"Unknown format: {format_id}")
        
        fmt = self.FORMATS[format_id]
        
        # Generate output filename
        if filename is None:
            base = os.path.splitext(os.path.basename(input_path))[0]
            filename = f"{base}{fmt['suffix']}"
        
        output_path = os.path.join(output_dir, f"{filename}.mp4")
        os.makedirs(output_dir, exist_ok=True)
        
        # Build FFmpeg command
        cmd = [
            'ffmpeg', '-y',
            '-i', input_path,
            '-vf', f"scale={fmt['width']}:{fmt['height']}:force_original_aspect_ratio=decrease,pad={fmt['width']}:{fmt['height']}:(ow-iw)/2:(oh-ih)/2",
            '-r', str(fmt['fps']),
            '-c:v', fmt['codec'],
            '-b:v', fmt['bitrate'],
            '-c:a', fmt['audio_codec'],
            '-b:a', fmt['audio_bitrate'],
            '-preset', 'medium',
            '-movflags', '+faststart'
        ]
        
        # Add duration limit if set
        if fmt['max_duration']:
            cmd.extend(['-t', str(fmt['max_duration'])])
        
        cmd.append(output_path)
        
        # Execute FFmpeg
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg export failed: {result.stderr}")
        
        return output_path
    
    def batch_export(
        self,
        input_path: str,
        output_dir: str,
        format_ids: List[str],
        filename: str = None
    ) -> Dict[str, str]:
        """
        Export a clip to multiple formats.
        
        Args:
            input_path: Source video file
            output_dir: Output directory
            format_ids: List of format identifiers
            filename: Optional base filename
        
        Returns:
            Dictionary mapping format_id to output path
        """
        results = {}
        
        for format_id in format_ids:
            try:
                output_path = self.export_clip(
                    input_path,
                    output_dir,
                    format_id,
                    filename
                )
                results[format_id] = output_path
            except Exception as e:
                print(f"Export failed for {format_id}: {e}")
                results[format_id] = None
        
        return results
    
    def get_format_info(self, format_id: str) -> Optional[Dict]:
        """
        Get format information by ID.
        
        Args:
            format_id: Format identifier
        
        Returns:
            Format configuration or None if not found
        """
        return self.FORMATS.get(format_id)
    
    def list_formats(self) -> List[Dict]:
        """
        List all available export formats.
        
        Returns:
            List of format summaries
        """
        return [
            {
                'id': fid,
                'name': fmt['name'],
                'description': fmt['description'],
                'resolution': f"{fmt['width']}x{fmt['height']}",
                'fps': fmt['fps'],
                'max_duration': fmt['max_duration']
            }
            for fid, fmt in self.FORMATS.items()
        ]
    
    def get_recommended_format(self, duration: float) -> str:
        """
        Get recommended format based on clip duration.
        
        Args:
            duration: Clip duration in seconds
        
        Returns:
            Recommended format_id
        """
        if duration <= 15:
            return 'instagram_story'
        elif duration <= 60:
            return 'youtube_shorts'
        elif duration <= 90:
            return 'instagram_reel'
        else:
            return 'tiktok'

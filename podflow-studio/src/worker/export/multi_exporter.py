"""
Export clips to multiple formats simultaneously.

This module handles batch export operations with support for
parallel processing and multiple platform formats.
"""
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Optional


class MultiExporter:
    """
    Export clips to multiple social media formats in parallel.
    
    Supports batch export to:
    - Instagram Reels/Stories
    - TikTok
    - YouTube Shorts
    - Twitter/X
    - High Quality archive
    """
    
    PRESETS = {
        'instagram_reel': {
            'name': 'Instagram Reel',
            'width': 1080,
            'height': 1920,
            'fps': 30,
            'bitrate': '5000k',
            'audio_bitrate': '192k',
            'format': 'mp4',
            'max_duration': 90,
            'codec': 'libx264',
            'audio_codec': 'aac',
            'suffix': '_instagram_reel'
        },
        'instagram_story': {
            'name': 'Instagram Story',
            'width': 1080,
            'height': 1920,
            'fps': 30,
            'bitrate': '4000k',
            'audio_bitrate': '128k',
            'format': 'mp4',
            'max_duration': 15,
            'codec': 'libx264',
            'audio_codec': 'aac',
            'suffix': '_instagram_story'
        },
        'tiktok': {
            'name': 'TikTok',
            'width': 1080,
            'height': 1920,
            'fps': 30,
            'bitrate': '4000k',
            'audio_bitrate': '192k',
            'format': 'mp4',
            'max_duration': 180,
            'codec': 'libx264',
            'audio_codec': 'aac',
            'suffix': '_tiktok'
        },
        'youtube_shorts': {
            'name': 'YouTube Shorts',
            'width': 1080,
            'height': 1920,
            'fps': 60,
            'bitrate': '8000k',
            'audio_bitrate': '192k',
            'format': 'mp4',
            'max_duration': 60,
            'codec': 'libx264',
            'audio_codec': 'aac',
            'suffix': '_youtube_shorts'
        },
        'twitter': {
            'name': 'Twitter/X',
            'width': 1080,
            'height': 1920,
            'fps': 30,
            'bitrate': '5000k',
            'audio_bitrate': '128k',
            'format': 'mp4',
            'max_duration': 140,
            'codec': 'libx264',
            'audio_codec': 'aac',
            'suffix': '_twitter'
        },
        'high_quality': {
            'name': 'High Quality',
            'width': 1080,
            'height': 1920,
            'fps': 60,
            'bitrate': '10000k',
            'audio_bitrate': '320k',
            'format': 'mp4',
            'max_duration': None,
            'codec': 'libx264',
            'audio_codec': 'aac',
            'suffix': '_hq'
        }
    }
    
    def __init__(self, ffmpeg_path: str = 'ffmpeg'):
        """
        Initialize multi-exporter.
        
        Args:
            ffmpeg_path: Path to FFmpeg executable
        """
        self.ffmpeg_path = ffmpeg_path
    
    def export_clip(
        self,
        input_path: str,
        output_dir: str,
        presets: List[str],
        clip_name: str = None,
        callback: callable = None
    ) -> Dict[str, Optional[str]]:
        """
        Export a single clip to multiple formats.
        
        Args:
            input_path: Source video file
            output_dir: Output directory
            presets: List of preset names to export
            clip_name: Base name for output files
            callback: Optional progress callback
        
        Returns:
            Dict mapping preset name to output path (or None if failed)
        """
        os.makedirs(output_dir, exist_ok=True)
        
        if clip_name is None:
            clip_name = os.path.splitext(os.path.basename(input_path))[0]
        
        results = {}
        
        for preset_name in presets:
            if preset_name not in self.PRESETS:
                print(f"Unknown preset: {preset_name}")
                results[preset_name] = None
                continue
            
            preset = self.PRESETS[preset_name]
            output_path = os.path.join(
                output_dir,
                f"{clip_name}{preset['suffix']}.{preset['format']}"
            )
            
            try:
                self._export_single(input_path, output_path, preset)
                results[preset_name] = output_path
                
                if callback:
                    callback(preset_name, 'success', output_path)
                    
            except Exception as e:
                print(f"Export failed for {preset_name}: {e}")
                results[preset_name] = None
                
                if callback:
                    callback(preset_name, 'error', str(e))
        
        return results
    
    def batch_export(
        self,
        clips: List[str],
        output_dir: str,
        presets: List[str],
        max_workers: int = 3,
        progress_callback: callable = None
    ) -> List[Dict[str, Any]]:
        """
        Export multiple clips in parallel.
        
        Args:
            clips: List of input clip paths
            output_dir: Output directory
            presets: List of preset names
            max_workers: Maximum parallel exports
            progress_callback: Optional callback for progress updates
        
        Returns:
            List of result dictionaries
        """
        results = []
        total_tasks = len(clips) * len(presets)
        completed_tasks = 0
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {}
            
            for i, clip_path in enumerate(clips):
                clip_name = f"clip_{i+1}"
                future = executor.submit(
                    self.export_clip,
                    clip_path,
                    output_dir,
                    presets,
                    clip_name
                )
                futures[future] = clip_name
            
            for future in as_completed(futures):
                clip_name = futures[future]
                
                try:
                    clip_results = future.result()
                    results.append({
                        'clip_name': clip_name,
                        'outputs': clip_results,
                        'success': any(v is not None for v in clip_results.values())
                    })
                except Exception as e:
                    print(f"Export failed for {clip_name}: {e}")
                    results.append({
                        'clip_name': clip_name,
                        'outputs': {},
                        'success': False,
                        'error': str(e)
                    })
                
                completed_tasks += len(presets)
                
                if progress_callback:
                    progress_callback(
                        completed_tasks,
                        total_tasks,
                        clip_name
                    )
        
        return results
    
    def _export_single(
        self,
        input_path: str,
        output_path: str,
        preset: Dict[str, Any]
    ):
        """
        Export a single file with FFmpeg.
        
        Args:
            input_path: Source video
            output_path: Destination path
            preset: Export settings
        """
        # Build FFmpeg command
        cmd = [
            self.ffmpeg_path, '-y',
            '-i', input_path,
            '-vf', f"scale={preset['width']}:{preset['height']}:force_original_aspect_ratio=decrease,pad={preset['width']}:{preset['height']}:(ow-iw)/2:(oh-ih)/2",
            '-r', str(preset['fps']),
            '-c:v', preset['codec'],
            '-b:v', preset['bitrate'],
            '-c:a', preset['audio_codec'],
            '-b:a', preset['audio_bitrate'],
            '-preset', 'medium',
            '-movflags', '+faststart',
            '-pix_fmt', 'yuv420p'
        ]
        
        # Add duration limit if set
        if preset.get('max_duration'):
            cmd.extend(['-t', str(preset['max_duration'])])
        
        cmd.append(output_path)
        
        # Execute
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg error: {result.stderr[-500:]}")
    
    def get_preset_info(self, preset_name: str) -> Optional[Dict[str, Any]]:
        """
        Get information about a preset.
        
        Args:
            preset_name: Preset identifier
        
        Returns:
            Preset configuration or None
        """
        return self.PRESETS.get(preset_name)
    
    def list_presets(self) -> List[Dict[str, str]]:
        """
        List all available export presets.
        
        Returns:
            List of preset summaries
        """
        return [
            {
                'id': preset_id,
                'name': preset['name'],
                'resolution': f"{preset['width']}x{preset['height']}",
                'fps': preset['fps'],
                'max_duration': preset['max_duration']
            }
            for preset_id, preset in self.PRESETS.items()
        ]
    
    def estimate_output_size(
        self,
        duration: float,
        preset_name: str
    ) -> float:
        """
        Estimate output file size in MB.
        
        Args:
            duration: Clip duration in seconds
            preset_name: Export preset
        
        Returns:
            Estimated size in MB
        """
        if preset_name not in self.PRESETS:
            return 0
        
        preset = self.PRESETS[preset_name]
        
        # Parse bitrate (e.g., "5000k" -> 5000)
        bitrate_str = preset['bitrate'].lower().replace('k', '')
        video_bitrate = int(bitrate_str) * 1000  # bits per second
        
        audio_bitrate_str = preset['audio_bitrate'].lower().replace('k', '')
        audio_bitrate = int(audio_bitrate_str) * 1000
        
        # Apply duration limit
        if preset['max_duration'] and duration > preset['max_duration']:
            duration = preset['max_duration']
        
        # Calculate size: (bitrate * duration) / 8 / 1024 / 1024 = MB
        total_bitrate = video_bitrate + audio_bitrate
        size_bytes = (total_bitrate * duration) / 8
        size_mb = size_bytes / (1024 * 1024)
        
        return round(size_mb, 2)

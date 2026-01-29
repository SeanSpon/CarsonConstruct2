"""
Composite b-roll clips onto main video.

This module handles the visual composition of b-roll footage
onto the main video with various styles and transitions.
"""
from typing import List, Dict, Any, Optional
import os


class BrollCompositor:
    """
    Composites b-roll clips onto the main video.
    
    Supports multiple composition styles:
    - corner: Small overlay in corner of frame
    - fullscreen: Full frame b-roll with reduced opacity
    - side_by_side: Split screen effect
    - picture_in_picture: Floating window style
    """
    
    STYLES = {
        'corner': {
            'description': 'Small overlay in top-right corner',
            'scale': 0.33,  # 1/3 of frame height
            'position': 'top_right',
            'opacity': 1.0,
            'border': True
        },
        'fullscreen': {
            'description': 'Full screen with reduced opacity',
            'scale': 1.0,
            'position': 'center',
            'opacity': 0.7,
            'border': False
        },
        'side_by_side': {
            'description': 'Split screen - main on left, b-roll on right',
            'scale': 0.5,
            'position': 'right',
            'opacity': 1.0,
            'border': True
        },
        'picture_in_picture': {
            'description': 'Floating window in bottom-right',
            'scale': 0.25,
            'position': 'bottom_right',
            'opacity': 1.0,
            'border': True
        }
    }
    
    def __init__(self, style: str = 'corner'):
        """
        Initialize compositor.
        
        Args:
            style: Composition style ('corner', 'fullscreen', 'side_by_side', 'picture_in_picture')
        """
        if style not in self.STYLES:
            style = 'corner'
        
        self.style = style
        self.style_config = self.STYLES[style]
    
    def composite(
        self,
        main_clip: Any,
        broll_moments: List[Dict[str, Any]],
        broll_paths: Dict[float, str],
        broll_duration: float = 3.0
    ) -> Any:
        """
        Add b-roll overlays to main clip.
        
        This method requires moviepy for video processing.
        
        Args:
            main_clip: Main VideoFileClip object
            broll_moments: List of keyword dicts with timestamps
            broll_paths: Map of timestamps to b-roll file paths
            broll_duration: Duration for each b-roll segment (seconds)
        
        Returns:
            CompositeVideoClip with b-roll overlays
        """
        try:
            from moviepy.editor import VideoFileClip, CompositeVideoClip
        except ImportError:
            print("Warning: moviepy not available, returning original clip")
            return main_clip
        
        if not broll_moments or not broll_paths:
            return main_clip
        
        overlays = [main_clip]
        
        for moment in broll_moments:
            timestamp = moment.get('timestamp', 0)
            
            if timestamp not in broll_paths:
                continue
            
            broll_path = broll_paths[timestamp]
            
            if not os.path.exists(broll_path):
                continue
            
            try:
                broll = self._prepare_broll(
                    broll_path,
                    main_clip,
                    timestamp,
                    duration=broll_duration
                )
                
                if broll is not None:
                    overlays.append(broll)
            except Exception as e:
                print(f"Failed to add b-roll at {timestamp}: {e}")
                continue
        
        if len(overlays) > 1:
            return CompositeVideoClip(overlays)
        
        return main_clip
    
    def _prepare_broll(
        self,
        broll_path: str,
        main_clip: Any,
        start_time: float,
        duration: float
    ) -> Optional[Any]:
        """
        Prepare a single b-roll clip for overlay.
        
        Args:
            broll_path: Path to b-roll video file
            main_clip: Main video clip (for dimensions)
            start_time: When to show the b-roll
            duration: How long to show it
        
        Returns:
            Prepared VideoFileClip positioned and timed
        """
        try:
            from moviepy.editor import VideoFileClip
        except ImportError:
            return None
        
        broll = VideoFileClip(broll_path)
        
        # Trim or loop to desired duration
        if broll.duration > duration:
            broll = broll.subclip(0, duration)
        elif broll.duration < duration:
            # Loop the clip to fill duration
            loops_needed = int(duration / broll.duration) + 1
            from moviepy.editor import concatenate_videoclips
            broll = concatenate_videoclips([broll] * loops_needed)
            broll = broll.subclip(0, duration)
        
        # Remove audio from b-roll
        broll = broll.without_audio()
        
        # Apply style-specific transformations
        main_w, main_h = main_clip.w, main_clip.h
        
        if self.style == 'corner':
            # Scale to 1/3 height, position in top-right
            target_h = int(main_h * self.style_config['scale'])
            broll = broll.resize(height=target_h)
            
            # Position with padding
            padding = 20
            x_pos = main_w - broll.w - padding
            y_pos = padding
            broll = broll.set_position((x_pos, y_pos))
            
        elif self.style == 'fullscreen':
            # Resize to fill frame
            broll = broll.resize((main_w, main_h))
            broll = broll.set_opacity(self.style_config['opacity'])
            broll = broll.set_position('center')
            
        elif self.style == 'side_by_side':
            # Resize to half width
            target_w = int(main_w * self.style_config['scale'])
            broll = broll.resize(width=target_w)
            
            # Position on right side, centered vertically
            x_pos = main_w - target_w
            y_pos = (main_h - broll.h) // 2
            broll = broll.set_position((x_pos, y_pos))
            
        elif self.style == 'picture_in_picture':
            # Scale to 1/4 height, position in bottom-right
            target_h = int(main_h * self.style_config['scale'])
            broll = broll.resize(height=target_h)
            
            # Position with padding
            padding = 30
            x_pos = main_w - broll.w - padding
            y_pos = main_h - broll.h - padding
            broll = broll.set_position((x_pos, y_pos))
        
        # Set timing
        broll = broll.set_start(start_time)
        
        # Add fade transitions
        fade_duration = min(0.3, duration / 4)
        try:
            broll = broll.crossfadein(fade_duration)
            broll = broll.crossfadeout(fade_duration)
        except Exception:
            # Fade methods might not be available in all moviepy versions
            pass
        
        return broll
    
    def generate_ffmpeg_filter(
        self,
        main_input: str,
        broll_inputs: List[Dict[str, Any]],
        style: str = None
    ) -> str:
        """
        Generate FFmpeg filter complex for b-roll composition.
        
        This is an alternative to moviepy that uses FFmpeg directly
        for potentially faster processing.
        
        Args:
            main_input: Input label for main video (e.g., '0:v')
            broll_inputs: List of b-roll info dicts with 'input_index', 
                         'start_time', 'duration'
            style: Override style
        
        Returns:
            FFmpeg filter_complex string
        """
        style = style or self.style
        config = self.STYLES.get(style, self.STYLES['corner'])
        
        filters = []
        current_label = f'[{main_input}]'
        
        for i, broll in enumerate(broll_inputs):
            input_idx = broll.get('input_index', i + 1)
            start = broll.get('start_time', 0)
            duration = broll.get('duration', 3.0)
            
            if style == 'corner':
                # Scale b-roll and overlay in corner
                scale = config['scale']
                filters.append(
                    f"[{input_idx}:v]scale=iw*{scale}:-1[broll{i}];"
                    f"{current_label}[broll{i}]overlay=W-w-20:20:"
                    f"enable='between(t,{start},{start+duration})'[v{i}]"
                )
                current_label = f'[v{i}]'
            
            elif style == 'fullscreen':
                # Blend b-roll over main
                opacity = config['opacity']
                filters.append(
                    f"[{input_idx}:v]scale=W:H[broll{i}];"
                    f"{current_label}[broll{i}]blend=all_expr='A*{opacity}+B*(1-{opacity})':"
                    f"enable='between(t,{start},{start+duration})'[v{i}]"
                )
                current_label = f'[v{i}]'
        
        return ';'.join(filters)
    
    @classmethod
    def list_styles(cls) -> List[Dict[str, str]]:
        """
        List available composition styles.
        
        Returns:
            List of style info dicts
        """
        return [
            {'id': style_id, 'description': config['description']}
            for style_id, config in cls.STYLES.items()
        ]

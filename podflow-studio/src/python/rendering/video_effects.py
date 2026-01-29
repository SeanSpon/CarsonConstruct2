"""
Dynamic video editing effects for ClipBot MVP.

Provides:
- Dynamic cuts with zoom/pan effects
- Aspect ratio conversion to 9:16 (vertical video)
- Silence removal
- Ken Burns style movements
"""
import random
from typing import List, Tuple, Any, Optional


class VideoEffects:
    """
    Video effects engine for short-form content.
    
    Applies dynamic cuts, zooms, and pans to make clips more engaging.
    Handles aspect ratio conversion for vertical video platforms.
    """
    
    def __init__(self, seed: Optional[int] = None):
        """
        Initialize video effects.
        
        Args:
            seed: Random seed for reproducible effect selection
        """
        if seed is not None:
            random.seed(seed)
        
        # Available effects
        self.effects = [
            'zoom_in',
            'zoom_out', 
            'static',
            'pan_left',
            'pan_right',
            'ken_burns',
        ]
        
        # Effect weights (static gets less priority)
        self.effect_weights = {
            'zoom_in': 0.25,
            'zoom_out': 0.25,
            'static': 0.1,
            'pan_left': 0.15,
            'pan_right': 0.15,
            'ken_burns': 0.1,
        }
    
    def apply_dynamic_cuts(
        self,
        clip: Any,
        cuts_per_minute: int = 10,
        min_segment_duration: float = 2.0,
    ) -> Any:
        """
        Add dynamic cuts and camera movements to a clip.
        
        Segments the clip and applies random zoom/pan effects to each segment.
        
        Args:
            clip: MoviePy VideoClip
            cuts_per_minute: Target number of cuts per minute
            min_segment_duration: Minimum segment duration (seconds)
        
        Returns:
            Edited VideoClip with dynamic effects
        """
        try:
            from moviepy.editor import concatenate_videoclips
        except ImportError:
            raise ImportError("moviepy not installed. Run: pip install moviepy")
        
        # Calculate segment duration
        target_segment_duration = 60.0 / cuts_per_minute
        segment_duration = max(min_segment_duration, target_segment_duration)
        
        segments = []
        current_time = 0
        last_effect = None
        
        while current_time < clip.duration:
            end_time = min(current_time + segment_duration, clip.duration)
            
            # Skip very short final segments
            if end_time - current_time < 0.5:
                break
            
            # Extract segment
            subclip = clip.subclip(current_time, end_time)
            
            # Choose effect (avoid repeating same effect twice)
            effect = self._choose_effect(exclude=last_effect)
            last_effect = effect
            
            # Apply effect
            subclip = self._apply_effect(subclip, effect)
            segments.append(subclip)
            
            current_time = end_time
        
        if not segments:
            return clip
        
        if len(segments) == 1:
            return segments[0]
        
        return concatenate_videoclips(segments, method='compose')
    
    def _choose_effect(self, exclude: Optional[str] = None) -> str:
        """Choose a random effect based on weights."""
        available = [e for e in self.effects if e != exclude]
        weights = [self.effect_weights.get(e, 0.1) for e in available]
        
        # Normalize weights
        total = sum(weights)
        weights = [w / total for w in weights]
        
        # Random selection
        r = random.random()
        cumulative = 0
        for effect, weight in zip(available, weights):
            cumulative += weight
            if r <= cumulative:
                return effect
        
        return available[-1]
    
    def _apply_effect(self, clip: Any, effect: str) -> Any:
        """Apply a specific effect to a clip."""
        if effect == 'zoom_in':
            return self._apply_zoom_in(clip)
        elif effect == 'zoom_out':
            return self._apply_zoom_out(clip)
        elif effect == 'pan_left':
            return self._apply_pan(clip, direction='left')
        elif effect == 'pan_right':
            return self._apply_pan(clip, direction='right')
        elif effect == 'ken_burns':
            return self._apply_ken_burns(clip)
        else:  # static
            return clip
    
    def _apply_zoom_in(self, clip: Any, start_scale: float = 1.0, end_scale: float = 1.08) -> Any:
        """Apply gradual zoom in effect."""
        def zoom_func(t):
            progress = t / max(clip.duration, 0.001)
            return start_scale + (end_scale - start_scale) * progress
        
        return clip.resize(zoom_func)
    
    def _apply_zoom_out(self, clip: Any, start_scale: float = 1.08, end_scale: float = 1.0) -> Any:
        """Apply gradual zoom out effect."""
        def zoom_func(t):
            progress = t / max(clip.duration, 0.001)
            return start_scale + (end_scale - start_scale) * progress
        
        return clip.resize(zoom_func)
    
    def _apply_pan(self, clip: Any, direction: str = 'left', pan_amount: int = 40) -> Any:
        """Apply horizontal pan effect."""
        def position_func(t):
            progress = t / max(clip.duration, 0.001)
            if direction == 'left':
                x_offset = int(-pan_amount * progress)
            else:
                x_offset = int(pan_amount * progress)
            return (x_offset, 'center')
        
        return clip.set_position(position_func)
    
    def _apply_ken_burns(self, clip: Any) -> Any:
        """
        Apply Ken Burns effect (combined zoom + pan).
        
        Randomly chooses zoom direction and pan direction.
        """
        # Random parameters
        zoom_in = random.choice([True, False])
        pan_direction = random.choice(['left', 'right'])
        
        # Apply zoom
        if zoom_in:
            zoomed = self._apply_zoom_in(clip, 1.0, 1.1)
        else:
            zoomed = self._apply_zoom_out(clip, 1.1, 1.0)
        
        # Apply subtle pan
        return self._apply_pan(zoomed, pan_direction, pan_amount=20)
    
    def convert_to_9_16(
        self,
        clip: Any,
        target_width: int = 1080,
        target_height: int = 1920,
        fill_mode: str = 'crop',
    ) -> Any:
        """
        Convert video to 9:16 aspect ratio (1080x1920 by default).
        
        Args:
            clip: MoviePy VideoClip
            target_width: Output width (default 1080)
            target_height: Output height (default 1920)
            fill_mode: 'crop' (fill frame, crop excess) or 'fit' (add black bars)
        
        Returns:
            VideoClip in 9:16 aspect ratio
        """
        current_aspect = clip.w / clip.h
        target_aspect = target_width / target_height
        
        if fill_mode == 'crop':
            # Scale to fill, then center crop
            if current_aspect > target_aspect:
                # Video is wider - scale by height, crop width
                scale = target_height / clip.h
                scaled_clip = clip.resize(scale)
                
                # Center crop to target width
                x_center = scaled_clip.w / 2
                x1 = int(x_center - target_width / 2)
                
                return scaled_clip.crop(
                    x1=x1,
                    y1=0,
                    x2=x1 + target_width,
                    y2=target_height
                )
            else:
                # Video is taller - scale by width, crop height
                scale = target_width / clip.w
                scaled_clip = clip.resize(scale)
                
                # Center crop to target height
                y_center = scaled_clip.h / 2
                y1 = int(y_center - target_height / 2)
                
                return scaled_clip.crop(
                    x1=0,
                    y1=y1,
                    x2=target_width,
                    y2=y1 + target_height
                )
        else:
            # Fit mode - add black bars
            if current_aspect > target_aspect:
                # Video is wider - fit to width, add top/bottom bars
                scale = target_width / clip.w
            else:
                # Video is taller - fit to height, add side bars
                scale = target_height / clip.h
            
            scaled_clip = clip.resize(scale)
            
            # Center on black background
            return scaled_clip.on_color(
                size=(target_width, target_height),
                color=(0, 0, 0),
                pos='center'
            )
    
    def remove_silence(
        self,
        clip: Any,
        silence_ranges: List[Tuple[float, float]],
        min_silence_duration: float = 0.5,
    ) -> Any:
        """
        Remove silent sections from clip.
        
        Args:
            clip: MoviePy VideoClip
            silence_ranges: List of (start, end) tuples marking silence
            min_silence_duration: Minimum silence duration to remove
        
        Returns:
            VideoClip with silence removed
        """
        try:
            from moviepy.editor import concatenate_videoclips
        except ImportError:
            raise ImportError("moviepy not installed")
        
        if not silence_ranges:
            return clip
        
        # Filter short silences
        silence_ranges = [
            (start, end) for start, end in silence_ranges
            if end - start >= min_silence_duration
        ]
        
        if not silence_ranges:
            return clip
        
        # Sort by start time
        silence_ranges.sort(key=lambda x: x[0])
        
        # Extract non-silent segments
        segments = []
        last_end = 0
        
        for start, end in silence_ranges:
            if start > last_end:
                segments.append(clip.subclip(last_end, start))
            last_end = end
        
        # Add final segment
        if last_end < clip.duration:
            segments.append(clip.subclip(last_end, clip.duration))
        
        if not segments:
            return clip
        
        if len(segments) == 1:
            return segments[0]
        
        return concatenate_videoclips(segments, method='compose')
    
    def apply_preset(
        self,
        clip: Any,
        preset: str = 'viral_fast',
    ) -> Any:
        """
        Apply a preset style to the clip.
        
        Presets:
        - viral_fast: High energy, 15 cuts/min
        - storytelling: Medium pace, 8 cuts/min
        - educational: Slower pace, 6 cuts/min
        - raw_authentic: Minimal edits, 4 cuts/min
        - hype: Maximum energy, 20 cuts/min
        
        Args:
            clip: MoviePy VideoClip
            preset: Preset name
        
        Returns:
            VideoClip with preset applied
        """
        presets = {
            'viral_fast': {'cuts_per_minute': 15, 'min_segment_duration': 2.0},
            'storytelling': {'cuts_per_minute': 8, 'min_segment_duration': 4.0},
            'educational': {'cuts_per_minute': 6, 'min_segment_duration': 5.0},
            'raw_authentic': {'cuts_per_minute': 4, 'min_segment_duration': 8.0},
            'hype': {'cuts_per_minute': 20, 'min_segment_duration': 1.5},
        }
        
        config = presets.get(preset, presets['storytelling'])
        return self.apply_dynamic_cuts(clip, **config)


def apply_vertical_format(clip: Any, with_effects: bool = True) -> Any:
    """
    Convenience function to convert clip to vertical format with effects.
    
    Args:
        clip: MoviePy VideoClip
        with_effects: Whether to apply dynamic cuts
    
    Returns:
        9:16 VideoClip ready for short-form platforms
    """
    effects = VideoEffects()
    
    # Convert to vertical
    vertical = effects.convert_to_9_16(clip)
    
    # Apply dynamic cuts if requested
    if with_effects:
        vertical = effects.apply_dynamic_cuts(vertical)
    
    return vertical

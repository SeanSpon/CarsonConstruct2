"""
Dynamic word-by-word caption rendering for ClipBot MVP.

Renders animated captions on video clips with:
- Word-by-word or chunk-based display
- Pop-in animations
- Configurable styling (font, color, stroke)
"""
from typing import List, Dict, Any, Optional, Callable
import math


class CaptionRenderer:
    """
    Dynamic caption renderer for short-form video clips.
    
    Supports two main styles:
    - word_by_word: Each word appears individually with animation
    - three_word_chunks: Words appear in groups of 3 for readability
    """
    
    def __init__(self, style: str = 'word_by_word'):
        """
        Initialize caption renderer.
        
        Args:
            style: 'word_by_word' or 'three_word_chunks'
        """
        self.style = style
    
    def _default_config(self) -> Dict[str, Any]:
        """Return default caption styling config."""
        return {
            'fontsize': 70,
            'color': 'white',
            'stroke_color': 'black',
            'stroke_width': 3,
            'font': 'Arial-Bold',
            'position': ('center', 0.75),  # 75% down the screen
            'shadow': True,
            'shadow_color': 'black',
            'shadow_offset': (3, 3),
            'animation': 'pop',  # 'pop', 'fade', or 'none'
            'max_width_ratio': 0.85,  # Max width as ratio of video width
        }
    
    def render(
        self,
        video_clip: Any,
        words: List[Dict[str, Any]],
        config: Optional[Dict[str, Any]] = None
    ) -> Any:
        """
        Render captions on video.
        
        Args:
            video_clip: MoviePy VideoClip object
            words: List of word dicts with 'text', 'start', 'end' keys
            config: Optional styling configuration
        
        Returns:
            CompositeVideoClip with captions overlaid
        """
        try:
            from moviepy.editor import TextClip, CompositeVideoClip
        except ImportError:
            raise ImportError("moviepy not installed. Run: pip install moviepy")
        
        if config is None:
            config = self._default_config()
        else:
            # Merge with defaults
            default_config = self._default_config()
            default_config.update(config)
            config = default_config
        
        if not words:
            return video_clip
        
        if self.style == 'word_by_word':
            return self._render_word_by_word(video_clip, words, config)
        else:
            return self._render_chunks(video_clip, words, config)
    
    def _create_text_clip(
        self,
        text: str,
        video_clip: Any,
        config: Dict[str, Any],
        start_time: float,
        duration: float,
        animate: bool = True
    ) -> Any:
        """Create a single text clip with styling."""
        from moviepy.editor import TextClip
        
        try:
            # Create base text clip
            txt = TextClip(
                text,
                fontsize=config['fontsize'],
                color=config['color'],
                font=config['font'],
                stroke_color=config['stroke_color'],
                stroke_width=config['stroke_width'],
                method='caption',
                size=(int(video_clip.w * config['max_width_ratio']), None),
                align='center',
            )
        except Exception as e:
            # Fallback without some options that might not be available
            print(f"[CaptionRenderer] Warning: Falling back to simple text clip: {e}")
            txt = TextClip(
                text,
                fontsize=config['fontsize'],
                color=config['color'],
                method='label',
            )
        
        # Set timing
        txt = txt.set_start(start_time)
        txt = txt.set_duration(duration)
        
        # Position
        y_pos = int(video_clip.h * config['position'][1])
        txt = txt.set_position(('center', y_pos))
        
        # Apply animation if enabled
        if animate and config.get('animation') == 'pop' and duration > 0.15:
            txt = self._apply_pop_animation(txt, duration)
        
        return txt
    
    def _apply_pop_animation(self, clip: Any, duration: float) -> Any:
        """Apply pop-in animation to a clip."""
        # Pop-in effect: starts small, grows to full size
        def pop_resize(t):
            if t < 0.1:
                # Quick pop-in over first 0.1 seconds
                progress = t / 0.1
                # Start at 60% size, grow to 105%, then settle to 100%
                return 0.6 + (progress * 0.45)
            elif t < 0.15:
                # Slight overshoot then settle
                progress = (t - 0.1) / 0.05
                return 1.05 - (progress * 0.05)
            else:
                return 1.0
        
        return clip.resize(pop_resize)
    
    def _render_word_by_word(
        self,
        video_clip: Any,
        words: List[Dict],
        config: Dict
    ) -> Any:
        """Render each word individually with animation."""
        from moviepy.editor import CompositeVideoClip
        
        caption_clips = []
        
        for i, word in enumerate(words):
            text = word['text'].strip()
            if not text:
                continue
            
            start_time = word['start']
            end_time = word['end']
            duration = end_time - start_time
            
            if duration <= 0:
                continue
            
            try:
                txt_clip = self._create_text_clip(
                    text,
                    video_clip,
                    config,
                    start_time,
                    duration,
                    animate=True
                )
                caption_clips.append(txt_clip)
            except Exception as e:
                print(f"[CaptionRenderer] Warning: Failed to create clip for word '{text}': {e}")
                continue
        
        if not caption_clips:
            return video_clip
        
        return CompositeVideoClip([video_clip] + caption_clips)
    
    def _render_chunks(
        self,
        video_clip: Any,
        words: List[Dict],
        config: Dict,
        chunk_size: int = 3
    ) -> Any:
        """Render words in chunks for better readability."""
        from moviepy.editor import CompositeVideoClip
        
        caption_clips = []
        
        for i in range(0, len(words), chunk_size):
            chunk = words[i:i + chunk_size]
            if not chunk:
                continue
            
            # Combine words into chunk text
            chunk_text = ' '.join([w['text'].strip() for w in chunk if w['text'].strip()])
            if not chunk_text:
                continue
            
            start_time = chunk[0]['start']
            end_time = chunk[-1]['end']
            duration = end_time - start_time
            
            if duration <= 0:
                continue
            
            try:
                txt_clip = self._create_text_clip(
                    chunk_text,
                    video_clip,
                    config,
                    start_time,
                    duration,
                    animate=True
                )
                caption_clips.append(txt_clip)
            except Exception as e:
                print(f"[CaptionRenderer] Warning: Failed to create chunk clip: {e}")
                continue
        
        if not caption_clips:
            return video_clip
        
        return CompositeVideoClip([video_clip] + caption_clips)
    
    def render_with_highlight(
        self,
        video_clip: Any,
        words: List[Dict],
        config: Optional[Dict] = None,
        highlight_color: str = 'yellow',
        context_words: int = 2
    ) -> Any:
        """
        Render captions with the current word highlighted.
        
        Shows surrounding context words but highlights the current word.
        More sophisticated than word-by-word but requires more processing.
        
        Args:
            video_clip: MoviePy VideoClip
            words: List of word dicts
            config: Styling config
            highlight_color: Color for highlighted word
            context_words: Number of words before/after to show
        
        Returns:
            CompositeVideoClip with highlighted captions
        """
        # This is a more advanced feature - implement if needed
        # For MVP, use the simpler word_by_word or chunks style
        return self._render_chunks(video_clip, words, config or self._default_config())


def render_captions_on_clip(
    video_clip: Any,
    words: List[Dict],
    style: str = 'three_word_chunks',
    **config_kwargs
) -> Any:
    """
    Convenience function to render captions on a video clip.
    
    Args:
        video_clip: MoviePy VideoClip
        words: List of word dicts with text, start, end
        style: 'word_by_word' or 'three_word_chunks'
        **config_kwargs: Additional config options (fontsize, color, etc.)
    
    Returns:
        VideoClip with captions
    """
    renderer = CaptionRenderer(style=style)
    return renderer.render(video_clip, words, config=config_kwargs if config_kwargs else None)

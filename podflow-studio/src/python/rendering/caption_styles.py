"""
Pre-made caption style presets for video rendering.

This module provides various caption styles optimized for
different content types and platforms.
"""
from typing import Dict, Any, List, Optional


class CaptionStyles:
    """
    Collection of pre-made caption style presets.
    
    Each style defines:
    - Font settings (family, size, weight)
    - Color settings (text, stroke, shadow)
    - Animation type
    - Position and alignment
    """
    
    STYLES = {
        'viral_popup': {
            'name': 'Viral Popup',
            'description': 'Bold, attention-grabbing style perfect for viral content',
            'fontsize': 85,
            'font': 'Impact',
            'color': '#FFFF00',  # Yellow
            'stroke_color': '#000000',  # Black
            'stroke_width': 4,
            'shadow_color': '#000000',
            'shadow_offset': (3, 3),
            'animation': 'scale_bounce',
            'position': ('center', 0.4),  # Horizontally centered, 40% from top
            'uppercase': True,
            'letter_spacing': 2
        },
        
        'clean_minimal': {
            'name': 'Clean Minimal',
            'description': 'Subtle, elegant style for professional content',
            'fontsize': 60,
            'font': 'Helvetica',
            'color': '#FFFFFF',  # White
            'stroke_color': None,
            'stroke_width': 0,
            'shadow_color': 'rgba(0,0,0,0.5)',
            'shadow_offset': (2, 2),
            'animation': 'fade_in',
            'position': ('center', 0.8),  # 80% from top
            'uppercase': False,
            'letter_spacing': 0
        },
        
        'bold_impact': {
            'name': 'Bold Impact',
            'description': 'High contrast, highly readable style',
            'fontsize': 75,
            'font': 'Arial Black',
            'color': '#FFFFFF',
            'stroke_color': '#000000',
            'stroke_width': 5,
            'shadow_color': '#000000',
            'shadow_offset': (4, 4),
            'animation': 'slide_up',
            'position': ('center', 0.7),
            'uppercase': False,
            'letter_spacing': 1
        },
        
        'neon_glow': {
            'name': 'Neon Glow',
            'description': 'Cyberpunk/tech aesthetic with glow effect',
            'fontsize': 70,
            'font': 'Arial Bold',
            'color': '#00FFFF',  # Cyan
            'stroke_color': '#FF00FF',  # Magenta
            'stroke_width': 3,
            'shadow_color': '#00FFFF',
            'shadow_offset': (0, 0),
            'glow_radius': 10,
            'animation': 'pulse',
            'position': ('center', 0.5),
            'uppercase': True,
            'letter_spacing': 3
        },
        
        'subtitle_bottom': {
            'name': 'Subtitle Bottom',
            'description': 'Traditional subtitle positioning',
            'fontsize': 55,
            'font': 'Arial',
            'color': '#FFFFFF',
            'stroke_color': '#000000',
            'stroke_width': 2,
            'shadow_color': None,
            'shadow_offset': (0, 0),
            'animation': 'none',
            'position': ('center', 0.9),
            'uppercase': False,
            'letter_spacing': 0,
            'background_box': True,
            'background_color': 'rgba(0,0,0,0.6)'
        },
        
        'karaoke_highlight': {
            'name': 'Karaoke Highlight',
            'description': 'Words light up as they are spoken',
            'fontsize': 68,
            'font': 'Arial Bold',
            'color': '#FFFFFF',
            'highlight_color': '#FFD700',  # Gold
            'stroke_color': '#000000',
            'stroke_width': 3,
            'shadow_color': '#000000',
            'shadow_offset': (2, 2),
            'animation': 'karaoke',
            'position': ('center', 0.75),
            'uppercase': False,
            'letter_spacing': 1
        },
        
        'tiktok_style': {
            'name': 'TikTok Style',
            'description': 'Popular TikTok caption look',
            'fontsize': 72,
            'font': 'Proxima Nova Bold',  # Fallback to Arial Black
            'fallback_font': 'Arial Black',
            'color': '#FFFFFF',
            'stroke_color': '#000000',
            'stroke_width': 4,
            'shadow_color': 'rgba(0,0,0,0.4)',
            'shadow_offset': (2, 2),
            'animation': 'word_by_word',
            'position': ('center', 0.45),
            'uppercase': False,
            'letter_spacing': 1,
            'max_words_per_line': 3
        },
        
        'cinematic': {
            'name': 'Cinematic',
            'description': 'Film-style subtitles with letterbox',
            'fontsize': 50,
            'font': 'Georgia',
            'color': '#FFFFFF',
            'stroke_color': None,
            'stroke_width': 0,
            'shadow_color': 'rgba(0,0,0,0.8)',
            'shadow_offset': (1, 1),
            'animation': 'fade_in',
            'position': ('center', 0.85),
            'uppercase': False,
            'letter_spacing': 1,
            'italic': True
        }
    }
    
    @classmethod
    def get_style(cls, style_name: str) -> Dict[str, Any]:
        """
        Get a caption style by name.
        
        Args:
            style_name: Style identifier
        
        Returns:
            Style configuration dict (defaults to clean_minimal if not found)
        """
        return cls.STYLES.get(style_name, cls.STYLES['clean_minimal']).copy()
    
    @classmethod
    def list_styles(cls) -> List[Dict[str, str]]:
        """
        List all available caption styles.
        
        Returns:
            List of style summaries
        """
        return [
            {
                'id': style_id,
                'name': style['name'],
                'description': style['description']
            }
            for style_id, style in cls.STYLES.items()
        ]
    
    @classmethod
    def get_ass_style(cls, style_name: str) -> str:
        """
        Generate ASS/SSA format style definition.
        
        Args:
            style_name: Style identifier
        
        Returns:
            ASS format style string for FFmpeg subtitles
        """
        style = cls.get_style(style_name)
        
        # Convert hex color to ASS format (BGR)
        def hex_to_ass(hex_color: str) -> str:
            if hex_color is None:
                return '&H00000000'
            hex_color = hex_color.lstrip('#')
            if len(hex_color) == 6:
                r, g, b = hex_color[0:2], hex_color[2:4], hex_color[4:6]
                return f'&H00{b}{g}{r}'
            return '&H00FFFFFF'
        
        primary_color = hex_to_ass(style.get('color', '#FFFFFF'))
        outline_color = hex_to_ass(style.get('stroke_color'))
        
        # Build ASS style string
        # Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, 
        #         OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut,
        #         ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow,
        #         Alignment, MarginL, MarginR, MarginV, Encoding
        
        ass_style = (
            f"Style: Default,{style.get('font', 'Arial')},"
            f"{style.get('fontsize', 60)},"
            f"{primary_color},{primary_color},"
            f"{outline_color},&H80000000,"
            f"{'1' if style.get('uppercase') else '0'},"
            f"{'1' if style.get('italic') else '0'},"
            f"0,0,100,100,"
            f"{style.get('letter_spacing', 0)},0,1,"
            f"{style.get('stroke_width', 2)},{2 if style.get('shadow_color') else 0},"
            f"2,10,10,40,1"
        )
        
        return ass_style
    
    @classmethod
    def create_custom_style(
        cls,
        base_style: str = 'clean_minimal',
        overrides: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Create a custom style based on an existing preset.
        
        Args:
            base_style: Base style to start from
            overrides: Settings to override
        
        Returns:
            Custom style configuration
        """
        style = cls.get_style(base_style)
        
        if overrides:
            style.update(overrides)
            style['name'] = f"Custom ({style['name']})"
        
        return style
    
    @classmethod
    def get_ffmpeg_drawtext_filter(
        cls,
        style_name: str,
        text: str = '%{subtitle}',
        video_width: int = 1080,
        video_height: int = 1920
    ) -> str:
        """
        Generate FFmpeg drawtext filter for a style.
        
        Args:
            style_name: Style identifier
            text: Text to display (use %{subtitle} for dynamic text)
            video_width: Output video width
            video_height: Output video height
        
        Returns:
            FFmpeg drawtext filter string
        """
        style = cls.get_style(style_name)
        
        # Calculate position
        pos = style.get('position', ('center', 0.75))
        x_pos = '(w-text_w)/2' if pos[0] == 'center' else str(int(video_width * 0.1))
        y_pos = f"h*{pos[1]}"
        
        # Build filter
        filter_parts = [
            f"fontfile=/path/to/font.ttf",  # Would need actual font path
            f"fontsize={style.get('fontsize', 60)}",
            f"fontcolor={style.get('color', 'white')}",
            f"x={x_pos}",
            f"y={y_pos}"
        ]
        
        if style.get('stroke_color'):
            filter_parts.extend([
                f"borderw={style.get('stroke_width', 2)}",
                f"bordercolor={style.get('stroke_color')}"
            ])
        
        if style.get('shadow_color'):
            offset = style.get('shadow_offset', (2, 2))
            filter_parts.extend([
                f"shadowx={offset[0]}",
                f"shadowy={offset[1]}",
                f"shadowcolor={style.get('shadow_color')}"
            ])
        
        return f"drawtext={':'.join(filter_parts)}"

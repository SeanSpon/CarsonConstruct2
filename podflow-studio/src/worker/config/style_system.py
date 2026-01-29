"""
Comprehensive style system with presets and customization for PodFlow Studio
"""
from typing import Dict, Any, Optional, List


class StyleSystem:
    """
    Manages style presets and customization for video clip generation.
    
    Each style preset controls:
    - Editing pace (cuts per minute)
    - Visual effects (zoom, pan, etc.)
    - Caption styling (font, size, color, animation)
    - Clip duration preferences
    - B-roll settings
    """
    
    # Complete style presets
    PRESETS = {
        'viral_fast': {
            'name': 'Viral Fast',
            'description': 'High energy, rapid cuts, attention-grabbing',
            'emoji': '⚡',
            
            # Editing settings
            'cuts_per_minute': 15,
            'effects': ['zoom_in', 'zoom_out', 'pan_right', 'pan_left'],
            'effect_intensity': 0.10,  # How much zoom/pan (10%)
            
            # Caption settings
            'caption_style': 'three_word_chunks',
            'caption_fontsize': 85,
            'caption_color': 'yellow',
            'caption_stroke_color': 'black',
            'caption_stroke_width': 4,
            'caption_font': 'Impact',
            'caption_position': 0.4,  # Y position (0-1, from top)
            'caption_animation': 'scale_bounce',
            
            # Clip settings
            'min_duration': 15,
            'max_duration': 45,
            'prefer_high_energy': True,
            
            # B-roll settings
            'use_broll': True,
            'broll_style': 'corner',
            'broll_frequency': 'high'
        },
        
        'storytelling': {
            'name': 'Storytelling',
            'description': 'Slower pace, emphasis on narrative flow',
            'emoji': '📖',
            
            'cuts_per_minute': 8,
            'effects': ['zoom_in', 'static'],
            'effect_intensity': 0.06,
            
            'caption_style': 'word_by_word',
            'caption_fontsize': 65,
            'caption_color': 'white',
            'caption_stroke_color': 'black',
            'caption_stroke_width': 3,
            'caption_font': 'Arial-Bold',
            'caption_position': 0.75,
            'caption_animation': 'fade_in',
            
            'min_duration': 30,
            'max_duration': 90,
            'prefer_high_energy': False,
            
            'use_broll': True,
            'broll_style': 'corner',
            'broll_frequency': 'medium'
        },
        
        'educational': {
            'name': 'Educational',
            'description': 'Clear, readable, professional presentation',
            'emoji': '🎓',
            
            'cuts_per_minute': 6,
            'effects': ['static', 'zoom_in'],
            'effect_intensity': 0.04,
            
            'caption_style': 'three_word_chunks',
            'caption_fontsize': 60,
            'caption_color': 'white',
            'caption_stroke_color': None,
            'caption_stroke_width': 0,
            'caption_font': 'Helvetica',
            'caption_position': 0.85,
            'caption_animation': 'fade_in',
            
            'min_duration': 45,
            'max_duration': 120,
            'prefer_high_energy': False,
            
            'use_broll': True,
            'broll_style': 'fullscreen',
            'broll_frequency': 'high'
        },
        
        'raw_authentic': {
            'name': 'Raw & Authentic',
            'description': 'Minimal editing, natural and genuine feel',
            'emoji': '🎥',
            
            'cuts_per_minute': 4,
            'effects': ['static'],
            'effect_intensity': 0.02,
            
            'caption_style': 'word_by_word',
            'caption_fontsize': 55,
            'caption_color': 'white',
            'caption_stroke_color': 'black',
            'caption_stroke_width': 2,
            'caption_font': 'Arial',
            'caption_position': 0.8,
            'caption_animation': 'none',
            
            'min_duration': 20,
            'max_duration': 60,
            'prefer_high_energy': False,
            
            'use_broll': False,
            'broll_style': None,
            'broll_frequency': 'none'
        },
        
        'hype': {
            'name': 'Hype',
            'description': 'Maximum energy, intense cuts, explosive',
            'emoji': '🔥',
            
            'cuts_per_minute': 20,
            'effects': ['zoom_in', 'zoom_out', 'pan_right', 'pan_left'],
            'effect_intensity': 0.15,
            
            'caption_style': 'three_word_chunks',
            'caption_fontsize': 90,
            'caption_color': '#00ffff',
            'caption_stroke_color': '#ff00ff',
            'caption_stroke_width': 5,
            'caption_font': 'Impact',
            'caption_position': 0.5,
            'caption_animation': 'pulse',
            
            'min_duration': 10,
            'max_duration': 30,
            'prefer_high_energy': True,
            
            'use_broll': True,
            'broll_style': 'corner',
            'broll_frequency': 'very_high'
        },
        
        'minimal_clean': {
            'name': 'Minimal Clean',
            'description': 'Subtle, elegant, professional minimalism',
            'emoji': '✨',
            
            'cuts_per_minute': 5,
            'effects': ['static', 'zoom_in'],
            'effect_intensity': 0.03,
            
            'caption_style': 'word_by_word',
            'caption_fontsize': 58,
            'caption_color': 'white',
            'caption_stroke_color': None,
            'caption_stroke_width': 0,
            'caption_font': 'Helvetica-Light',
            'caption_position': 0.82,
            'caption_animation': 'fade_in',
            
            'min_duration': 25,
            'max_duration': 75,
            'prefer_high_energy': False,
            
            'use_broll': False,
            'broll_style': None,
            'broll_frequency': 'none'
        }
    }
    
    @classmethod
    def get_preset(cls, preset_id: str) -> Dict[str, Any]:
        """
        Get a style preset by ID.
        
        Args:
            preset_id: Preset identifier
        
        Returns:
            Copy of the preset configuration
        """
        if preset_id not in cls.PRESETS:
            # Default to storytelling if unknown
            return cls.PRESETS['storytelling'].copy()
        return cls.PRESETS[preset_id].copy()
    
    @classmethod
    def list_presets(cls) -> List[Dict[str, str]]:
        """
        List all available presets.
        
        Returns:
            List of preset summaries with id, name, description, emoji
        """
        return [
            {
                'id': pid,
                'name': preset['name'],
                'description': preset['description'],
                'emoji': preset['emoji']
            }
            for pid, preset in cls.PRESETS.items()
        ]
    
    @classmethod
    def create_custom_style(
        cls,
        base_preset: str = 'storytelling',
        overrides: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Create a custom style based on a preset with overrides.
        
        Args:
            base_preset: Base preset to start from
            overrides: Dictionary of settings to override
        
        Returns:
            Custom style configuration
        """
        style = cls.get_preset(base_preset)
        
        if overrides:
            style.update(overrides)
            style['name'] = f"Custom ({style.get('name', 'Custom')})"
        
        return style
    
    @classmethod
    def validate_style(cls, style: Dict[str, Any]) -> bool:
        """
        Validate that a style has all required fields.
        
        Args:
            style: Style configuration to validate
        
        Returns:
            True if valid, False otherwise
        """
        required_fields = [
            'cuts_per_minute',
            'caption_style',
            'caption_fontsize',
            'caption_color',
            'min_duration',
            'max_duration'
        ]
        
        return all(field in style for field in required_fields)
    
    @classmethod
    def get_caption_config(cls, style: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract caption-specific configuration from a style.
        
        Args:
            style: Full style configuration
        
        Returns:
            Caption configuration dictionary
        """
        return {
            'style': style.get('caption_style', 'word_by_word'),
            'fontsize': style.get('caption_fontsize', 65),
            'color': style.get('caption_color', 'white'),
            'stroke_color': style.get('caption_stroke_color', 'black'),
            'stroke_width': style.get('caption_stroke_width', 3),
            'font': style.get('caption_font', 'Arial-Bold'),
            'position': ('center', style.get('caption_position', 0.75)),
            'animation': style.get('caption_animation', 'fade_in')
        }
    
    @classmethod
    def get_effects_config(cls, style: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract effects-specific configuration from a style.
        
        Args:
            style: Full style configuration
        
        Returns:
            Effects configuration dictionary
        """
        return {
            'cuts_per_minute': style.get('cuts_per_minute', 10),
            'effects': style.get('effects', ['zoom_in', 'static']),
            'intensity': style.get('effect_intensity', 0.08)
        }
    
    @classmethod
    def get_broll_config(cls, style: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract b-roll-specific configuration from a style.
        
        Args:
            style: Full style configuration
        
        Returns:
            B-roll configuration dictionary
        """
        return {
            'enabled': style.get('use_broll', False),
            'style': style.get('broll_style', 'corner'),
            'frequency': style.get('broll_frequency', 'medium')
        }
    
    @classmethod
    def get_clip_duration_config(cls, style: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract clip duration configuration from a style.
        
        Args:
            style: Full style configuration
        
        Returns:
            Duration configuration dictionary
        """
        return {
            'min_duration': style.get('min_duration', 20),
            'max_duration': style.get('max_duration', 60),
            'prefer_high_energy': style.get('prefer_high_energy', False)
        }

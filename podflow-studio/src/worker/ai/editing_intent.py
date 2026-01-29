#!/usr/bin/env python3
"""
Editing Intent Parser

Parses natural language editing instructions into structured edit parameters.
Uses GPT for semantic understanding when API key is available, with fallback
to rule-based parsing.
"""

import json
import re
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict


@dataclass
class EditingIntent:
    """Structured editing intent parsed from user instructions."""
    
    # Core style
    style: str = "balanced"  # engaging, cinematic, energetic, calm, professional
    pacing: str = "moderate"  # fast, moderate, slow
    
    # Platform optimization
    target_platform: str = "general"  # tiktok, youtube, instagram, general
    aspect_ratio: str = "16:9"  # 16:9, 9:16, 1:1, 4:5
    
    # Effects
    zoom_effects: bool = False
    camera_shake: bool = False
    motion_blur: bool = False
    transitions: str = "cut"  # cut, fade, dynamic, match-reference
    
    # Audio
    music_mood: Optional[str] = None  # upbeat, chill, dramatic, none
    music_volume: float = 0.3  # 0-1, relative to dialogue
    sfx_enabled: bool = True
    
    # Captions
    captions_enabled: bool = True
    caption_style: str = "modern"  # modern, minimal, bold, animated
    
    # B-Roll
    broll_enabled: bool = False
    broll_frequency: str = "medium"  # low, medium, high
    broll_topics: List[str] = None
    
    # Pacing details
    cut_frequency: float = 3.0  # Average seconds between cuts
    silence_threshold: float = 1.5  # Seconds of silence before cutting
    
    # Reference
    reference_style: Optional[str] = None
    
    def __post_init__(self):
        if self.broll_topics is None:
            self.broll_topics = []
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# Keywords for rule-based parsing
PACING_KEYWORDS = {
    'fast': ['fast', 'quick', 'snappy', 'energetic', 'dynamic', 'rapid', 'punchy', 'tight'],
    'slow': ['slow', 'calm', 'cinematic', 'relaxed', 'breathing', 'contemplative', 'leisurely'],
    'moderate': ['moderate', 'balanced', 'natural', 'normal', 'standard'],
}

PLATFORM_KEYWORDS = {
    'tiktok': ['tiktok', 'tik tok', 'tt'],
    'youtube': ['youtube', 'yt', 'youtube shorts'],
    'instagram': ['instagram', 'ig', 'reels', 'insta'],
}

STYLE_KEYWORDS = {
    'energetic': ['energetic', 'exciting', 'hype', 'pumped', 'intense'],
    'cinematic': ['cinematic', 'movie', 'film', 'artistic', 'beautiful'],
    'professional': ['professional', 'corporate', 'clean', 'polished'],
    'casual': ['casual', 'chill', 'laid back', 'relaxed', 'conversational'],
    'funny': ['funny', 'comedic', 'humorous', 'meme', 'viral'],
}

MUSIC_KEYWORDS = {
    'upbeat': ['upbeat', 'energetic music', 'happy', 'positive', 'fun'],
    'chill': ['chill', 'lo-fi', 'lofi', 'relaxing', 'ambient', 'calm music'],
    'dramatic': ['dramatic', 'epic', 'intense', 'cinematic music', 'orchestral'],
    'none': ['no music', 'without music', 'music free', 'dialogue only'],
}


def parse_intent_rules(prompt: str) -> EditingIntent:
    """
    Rule-based intent parsing. Works without API.
    
    Args:
        prompt: User's natural language editing instructions
        
    Returns:
        EditingIntent with parsed parameters
    """
    intent = EditingIntent()
    lower_prompt = prompt.lower()
    
    # Parse pacing
    for pacing, keywords in PACING_KEYWORDS.items():
        if any(kw in lower_prompt for kw in keywords):
            intent.pacing = pacing
            break
    
    # Parse platform
    for platform, keywords in PLATFORM_KEYWORDS.items():
        if any(kw in lower_prompt for kw in keywords):
            intent.target_platform = platform
            # Auto-adjust for platform
            if platform == 'tiktok' or platform == 'instagram':
                intent.aspect_ratio = '9:16'
                if intent.pacing == 'moderate':
                    intent.pacing = 'fast'
            break
    
    # Parse style
    for style, keywords in STYLE_KEYWORDS.items():
        if any(kw in lower_prompt for kw in keywords):
            intent.style = style
            break
    
    # Parse music
    for mood, keywords in MUSIC_KEYWORDS.items():
        if any(kw in lower_prompt for kw in keywords):
            intent.music_mood = mood if mood != 'none' else None
            if mood == 'none':
                intent.music_volume = 0.0
            break
    
    # Parse effects
    if any(kw in lower_prompt for kw in ['zoom', 'zoom in', 'zoom effect', 'ken burns']):
        intent.zoom_effects = True
    
    if any(kw in lower_prompt for kw in ['shake', 'camera shake', 'handheld']):
        intent.camera_shake = True
    
    if any(kw in lower_prompt for kw in ['blur', 'motion blur']):
        intent.motion_blur = True
    
    # Parse transitions
    if any(kw in lower_prompt for kw in ['fade', 'crossfade', 'dissolve']):
        intent.transitions = 'fade'
    elif any(kw in lower_prompt for kw in ['dynamic', 'creative', 'fancy']):
        intent.transitions = 'dynamic'
    
    # Parse captions
    if any(kw in lower_prompt for kw in ['caption', 'subtitle', 'text']):
        intent.captions_enabled = True
    if any(kw in lower_prompt for kw in ['no caption', 'without caption', 'no subtitle']):
        intent.captions_enabled = False
    
    # Parse B-roll
    if any(kw in lower_prompt for kw in ['b-roll', 'broll', 'b roll', 'cutaway', 'insert']):
        intent.broll_enabled = True
    
    # Adjust cut frequency based on pacing
    if intent.pacing == 'fast':
        intent.cut_frequency = 1.5
        intent.silence_threshold = 0.8
    elif intent.pacing == 'slow':
        intent.cut_frequency = 5.0
        intent.silence_threshold = 2.5
    
    # Store raw style description
    intent.style = prompt.strip() if not intent.style else intent.style
    
    return intent


def parse_intent_ai(prompt: str, api_key: str, reference_analysis: Optional[Dict] = None) -> EditingIntent:
    """
    AI-powered intent parsing using GPT.
    
    Args:
        prompt: User's natural language editing instructions
        api_key: OpenAI API key
        reference_analysis: Optional analysis of reference video
        
    Returns:
        EditingIntent with AI-parsed parameters
    """
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        
        system_prompt = """You are an expert video editor assistant. Parse the user's editing instructions into structured parameters.

Return a JSON object with these fields:
- style: string (engaging, cinematic, energetic, calm, professional, casual, funny)
- pacing: string (fast, moderate, slow)
- target_platform: string (tiktok, youtube, instagram, general)
- aspect_ratio: string (16:9, 9:16, 1:1, 4:5)
- zoom_effects: boolean
- camera_shake: boolean  
- transitions: string (cut, fade, dynamic)
- music_mood: string or null (upbeat, chill, dramatic, null for no music)
- music_volume: float 0-1
- captions_enabled: boolean
- caption_style: string (modern, minimal, bold, animated)
- broll_enabled: boolean
- broll_frequency: string (low, medium, high)
- cut_frequency: float (average seconds between cuts, 1-10)
- silence_threshold: float (seconds before cutting silence, 0.5-3)

Be specific and match common editing styles for the mentioned platforms."""

        user_message = f"Parse these editing instructions: {prompt}"
        
        if reference_analysis:
            user_message += f"\n\nReference video analysis: {json.dumps(reference_analysis)}"
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        
        result = json.loads(response.choices[0].message.content)
        
        # Convert to EditingIntent
        intent = EditingIntent(
            style=result.get('style', 'balanced'),
            pacing=result.get('pacing', 'moderate'),
            target_platform=result.get('target_platform', 'general'),
            aspect_ratio=result.get('aspect_ratio', '16:9'),
            zoom_effects=result.get('zoom_effects', False),
            camera_shake=result.get('camera_shake', False),
            motion_blur=result.get('motion_blur', False),
            transitions=result.get('transitions', 'cut'),
            music_mood=result.get('music_mood'),
            music_volume=result.get('music_volume', 0.3),
            sfx_enabled=result.get('sfx_enabled', True),
            captions_enabled=result.get('captions_enabled', True),
            caption_style=result.get('caption_style', 'modern'),
            broll_enabled=result.get('broll_enabled', False),
            broll_frequency=result.get('broll_frequency', 'medium'),
            broll_topics=result.get('broll_topics', []),
            cut_frequency=result.get('cut_frequency', 3.0),
            silence_threshold=result.get('silence_threshold', 1.5),
        )
        
        return intent
        
    except Exception as e:
        print(f"AI parsing failed, falling back to rules: {e}")
        return parse_intent_rules(prompt)


def parse_editing_intent(
    prompt: str,
    api_key: Optional[str] = None,
    use_ai: bool = True,
    reference_analysis: Optional[Dict] = None
) -> EditingIntent:
    """
    Main entry point for parsing editing instructions.
    
    Args:
        prompt: User's natural language editing instructions
        api_key: Optional OpenAI API key for AI parsing
        use_ai: Whether to use AI parsing (requires api_key)
        reference_analysis: Optional analysis of reference video
        
    Returns:
        EditingIntent with parsed parameters
    """
    if use_ai and api_key:
        return parse_intent_ai(prompt, api_key, reference_analysis)
    return parse_intent_rules(prompt)


def intent_to_ffmpeg_params(intent: EditingIntent) -> Dict[str, Any]:
    """
    Convert EditingIntent to FFmpeg-compatible parameters.
    
    Args:
        intent: Parsed editing intent
        
    Returns:
        Dict with FFmpeg filter parameters
    """
    params = {
        'filters': [],
        'audio_filters': [],
        'output_options': {},
    }
    
    # Aspect ratio
    aspect_map = {
        '16:9': (1920, 1080),
        '9:16': (1080, 1920),
        '1:1': (1080, 1080),
        '4:5': (1080, 1350),
    }
    width, height = aspect_map.get(intent.aspect_ratio, (1920, 1080))
    params['output_options']['width'] = width
    params['output_options']['height'] = height
    
    # Zoom effects (Ken Burns style)
    if intent.zoom_effects:
        # Scale up slightly and use position animation
        params['filters'].append('scale=1.1*iw:1.1*ih')
        params['filters'].append("crop=iw/1.1:ih/1.1:'(iw-ow)/2':'(ih-oh)/2'")
    
    # Transitions
    if intent.transitions == 'fade':
        params['transition_duration'] = 0.5
        params['transition_type'] = 'fade'
    elif intent.transitions == 'dynamic':
        params['transition_duration'] = 0.3
        params['transition_type'] = 'wipeleft'
    else:
        params['transition_duration'] = 0
        params['transition_type'] = 'cut'
    
    # Audio mixing
    if intent.music_mood:
        params['music_volume'] = intent.music_volume
    else:
        params['music_volume'] = 0
    
    params['dialogue_volume'] = 1.0
    params['sfx_volume'] = 0.7 if intent.sfx_enabled else 0
    
    # Cut timing
    params['min_segment_duration'] = intent.cut_frequency * 0.5
    params['max_segment_duration'] = intent.cut_frequency * 2
    params['silence_threshold'] = intent.silence_threshold
    
    return params


# CLI for testing
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python editing_intent.py '<editing instructions>'")
        sys.exit(1)
    
    prompt = sys.argv[1]
    api_key = sys.argv[2] if len(sys.argv) > 2 else None
    
    intent = parse_editing_intent(prompt, api_key, use_ai=bool(api_key))
    
    print("Parsed Intent:")
    print(json.dumps(intent.to_dict(), indent=2))
    
    print("\nFFmpeg Parameters:")
    print(json.dumps(intent_to_ffmpeg_params(intent), indent=2))

"""
Karaoke Caption Generator

Generates ASS (Advanced SubStation Alpha) subtitle files with:
- Word-by-word highlighting
- Bottom-third positioning for vertical video
- Multiple style presets

ASS format chosen for:
- Wide FFmpeg support
- Rich styling options
- Precise timing control
"""

import os
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional

from ..transcription import Transcript, Word


class CaptionStyle(Enum):
    """Caption style presets."""
    VIRAL = "viral"      # Green highlight on current word
    MINIMAL = "minimal"  # Clean white text
    BOLD = "bold"        # Heavy white with strong outline


@dataclass
class CaptionSettings:
    """Caption configuration."""
    style: CaptionStyle = CaptionStyle.VIRAL
    font_name: str = "Arial Black"
    font_size: int = 56
    max_chars_per_line: int = 32
    max_lines: int = 2
    position: str = "bottom"  # "bottom" or "center"
    
    # Video dimensions (for positioning)
    video_width: int = 1080
    video_height: int = 1920


def format_ass_time(seconds: float) -> str:
    """
    Format time for ASS format: H:MM:SS.cc (centiseconds).
    """
    if seconds < 0:
        seconds = 0
    
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centis = int((seconds % 1) * 100)
    
    return f"{hours}:{minutes:02d}:{secs:02d}.{centis:02d}"


def wrap_text(text: str, max_chars: int = 32, max_lines: int = 2) -> str:
    """
    Wrap text to fit within constraints.
    Uses \\N for ASS line breaks.
    """
    words = text.split()
    if not words:
        return ""
    
    lines = []
    current_line = []
    current_length = 0
    
    for word in words:
        word_length = len(word)
        space_needed = 1 if current_line else 0
        
        if current_length + word_length + space_needed > max_chars:
            if current_line:
                lines.append(" ".join(current_line))
                if len(lines) >= max_lines:
                    break
            current_line = [word]
            current_length = word_length
        else:
            current_line.append(word)
            current_length += word_length + space_needed
    
    # Add remaining line
    if current_line and len(lines) < max_lines:
        lines.append(" ".join(current_line))
    
    return "\\N".join(lines)


def escape_ass_text(text: str) -> str:
    """Escape special characters for ASS format."""
    # Replace backslashes first
    text = text.replace("\\", "\\\\")
    return text


def get_style_colors(style: CaptionStyle) -> dict:
    """Get color settings for a caption style."""
    styles = {
        CaptionStyle.VIRAL: {
            "primary": "&H00FFFFFF",    # White
            "highlight": "&H0000FF00",   # Green
            "outline": "&H00000000",     # Black
            "shadow": "&H96000000",      # Semi-transparent black
            "outline_width": 4,
            "shadow_depth": 2,
        },
        CaptionStyle.MINIMAL: {
            "primary": "&H00FFFFFF",
            "highlight": "&H00FFFFFF",
            "outline": "&H00000000",
            "shadow": "&H64000000",
            "outline_width": 2,
            "shadow_depth": 1,
        },
        CaptionStyle.BOLD: {
            "primary": "&H00FFFFFF",
            "highlight": "&H00FFFFFF",
            "outline": "&H00000000",
            "shadow": "&H96000000",
            "outline_width": 5,
            "shadow_depth": 3,
        },
    }
    return styles.get(style, styles[CaptionStyle.VIRAL])


def generate_ass_header(settings: CaptionSettings) -> str:
    """Generate ASS file header with styles."""
    colors = get_style_colors(settings.style)
    
    # Alignment: 2 = bottom center, 5 = center center
    alignment = 5 if settings.position == "center" else 2
    margin_v = 0 if settings.position == "center" else 150
    
    return f"""[Script Info]
Title: PodClip Auto-Generated Captions
ScriptType: v4.00+
WrapStyle: 0
PlayResX: {settings.video_width}
PlayResY: {settings.video_height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{settings.font_name},{settings.font_size},{colors['primary']},{colors['highlight']},{colors['outline']},{colors['shadow']},-1,0,0,0,100,100,0,0,1,{colors['outline_width']},{colors['shadow_depth']},{alignment},40,40,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def group_words_into_chunks(
    words: List[Word],
    max_chars: int = 32,
    max_lines: int = 2,
    max_gap: float = 0.5
) -> List[List[Word]]:
    """
    Group words into display chunks based on timing and length.
    
    Words are grouped together if:
    - Combined text fits in max_chars * max_lines
    - Gap between words is less than max_gap seconds
    """
    if not words:
        return []
    
    chunks = []
    current_chunk = []
    current_text = ""
    
    for word in words:
        if not current_chunk:
            current_chunk.append(word)
            current_text = word.word
            continue
        
        # Check timing gap
        gap = word.start - current_chunk[-1].end
        
        # Check text length
        new_text = current_text + " " + word.word
        
        # Start new chunk if gap too large or text too long
        if gap > max_gap or len(new_text) > max_chars * max_lines:
            if current_chunk:
                chunks.append(current_chunk)
            current_chunk = [word]
            current_text = word.word
        else:
            current_chunk.append(word)
            current_text = new_text
    
    if current_chunk:
        chunks.append(current_chunk)
    
    return chunks


def generate_chunk_events(
    chunks: List[List[Word]],
    clip_start: float,
    settings: CaptionSettings
) -> List[str]:
    """
    Generate ASS dialogue events for word chunks.
    Times are adjusted relative to clip start.
    """
    events = []
    
    for chunk in chunks:
        if not chunk:
            continue
        
        # Time relative to clip start
        chunk_start = chunk[0].start - clip_start
        chunk_end = chunk[-1].end - clip_start
        
        # Ensure valid times
        chunk_start = max(0, chunk_start)
        chunk_end = max(chunk_start + 0.1, chunk_end)
        
        # Build text
        text = " ".join(w.word for w in chunk)
        wrapped = wrap_text(text, settings.max_chars_per_line, settings.max_lines)
        escaped = escape_ass_text(wrapped)
        
        # Format times
        start_str = format_ass_time(chunk_start)
        end_str = format_ass_time(chunk_end)
        
        events.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{escaped}")
    
    return events


def generate_captions(
    transcript: Transcript,
    clip_start: float,
    clip_end: float,
    output_path: str,
    settings: Optional[CaptionSettings] = None
) -> str:
    """
    Generate ASS caption file for a clip.
    
    Args:
        transcript: Full transcript with word timestamps
        clip_start: Clip start time in original video
        clip_end: Clip end time in original video
        output_path: Path to write .ass file
        settings: Caption settings (uses defaults if None)
        
    Returns:
        Path to generated .ass file
    """
    settings = settings or CaptionSettings()
    
    # Get words in clip range
    words = transcript.get_words_in_range(clip_start, clip_end)
    
    if not words:
        # No words - generate empty caption file
        content = generate_ass_header(settings)
        os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return output_path
    
    # Group words into display chunks
    chunks = group_words_into_chunks(
        words,
        max_chars=settings.max_chars_per_line,
        max_lines=settings.max_lines
    )
    
    # Generate events
    events = generate_chunk_events(chunks, clip_start, settings)
    
    # Build file content
    header = generate_ass_header(settings)
    content = header + "\n".join(events)
    if events:
        content += "\n"
    
    # Write file
    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return output_path


def generate_captions_for_clip(
    transcript: Transcript,
    clip_start: float,
    clip_end: float,
    output_dir: str,
    clip_id: str,
    style: CaptionStyle = CaptionStyle.VIRAL
) -> str:
    """
    Convenience function to generate captions for a single clip.
    
    Args:
        transcript: Full transcript
        clip_start: Clip start time
        clip_end: Clip end time
        output_dir: Directory to write caption file
        clip_id: Clip identifier (used in filename)
        style: Caption style
        
    Returns:
        Path to generated .ass file
    """
    output_path = os.path.join(output_dir, f"{clip_id}.ass")
    settings = CaptionSettings(style=style)
    
    return generate_captions(
        transcript,
        clip_start,
        clip_end,
        output_path,
        settings
    )

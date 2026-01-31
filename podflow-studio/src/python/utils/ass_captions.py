"""
ASS Caption Generator Module

Generate ASS (Advanced SubStation Alpha) subtitle files for vertical reels.
Features:
- Bottom-third positioning (or center)
- 2-line max with word wrapping
- Big font (56-72pt) with stroke/shadow
- Multiple styles: viral (green highlight), minimal, bold
"""

from typing import List, Dict, Tuple, Optional
import os


def format_ass_time(seconds: float) -> str:
    """
    Format time in ASS format: H:MM:SS.cc (centiseconds).
    
    Args:
        seconds: Time in seconds
        
    Returns:
        ASS-formatted time string
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centis = int((seconds % 1) * 100)
    
    return f"{hours}:{minutes:02d}:{secs:02d}.{centis:02d}"


def wrap_text(
    text: str,
    max_chars_per_line: int = 32,
    max_lines: int = 2
) -> str:
    """
    Wrap text to fit within max_chars_per_line and max_lines.
    Uses \\N for ASS line breaks.
    
    Args:
        text: Text to wrap
        max_chars_per_line: Maximum characters per line
        max_lines: Maximum number of lines
        
    Returns:
        Wrapped text with \\N line breaks
    """
    words = text.split()
    
    if not words:
        return ""
    
    lines = []
    current_line = []
    current_length = 0
    
    for word in words:
        word_length = len(word)
        
        # If adding this word would exceed line length
        if current_length + word_length + (1 if current_line else 0) > max_chars_per_line:
            if current_line:
                lines.append(" ".join(current_line))
                current_line = [word]
                current_length = word_length
                
                # Stop if we've hit max lines
                if len(lines) >= max_lines:
                    break
            else:
                # Word is too long for a line, truncate it
                lines.append(word[:max_chars_per_line])
                current_line = []
                current_length = 0
        else:
            current_line.append(word)
            current_length += word_length + (1 if current_length > 0 else 0)
    
    # Add remaining line
    if current_line and len(lines) < max_lines:
        lines.append(" ".join(current_line))
    
    return "\\N".join(lines)


def escape_ass_text(text: str) -> str:
    """
    Escape special characters for ASS format.
    """
    # Replace backslashes first (before we add our own)
    text = text.replace("\\", "\\\\")
    # ASS uses \N for newlines, { } for override tags
    # We don't escape braces as we use them for styling
    return text


def get_style_definition(style: str, font_size: int, position: str) -> str:
    """
    Get ASS style definition block for the given style.
    
    Styles:
    - viral: Green/yellow highlight on current word
    - minimal: Clean white text with subtle shadow
    - bold: Heavy white text with strong outline
    
    Position:
    - bottom: Bottom third (80% down)
    - center: Center of screen
    """
    # Vertical position: 8 = top, 10 = center, 2 = bottom
    # MarginV controls distance from edge
    if position == "center":
        alignment = 5  # Center center
        margin_v = 0
    else:  # bottom
        alignment = 2  # Bottom center
        margin_v = 150  # Pixels from bottom
    
    # Common settings
    font_name = "Arial Black"
    bold = -1  # Bold
    
    if style == "viral":
        # Viral style: White text with green highlight for current word
        # Primary color: White, Secondary: Green (for karaoke), Outline: Black
        return f"""Style: Caption,{font_name},{font_size},&H00FFFFFF,&H0000FF00,&H00000000,&H96000000,{bold},0,0,0,100,100,0,0,1,4,2,{alignment},15,15,{margin_v},1
Style: Highlight,{font_name},{font_size},&H0000FF00,&H0000FF00,&H00000000,&H96000000,{bold},0,0,0,100,100,0,0,1,4,2,{alignment},15,15,{margin_v},1"""
    
    elif style == "minimal":
        # Minimal style: White text with subtle shadow
        return f"""Style: Caption,{font_name},{font_size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,{bold},0,0,0,100,100,0,0,1,2,1,{alignment},15,15,{margin_v},1"""
    
    else:  # bold
        # Bold style: Heavy white with strong black outline
        return f"""Style: Caption,{font_name},{font_size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,{bold},0,0,0,100,100,0,0,1,5,3,{alignment},15,15,{margin_v},1"""


def generate_ass_header(
    video_width: int,
    video_height: int,
    style: str,
    font_size: int,
    position: str
) -> str:
    """
    Generate ASS file header with script info and styles.
    """
    style_block = get_style_definition(style, font_size, position)
    
    return f"""[Script Info]
Title: Auto-generated captions
ScriptType: v4.00+
WrapStyle: 0
PlayResX: {video_width}
PlayResY: {video_height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{style_block}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def generate_word_by_word_events(
    words: List[Dict],
    clip_start: float,
    clip_end: float,
    style: str,
    max_chars: int,
    max_lines: int
) -> List[str]:
    """
    Generate word-by-word caption events (for viral style with highlighting).
    
    Args:
        words: List of word dicts with 'word', 'start', 'end'
        clip_start: Clip start time in original video
        clip_end: Clip end time
        style: Caption style
        max_chars: Max chars per line
        max_lines: Max lines
        
    Returns:
        List of ASS dialogue lines
    """
    # Filter words within clip bounds
    clip_words = [
        w for w in words 
        if w.get("end", 0) > clip_start and w.get("start", 0) < clip_end
    ]
    
    if not clip_words:
        return []
    
    events = []
    
    # Group words into display chunks (by timing proximity)
    chunks = []
    current_chunk = []
    
    for word in clip_words:
        if not current_chunk:
            current_chunk.append(word)
        else:
            # Start new chunk if gap > 0.5s or chunk text too long
            gap = word.get("start", 0) - current_chunk[-1].get("end", 0)
            chunk_text = " ".join(w.get("word", "") for w in current_chunk)
            
            if gap > 0.5 or len(chunk_text) + len(word.get("word", "")) > max_chars * max_lines:
                chunks.append(current_chunk)
                current_chunk = [word]
            else:
                current_chunk.append(word)
    
    if current_chunk:
        chunks.append(current_chunk)
    
    # Generate events for each chunk
    for chunk in chunks:
        if not chunk:
            continue
        
        chunk_start = chunk[0].get("start", 0) - clip_start
        chunk_end = chunk[-1].get("end", 0) - clip_start
        
        # Ensure non-negative times
        chunk_start = max(0, chunk_start)
        chunk_end = max(chunk_start + 0.1, chunk_end)
        
        # Build display text
        full_text = " ".join(w.get("word", "") for w in chunk)
        wrapped_text = wrap_text(full_text, max_chars, max_lines)
        
        # Add dialogue event
        start_str = format_ass_time(chunk_start)
        end_str = format_ass_time(chunk_end)
        
        escaped_text = escape_ass_text(wrapped_text)
        events.append(f"Dialogue: 0,{start_str},{end_str},Caption,,0,0,0,,{escaped_text}")
    
    return events


def generate_segment_events(
    segments: List[Dict],
    clip_start: float,
    clip_end: float,
    max_chars: int,
    max_lines: int
) -> List[str]:
    """
    Generate segment-based caption events (for minimal/bold styles).
    
    Args:
        segments: List of segment dicts with 'text', 'start', 'end'
        clip_start: Clip start time
        clip_end: Clip end time
        max_chars: Max chars per line
        max_lines: Max lines
        
    Returns:
        List of ASS dialogue lines
    """
    # Filter segments within clip bounds
    clip_segments = [
        s for s in segments 
        if s.get("end", 0) > clip_start and s.get("start", 0) < clip_end
    ]
    
    if not clip_segments:
        return []
    
    events = []
    
    for seg in clip_segments:
        seg_start = max(0, seg.get("start", 0) - clip_start)
        seg_end = max(seg_start + 0.1, seg.get("end", 0) - clip_start)
        
        text = seg.get("text", "").strip()
        if not text:
            continue
        
        wrapped_text = wrap_text(text, max_chars, max_lines)
        escaped_text = escape_ass_text(wrapped_text)
        
        start_str = format_ass_time(seg_start)
        end_str = format_ass_time(seg_end)
        
        events.append(f"Dialogue: 0,{start_str},{end_str},Caption,,0,0,0,,{escaped_text}")
    
    return events


def generate_ass_captions(
    transcript: Dict,
    clip_start: float,
    clip_end: float,
    output_path: str,
    max_chars_per_line: int = 32,
    max_lines: int = 2,
    font_size: int = 56,
    style: str = "viral",
    position: str = "bottom",
    video_width: int = 1080,
    video_height: int = 1920
) -> str:
    """
    Generate ASS subtitle file for a clip.
    
    Args:
        transcript: Whisper transcript dict with 'words' and/or 'segments'
        clip_start: Start time in original video
        clip_end: End time in original video
        output_path: Path to write .ass file
        max_chars_per_line: Max characters per line (default 32)
        max_lines: Max lines to display (default 2)
        font_size: Font size in pixels (default 56)
        style: "viral" (green highlight), "minimal", or "bold"
        position: "bottom" or "center"
        video_width: Output video width (default 1080)
        video_height: Output video height (default 1920)
        
    Returns:
        Path to generated .ass file
    """
    # Generate header
    header = generate_ass_header(video_width, video_height, style, font_size, position)
    
    # Generate events based on available data
    words = transcript.get("words", [])
    segments = transcript.get("segments", [])
    
    if style == "viral" and words:
        # Word-by-word display for viral style
        events = generate_word_by_word_events(
            words, clip_start, clip_end, style, max_chars_per_line, max_lines
        )
    elif segments:
        # Segment-based display for other styles
        events = generate_segment_events(
            segments, clip_start, clip_end, max_chars_per_line, max_lines
        )
    elif words:
        # Fall back to word-based if no segments
        events = generate_word_by_word_events(
            words, clip_start, clip_end, style, max_chars_per_line, max_lines
        )
    else:
        events = []
    
    # Write file
    content = header + "\n".join(events)
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)
    
    return output_path


# Style-specific color presets
CAPTION_STYLES = {
    "viral": {
        "primary_color": "&H00FFFFFF",    # White
        "highlight_color": "&H0000FF00",   # Green
        "outline_color": "&H00000000",     # Black
        "shadow_color": "&H96000000",      # Semi-transparent black
        "outline": 4,
        "shadow": 2,
    },
    "minimal": {
        "primary_color": "&H00FFFFFF",    # White
        "highlight_color": "&H00FFFFFF",   # White
        "outline_color": "&H00000000",     # Black
        "shadow_color": "&H64000000",      # Light shadow
        "outline": 2,
        "shadow": 1,
    },
    "bold": {
        "primary_color": "&H00FFFFFF",    # White
        "highlight_color": "&H00FFFFFF",   # White
        "outline_color": "&H00000000",     # Black
        "shadow_color": "&H96000000",      # Semi-transparent black
        "outline": 5,
        "shadow": 3,
    },
}


def get_style_colors(style: str) -> Dict:
    """Get color preset for a caption style."""
    return CAPTION_STYLES.get(style, CAPTION_STYLES["viral"])

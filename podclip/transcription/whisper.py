"""
Whisper Transcription

Uses OpenAI Whisper API for transcription with word-level timestamps.
The transcript is the SINGLE SOURCE OF TRUTH for the entire pipeline.

Cost: ~$0.006/minute = ~$0.36/hour
"""

import os
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Word:
    """A single word with timestamp."""
    word: str
    start: float  # seconds
    end: float    # seconds


@dataclass
class Segment:
    """A segment (usually a sentence) with timestamp."""
    text: str
    start: float  # seconds
    end: float    # seconds


@dataclass
class Transcript:
    """Complete transcript with word and segment level timestamps."""
    text: str                        # Full transcript text
    words: List[Word] = field(default_factory=list)      # Word-level timestamps
    segments: List[Segment] = field(default_factory=list)  # Segment-level timestamps
    duration: float = 0.0            # Audio duration
    
    def get_words_in_range(self, start: float, end: float) -> List[Word]:
        """Get words that fall within a time range."""
        return [w for w in self.words if w.start >= start and w.end <= end]
    
    def get_segments_in_range(self, start: float, end: float) -> List[Segment]:
        """Get segments that overlap with a time range."""
        return [s for s in self.segments if s.end > start and s.start < end]
    
    def get_text_in_range(self, start: float, end: float) -> str:
        """Get transcript text for a time range."""
        words = self.get_words_in_range(start, end)
        return ' '.join(w.word for w in words)


def transcribe(
    audio_path: str,
    api_key: Optional[str] = None,
    language: str = "en"
) -> Transcript:
    """
    Transcribe audio using OpenAI Whisper API.
    
    Args:
        audio_path: Path to audio file (WAV recommended, or MP3)
        api_key: OpenAI API key (or set OPENAI_API_KEY env var)
        language: Language code (default "en")
        
    Returns:
        Transcript with word and segment timestamps
    """
    api_key = api_key or os.environ.get("OPENAI_API_KEY")
    
    if not api_key:
        raise ValueError(
            "OpenAI API key required. Set OPENAI_API_KEY environment variable "
            "or pass api_key parameter."
        )
    
    try:
        from openai import OpenAI
    except ImportError:
        raise ImportError("openai package not installed. Run: pip install openai")
    
    # Check file size - Whisper API has 25MB limit
    file_size = os.path.getsize(audio_path)
    max_size = 25 * 1024 * 1024  # 25MB
    
    if file_size > max_size:
        raise ValueError(
            f"Audio file too large ({file_size / 1024 / 1024:.1f}MB). "
            f"Whisper API limit is 25MB. Consider splitting the audio."
        )
    
    client = OpenAI(api_key=api_key)
    
    with open(audio_path, 'rb') as audio_file:
        response = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language=language,
            response_format="verbose_json",
            timestamp_granularities=["word", "segment"]
        )
    
    # Parse response into dataclasses
    words = []
    if hasattr(response, 'words') and response.words:
        for w in response.words:
            word_text = w.word if hasattr(w, 'word') else w.get('word', '')
            word_start = w.start if hasattr(w, 'start') else w.get('start', 0)
            word_end = w.end if hasattr(w, 'end') else w.get('end', 0)
            words.append(Word(word=word_text, start=word_start, end=word_end))
    
    segments = []
    if hasattr(response, 'segments') and response.segments:
        for s in response.segments:
            seg_text = s.text if hasattr(s, 'text') else s.get('text', '')
            seg_start = s.start if hasattr(s, 'start') else s.get('start', 0)
            seg_end = s.end if hasattr(s, 'end') else s.get('end', 0)
            segments.append(Segment(text=seg_text.strip(), start=seg_start, end=seg_end))
    
    # Calculate duration from last word/segment
    duration = 0.0
    if words:
        duration = max(w.end for w in words)
    elif segments:
        duration = max(s.end for s in segments)
    
    return Transcript(
        text=response.text if hasattr(response, 'text') else '',
        words=words,
        segments=segments,
        duration=duration
    )


def load_transcript_from_json(data: dict) -> Transcript:
    """
    Load a transcript from a JSON dict (e.g., from cache).
    
    Args:
        data: Dictionary with 'text', 'words', 'segments' keys
        
    Returns:
        Transcript object
    """
    words = [
        Word(word=w['word'], start=w['start'], end=w['end'])
        for w in data.get('words', [])
    ]
    
    segments = [
        Segment(text=s['text'], start=s['start'], end=s['end'])
        for s in data.get('segments', [])
    ]
    
    return Transcript(
        text=data.get('text', ''),
        words=words,
        segments=segments,
        duration=data.get('duration', 0.0)
    )


def transcript_to_json(transcript: Transcript) -> dict:
    """
    Convert transcript to JSON-serializable dict.
    
    Args:
        transcript: Transcript object
        
    Returns:
        Dictionary suitable for JSON serialization
    """
    return {
        'text': transcript.text,
        'words': [
            {'word': w.word, 'start': w.start, 'end': w.end}
            for w in transcript.words
        ],
        'segments': [
            {'text': s.text, 'start': s.start, 'end': s.end}
            for s in transcript.segments
        ],
        'duration': transcript.duration
    }

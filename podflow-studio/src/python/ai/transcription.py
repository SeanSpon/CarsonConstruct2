"""
Whisper API Transcription

Uses OpenAI Whisper API for transcription with word-level timestamps.
Cost: ~$0.006/minute = ~$0.36/hour
"""

import os
from typing import Dict, List, Optional

def transcribe_with_whisper(audio_path: str, api_key: str) -> Dict:
    """
    Transcribe audio using OpenAI Whisper API.
    
    Args:
        audio_path: Path to audio file (WAV, MP3, etc.)
        api_key: OpenAI API key
    
    Returns:
        Dictionary with text, words (with timestamps), and segments
    """
    try:
        from openai import OpenAI, AuthenticationError, RateLimitError, APIConnectionError
    except ImportError:
        raise ImportError("openai package not installed. Run: pip install openai")
    
    # Validate API key before making request
    api_key_stripped = api_key.strip() if api_key else ""
    if not api_key_stripped or len(api_key_stripped) < 20:
        print(f"TRANSCRIPTION: API key appears invalid (too short), skipping", flush=True)
        return {
            'text': '',
            'words': [],
            'segments': [],
            'error': 'API key invalid or missing'
        }
    
    client = OpenAI(api_key=api_key_stripped)
    
    # Check file size - Whisper API has 25MB limit
    file_size = os.path.getsize(audio_path)
    max_size = 25 * 1024 * 1024  # 25MB
    
    if file_size > max_size:
        # For large files, we'd need to split - for now, skip transcription
        print(f"TRANSCRIPTION: Audio file too large ({file_size / 1024 / 1024:.1f}MB > 25MB limit)", flush=True)
        return {
            'text': '',
            'words': [],
            'segments': [],
            'error': 'Audio file too large for Whisper API (>25MB)'
        }
    
    with open(audio_path, 'rb') as audio_file:
        try:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                timestamp_granularities=["word", "segment"]
            )
        except AuthenticationError:
            print(f"TRANSCRIPTION: Invalid API key", flush=True)
            return {
                'text': '',
                'words': [],
                'segments': [],
                'error': 'Invalid API key - check your OpenAI API key'
            }
        except RateLimitError:
            print(f"TRANSCRIPTION: Rate limit exceeded", flush=True)
            return {
                'text': '',
                'words': [],
                'segments': [],
                'error': 'Rate limit exceeded - try again later'
            }
        except APIConnectionError:
            print(f"TRANSCRIPTION: Connection error", flush=True)
            return {
                'text': '',
                'words': [],
                'segments': [],
                'error': 'Connection error - check your internet'
            }
        except Exception as e:
            print(f"TRANSCRIPTION: Unexpected error ({type(e).__name__}): {e}", flush=True)
            return {
                'text': '',
                'words': [],
                'segments': [],
                'error': str(e)
            }
    
    # Extract data
    result = {
        'text': transcript.text if hasattr(transcript, 'text') else '',
        'words': [],
        'segments': []
    }
    
    # Get word-level timestamps if available
    if hasattr(transcript, 'words') and transcript.words:
        result['words'] = [
            {
                'word': w.word if hasattr(w, 'word') else w.get('word', ''),
                'start': w.start if hasattr(w, 'start') else w.get('start', 0),
                'end': w.end if hasattr(w, 'end') else w.get('end', 0)
            }
            for w in transcript.words
        ]
    
    # Get segment-level timestamps
    if hasattr(transcript, 'segments') and transcript.segments:
        result['segments'] = [
            {
                'text': s.text if hasattr(s, 'text') else s.get('text', ''),
                'start': s.start if hasattr(s, 'start') else s.get('start', 0),
                'end': s.end if hasattr(s, 'end') else s.get('end', 0)
            }
            for s in transcript.segments
        ]
    
    return result


def get_transcript_for_clip(transcript: Dict, start_time: float, end_time: float) -> str:
    """
    Extract transcript text for a specific time range.
    
    Args:
        transcript: Full transcript with words
        start_time: Clip start in seconds
        end_time: Clip end in seconds
    
    Returns:
        Transcript text for the time range
    """
    if not transcript or not transcript.get('words'):
        # Try to use segments instead
        if transcript and transcript.get('segments'):
            matching_segments = [
                s['text'] for s in transcript['segments']
                if s['start'] >= start_time - 1 and s['end'] <= end_time + 1
            ]
            return ' '.join(matching_segments).strip()
        return ''
    
    # Filter words within time range (with small buffer)
    matching_words = [
        w['word'] for w in transcript['words']
        if start_time - 0.5 <= w['start'] <= end_time + 0.5
    ]
    
    return ' '.join(matching_words).strip()

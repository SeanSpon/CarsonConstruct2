"""
Transcription Stage - Whisper transcription with word-level timestamps.

The transcript is the SINGLE SOURCE OF TRUTH for:
- Clip boundary detection (sentence boundaries)
- Caption generation (word timestamps)
- Speech density calculation
"""

from .whisper import transcribe, Transcript, Word, Segment

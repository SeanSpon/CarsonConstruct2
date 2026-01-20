"""
PodClip - Simple Deterministic Podcast Clip Generator

A tool that takes a long podcast video and outputs multiple short vertical clips with:
- Clean hard cuts
- Karaoke-style captions (word-level highlight)
- Optional angle switching (rule-based)
- Optional b-roll overlay (rule-based)
- FFmpeg-based export

Pipeline stages:
1. input/        - Load video, extract audio, validate
2. transcription/ - Whisper transcription (word-level timestamps)
3. detection/    - Deterministic clip candidate detection
4. captions/     - Build karaoke captions from word timestamps
5. editing/      - Angle switching and b-roll rules
6. export/       - Vertical 9:16 FFmpeg export with burned-in captions
"""

__version__ = "1.0.0"

"""
Export Stage - FFmpeg-based vertical video export.

Features:
- Vertical 9:16 (1080x1920) output
- Burned-in captions from ASS files
- Center crop for horizontal source
- Clean, deterministic output

FFmpeg only - no other dependencies.
"""

from .vertical import export_vertical_clip, export_batch, ExportSettings

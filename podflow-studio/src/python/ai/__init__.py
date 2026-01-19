"""
AI Enhancement Module

This module provides AI-powered clip analysis and enhancement.

Architecture:
    ┌─────────────────────────────────────────────────────────────────┐
    │                         ORCHESTRATOR                             │
    │  Coordinates the full AI pipeline: transcription → translation   │
    │  → thinking → final selection                                    │
    └───────────────────────────────┬─────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────────────┐
            │                       │                               │
            ▼                       ▼                               ▼
    ┌───────────────┐      ┌───────────────┐              ┌───────────────┐
    │  TRANSLATOR   │      │   THINKER     │              │  TRANSCRIBER  │
    │ ClipCard →    │      │ Select best   │              │ Audio → Text  │
    │ MeaningCard   │      │ clip set      │              │ + timestamps  │
    └───────────────┘      └───────────────┘              └───────────────┘
            │                       │                               │
            └───────────────────────┼───────────────────────────────┘
                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                     PROVIDER LAYER (Swappable)                   │
    ├─────────────┬─────────────┬─────────────┬─────────────┬─────────┤
    │   OpenAI    │   Gemini    │  Anthropic  │    Local    │ Custom  │
    │  GPT-4o     │   1.5 Pro   │   Claude    │   Ollama    │  Train  │
    │  Whisper    │   Flash     │   Sonnet    │   Llama     │  Your   │
    └─────────────┴─────────────┴─────────────┴─────────────┴─────────┘

Usage:
    # Basic usage with orchestrator
    from ai import run_ai_enhancement
    
    enhanced_clips = run_ai_enhancement(
        candidates=detected_clips,
        transcript=transcript_data,
        settings={"openai_api_key": "sk-...", "ai_provider": "openai"}
    )
    
    # Direct provider usage
    from ai.providers import get_provider
    
    provider = get_provider("gemini", api_key="...")
    result = provider.complete("Analyze this", schema={...})

Supported Providers:
    - openai: GPT-4o, GPT-4o-mini (default), Whisper transcription
    - gemini: Gemini 1.5 Pro, 1.5 Flash (free tier available)
    - anthropic: Claude 3.5 Sonnet, Opus, Haiku
    - local: Ollama (Llama 3, Mistral, etc.) - free, offline, private
"""

# Core orchestration
from .orchestrator import run_ai_enhancement

# Schema types
from .schemas import (
    ClipCard,
    MeaningCard,
    FinalDecision,
    validate_clipcard,
    validate_meaningcard,
    validate_finaldecision,
)

# Direct function access
from .translator import translate_clip
from .thinker import select_best_set
from .transcription import transcribe_with_whisper, get_transcript_for_clip

# Provider layer (import explicitly to avoid circular imports)
# from .providers import get_provider, ProviderType, list_available_providers

__all__ = [
    # Main entry point
    "run_ai_enhancement",
    # Schema types
    "ClipCard",
    "MeaningCard",
    "FinalDecision",
    "validate_clipcard",
    "validate_meaningcard",
    "validate_finaldecision",
    # Functions
    "translate_clip",
    "select_best_set",
    "transcribe_with_whisper",
    "get_transcript_for_clip",
]

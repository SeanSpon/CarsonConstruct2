"""
OpenAI Provider Implementation

Supports:
- GPT-4o, GPT-4o-mini, GPT-4-turbo, GPT-3.5-turbo
- Whisper API for transcription
- Structured JSON output
- Function calling

Cost Reference (as of 2024):
- gpt-4o: $5.00/1M input, $15.00/1M output
- gpt-4o-mini: $0.15/1M input, $0.60/1M output
- whisper-1: $0.006/minute
"""

import json
import os
from typing import Any, Dict, List, Optional

from .base import (
    AIProvider,
    AIProviderError,
    AuthenticationError,
    CompletionResult,
    ModelInfo,
    ModelNotFoundError,
    ProviderCapability,
    RateLimitError,
    TranscriptionResult,
)


# Available OpenAI models with their capabilities
OPENAI_MODELS = [
    ModelInfo(
        name="gpt-4o",
        provider="openai",
        capabilities=[
            ProviderCapability.TEXT_COMPLETION,
            ProviderCapability.STRUCTURED_OUTPUT,
            ProviderCapability.VISION,
            ProviderCapability.STREAMING,
        ],
        max_tokens=4096,
        supports_json_mode=True,
        supports_function_calling=True,
        cost_per_1k_input=0.005,
        cost_per_1k_output=0.015,
        context_window=128000,
        description="Most capable GPT-4 model with vision support",
    ),
    ModelInfo(
        name="gpt-4o-mini",
        provider="openai",
        capabilities=[
            ProviderCapability.TEXT_COMPLETION,
            ProviderCapability.STRUCTURED_OUTPUT,
            ProviderCapability.VISION,
            ProviderCapability.STREAMING,
        ],
        max_tokens=16384,
        supports_json_mode=True,
        supports_function_calling=True,
        cost_per_1k_input=0.00015,
        cost_per_1k_output=0.0006,
        context_window=128000,
        description="Fast and affordable GPT-4 class model",
    ),
    ModelInfo(
        name="gpt-4-turbo",
        provider="openai",
        capabilities=[
            ProviderCapability.TEXT_COMPLETION,
            ProviderCapability.STRUCTURED_OUTPUT,
            ProviderCapability.VISION,
            ProviderCapability.STREAMING,
        ],
        max_tokens=4096,
        supports_json_mode=True,
        supports_function_calling=True,
        cost_per_1k_input=0.01,
        cost_per_1k_output=0.03,
        context_window=128000,
        description="GPT-4 Turbo with vision capabilities",
    ),
    ModelInfo(
        name="gpt-3.5-turbo",
        provider="openai",
        capabilities=[
            ProviderCapability.TEXT_COMPLETION,
            ProviderCapability.STRUCTURED_OUTPUT,
            ProviderCapability.STREAMING,
        ],
        max_tokens=4096,
        supports_json_mode=True,
        supports_function_calling=True,
        cost_per_1k_input=0.0005,
        cost_per_1k_output=0.0015,
        context_window=16385,
        description="Fast and cost-effective for simple tasks",
    ),
    ModelInfo(
        name="whisper-1",
        provider="openai",
        capabilities=[ProviderCapability.TRANSCRIPTION],
        max_tokens=0,
        cost_per_1k_input=0.0001,  # ~$0.006/minute
        context_window=0,
        description="Speech-to-text transcription",
    ),
]


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    """Extract JSON from potentially markdown-wrapped response."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        parts = cleaned.split("```")
        if len(parts) > 1:
            cleaned = parts[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        return json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError:
        return None


class OpenAIProvider(AIProvider):
    """
    OpenAI API provider implementation.
    
    Example:
        provider = OpenAIProvider(api_key="sk-...")
        result = provider.complete(
            prompt="Analyze this text",
            schema={"type": "object", ...}
        )
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        organization: Optional[str] = None,
        base_url: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize OpenAI provider.
        
        Args:
            api_key: OpenAI API key (or set OPENAI_API_KEY env var)
            organization: Optional organization ID
            base_url: Optional custom base URL (for Azure or proxies)
        """
        # Try environment variable if no key provided
        api_key = api_key or os.environ.get("OPENAI_API_KEY")
        super().__init__(api_key, **kwargs)
        
        self.organization = organization
        self.base_url = base_url
        self._client = None
    
    @property
    def name(self) -> str:
        return "openai"
    
    @property
    def default_model(self) -> str:
        return "gpt-4o-mini"
    
    def get_available_models(self) -> List[ModelInfo]:
        return OPENAI_MODELS.copy()
    
    def _get_client(self):
        """Lazy-load the OpenAI client."""
        if self._client is None:
            try:
                from openai import OpenAI
            except ImportError:
                raise AIProviderError(
                    "openai package not installed. Run: pip install openai",
                    provider=self.name,
                    recoverable=False,
                )
            
            client_kwargs = {}
            if self.api_key:
                client_kwargs["api_key"] = self.api_key
            if self.organization:
                client_kwargs["organization"] = self.organization
            if self.base_url:
                client_kwargs["base_url"] = self.base_url
            
            self._client = OpenAI(**client_kwargs)
        
        return self._client
    
    def complete(
        self,
        prompt: str,
        schema: Optional[Dict[str, Any]] = None,
        model: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 500,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> CompletionResult:
        """
        Generate a completion using OpenAI's API.
        
        Args:
            prompt: The user prompt
            schema: Optional JSON schema for structured output
            model: Model name (defaults to gpt-4o-mini)
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            system_prompt: Optional system message
            **kwargs: Additional OpenAI-specific parameters
            
        Returns:
            CompletionResult with content and parsed JSON
        """
        model = model or self.default_model
        client = self._get_client()
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        request_kwargs = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            **kwargs,
        }
        
        # Use JSON mode if schema provided and model supports it
        if schema:
            request_kwargs["response_format"] = {"type": "json_object"}
        
        try:
            response = client.chat.completions.create(**request_kwargs)
        except Exception as e:
            error_str = str(e).lower()
            if "rate limit" in error_str or "429" in str(e):
                raise RateLimitError(
                    f"OpenAI rate limit exceeded: {e}",
                    provider=self.name,
                )
            elif "authentication" in error_str or "401" in str(e):
                raise AuthenticationError(
                    f"OpenAI authentication failed: {e}",
                    provider=self.name,
                )
            elif "model" in error_str and "not found" in error_str:
                raise ModelNotFoundError(
                    f"Model not found: {e}",
                    provider=self.name,
                    model=model,
                )
            raise AIProviderError(
                f"OpenAI API error: {e}",
                provider=self.name,
            )
        
        content = response.choices[0].message.content or ""
        parsed_json = None
        
        if schema:
            parsed_json = _extract_json(content)
        
        usage = None
        if response.usage:
            usage = {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            }
        
        return CompletionResult(
            content=content,
            parsed_json=parsed_json,
            model=model,
            usage=usage,
            finish_reason=response.choices[0].finish_reason or "",
            raw_response=response,
        )
    
    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        **kwargs
    ) -> TranscriptionResult:
        """
        Transcribe audio using Whisper API.
        
        Args:
            audio_path: Path to audio file (WAV, MP3, etc.)
            language: Optional language code (e.g., 'en', 'es')
            **kwargs: Additional parameters
            
        Returns:
            TranscriptionResult with text, words, and segments
        """
        client = self._get_client()
        
        # Check file size - Whisper API has 25MB limit
        file_size = os.path.getsize(audio_path)
        max_size = 25 * 1024 * 1024  # 25MB
        
        if file_size > max_size:
            return TranscriptionResult(
                text="",
                words=[],
                segments=[],
                error="Audio file too large for Whisper API (>25MB)",
            )
        
        try:
            with open(audio_path, "rb") as audio_file:
                request_kwargs = {
                    "model": "whisper-1",
                    "file": audio_file,
                    "response_format": "verbose_json",
                    "timestamp_granularities": ["word", "segment"],
                }
                if language:
                    request_kwargs["language"] = language
                
                transcript = client.audio.transcriptions.create(**request_kwargs)
        except Exception as e:
            error_str = str(e).lower()
            if "rate limit" in error_str:
                raise RateLimitError(
                    f"Whisper rate limit exceeded: {e}",
                    provider=self.name,
                )
            elif "authentication" in error_str:
                raise AuthenticationError(
                    f"OpenAI authentication failed: {e}",
                    provider=self.name,
                )
            return TranscriptionResult(
                text="",
                words=[],
                segments=[],
                error=str(e),
            )
        
        # Extract word-level timestamps
        words = []
        if hasattr(transcript, "words") and transcript.words:
            words = [
                {
                    "word": w.word if hasattr(w, "word") else w.get("word", ""),
                    "start": w.start if hasattr(w, "start") else w.get("start", 0),
                    "end": w.end if hasattr(w, "end") else w.get("end", 0),
                }
                for w in transcript.words
            ]
        
        # Extract segment-level timestamps
        segments = []
        if hasattr(transcript, "segments") and transcript.segments:
            segments = [
                {
                    "text": s.text if hasattr(s, "text") else s.get("text", ""),
                    "start": s.start if hasattr(s, "start") else s.get("start", 0),
                    "end": s.end if hasattr(s, "end") else s.get("end", 0),
                }
                for s in transcript.segments
            ]
        
        # Calculate duration from segments
        duration = 0.0
        if segments:
            duration = max(s.get("end", 0) for s in segments)
        
        return TranscriptionResult(
            text=transcript.text if hasattr(transcript, "text") else "",
            words=words,
            segments=segments,
            language=language or "",
            duration=duration,
        )
    
    def validate_api_key(self) -> bool:
        """Validate the API key by listing models."""
        if not self.api_key:
            raise AuthenticationError(
                "No OpenAI API key provided",
                provider=self.name,
            )
        
        try:
            client = self._get_client()
            # Make a minimal request to validate
            client.models.list()
            return True
        except Exception as e:
            raise AuthenticationError(
                f"Invalid OpenAI API key: {e}",
                provider=self.name,
            )

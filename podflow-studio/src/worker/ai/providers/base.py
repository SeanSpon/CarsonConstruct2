"""
Base AI Provider Abstract Class

This module defines the abstract interface that all AI providers must implement.
This allows the application to swap between OpenAI, Gemini, Claude, local models,
or custom trained models without changing application code.

Architecture:
    ┌─────────────────────────────────────────────────────────────────┐
    │                        AIProvider (Abstract)                     │
    │  - complete(prompt, schema) → structured JSON                    │
    │  - transcribe(audio_path) → transcript dict                      │
    │  - get_model_info() → capabilities                               │
    └───────────────────────────┬─────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────────────────┐
        │           │           │           │           │           │
        ▼           ▼           ▼           ▼           ▼           ▼
    OpenAI      Gemini    Anthropic     Local      Custom     Future
   Provider    Provider   Provider    Provider   Provider   Providers
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional, Type


class ProviderCapability(Enum):
    """Capabilities that providers may support."""
    
    TEXT_COMPLETION = "text_completion"
    STRUCTURED_OUTPUT = "structured_output"
    TRANSCRIPTION = "transcription"
    VISION = "vision"
    EMBEDDING = "embedding"
    STREAMING = "streaming"


@dataclass
class ModelInfo:
    """Information about a specific model."""
    
    name: str
    provider: str
    capabilities: List[ProviderCapability]
    max_tokens: int
    supports_json_mode: bool = False
    supports_function_calling: bool = False
    cost_per_1k_input: float = 0.0  # USD
    cost_per_1k_output: float = 0.0  # USD
    context_window: int = 4096
    description: str = ""


@dataclass
class CompletionResult:
    """Standardized result from a completion request."""
    
    content: str
    parsed_json: Optional[Dict[str, Any]] = None
    model: str = ""
    usage: Optional[Dict[str, int]] = None  # tokens used
    finish_reason: str = ""
    raw_response: Optional[Any] = None


@dataclass
class TranscriptionResult:
    """Standardized result from a transcription request."""
    
    text: str
    words: List[Dict[str, Any]]  # [{word, start, end}, ...]
    segments: List[Dict[str, Any]]  # [{text, start, end}, ...]
    language: str = ""
    duration: float = 0.0
    error: Optional[str] = None


class AIProviderError(Exception):
    """Base exception for AI provider errors."""
    
    def __init__(self, message: str, provider: str = "", recoverable: bool = True):
        super().__init__(message)
        self.provider = provider
        self.recoverable = recoverable


class RateLimitError(AIProviderError):
    """Rate limit exceeded - should retry with backoff."""
    
    def __init__(self, message: str, provider: str = "", retry_after: Optional[float] = None):
        super().__init__(message, provider, recoverable=True)
        self.retry_after = retry_after


class AuthenticationError(AIProviderError):
    """API key invalid or missing."""
    
    def __init__(self, message: str, provider: str = ""):
        super().__init__(message, provider, recoverable=False)


class ModelNotFoundError(AIProviderError):
    """Requested model not available."""
    
    def __init__(self, message: str, provider: str = "", model: str = ""):
        super().__init__(message, provider, recoverable=False)
        self.model = model


class AIProvider(ABC):
    """
    Abstract base class for AI providers.
    
    All AI providers (OpenAI, Gemini, Anthropic, Local, Custom) must
    implement this interface to be usable by the application.
    
    Example Usage:
        provider = get_provider("openai", api_key="sk-...")
        result = provider.complete(
            prompt="Analyze this clip",
            schema={"type": "object", "properties": {...}}
        )
        
    For transcription:
        result = provider.transcribe("audio.wav")
        print(result.text)
    """
    
    def __init__(self, api_key: Optional[str] = None, **kwargs):
        """
        Initialize the provider.
        
        Args:
            api_key: API key for the provider (if required)
            **kwargs: Provider-specific configuration
        """
        self.api_key = api_key
        self.config = kwargs
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Return the provider name (e.g., 'openai', 'gemini')."""
        pass
    
    @property
    @abstractmethod
    def default_model(self) -> str:
        """Return the default model for this provider."""
        pass
    
    @abstractmethod
    def get_available_models(self) -> List[ModelInfo]:
        """
        Get list of available models for this provider.
        
        Returns:
            List of ModelInfo objects describing available models
        """
        pass
    
    @abstractmethod
    def complete(
        self,
        prompt: str,
        schema: Optional[Dict[str, Any]] = None,
        model: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 500,
        **kwargs
    ) -> CompletionResult:
        """
        Generate a completion from the model.
        
        Args:
            prompt: The input prompt
            schema: Optional JSON schema for structured output
            model: Model to use (defaults to provider's default)
            temperature: Sampling temperature (0.0-2.0)
            max_tokens: Maximum tokens to generate
            **kwargs: Provider-specific parameters
            
        Returns:
            CompletionResult with content and optional parsed JSON
            
        Raises:
            AIProviderError: On API errors
            RateLimitError: On rate limiting
            AuthenticationError: On auth failures
        """
        pass
    
    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        **kwargs
    ) -> TranscriptionResult:
        """
        Transcribe audio to text with timestamps.
        
        Args:
            audio_path: Path to audio file
            language: Optional language hint (e.g., 'en', 'es')
            **kwargs: Provider-specific parameters
            
        Returns:
            TranscriptionResult with text, words, and segments
            
        Raises:
            AIProviderError: On API errors
            NotImplementedError: If provider doesn't support transcription
        """
        raise NotImplementedError(
            f"{self.name} provider does not support transcription"
        )
    
    def supports(self, capability: ProviderCapability) -> bool:
        """
        Check if this provider supports a specific capability.
        
        Args:
            capability: The capability to check
            
        Returns:
            True if supported, False otherwise
        """
        models = self.get_available_models()
        if not models:
            return False
        # Check if any model supports this capability
        return any(capability in model.capabilities for model in models)
    
    def validate_api_key(self) -> bool:
        """
        Validate the API key by making a minimal request.
        
        Returns:
            True if API key is valid
            
        Raises:
            AuthenticationError: If API key is invalid
        """
        if not self.api_key:
            raise AuthenticationError(
                "No API key provided",
                provider=self.name
            )
        # Subclasses should override to actually validate
        return True
    
    def estimate_cost(
        self,
        input_tokens: int,
        output_tokens: int,
        model: Optional[str] = None
    ) -> float:
        """
        Estimate the cost for a request.
        
        Args:
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            model: Model to use for pricing
            
        Returns:
            Estimated cost in USD
        """
        model_name = model or self.default_model
        models = self.get_available_models()
        model_info = next((m for m in models if m.name == model_name), None)
        
        if not model_info:
            return 0.0
        
        input_cost = (input_tokens / 1000) * model_info.cost_per_1k_input
        output_cost = (output_tokens / 1000) * model_info.cost_per_1k_output
        return input_cost + output_cost


# Type alias for provider factory functions
ProviderFactory = Type[AIProvider]

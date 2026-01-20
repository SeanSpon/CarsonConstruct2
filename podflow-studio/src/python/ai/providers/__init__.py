"""
AI Provider Factory

This module provides a unified interface for creating AI providers.
The factory function `get_provider()` allows you to switch between
providers (OpenAI, Gemini, Anthropic, Local) without changing application code.

Usage:
    from ai.providers import get_provider, ProviderType
    
    # Create a provider
    provider = get_provider("openai", api_key="sk-...")
    
    # Use it
    result = provider.complete(prompt="Hello", schema={...})
    
    # Or with enum
    provider = get_provider(ProviderType.GEMINI, api_key="...")

Architecture:
    ┌──────────────────────────────────────────────────────────────┐
    │                     get_provider()                            │
    │  Factory function that creates the appropriate provider       │
    └──────────────────────────────┬───────────────────────────────┘
                                   │
           ┌───────────────────────┼───────────────────────┐
           │                       │                       │
           ▼                       ▼                       ▼
    ┌─────────────┐         ┌─────────────┐        ┌─────────────┐
    │   OpenAI    │         │   Gemini    │        │    Local    │
    │  Provider   │         │  Provider   │        │  Provider   │
    └─────────────┘         └─────────────┘        └─────────────┘
"""

from enum import Enum
from typing import Optional, Dict, Any

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


class ProviderType(Enum):
    """Supported AI provider types."""
    
    OPENAI = "openai"
    GEMINI = "gemini"
    ANTHROPIC = "anthropic"
    LOCAL = "local"
    
    @classmethod
    def from_string(cls, value: str) -> "ProviderType":
        """Convert string to ProviderType."""
        value_lower = value.lower().strip()
        for provider in cls:
            if provider.value == value_lower:
                return provider
        raise ValueError(f"Unknown provider type: {value}")


def get_provider(
    provider_type: str | ProviderType,
    api_key: Optional[str] = None,
    **kwargs
) -> AIProvider:
    """
    Factory function to create an AI provider.
    
    Args:
        provider_type: Provider to use ("openai", "gemini", "anthropic", "local")
                      or a ProviderType enum value
        api_key: API key for the provider (not needed for local)
        **kwargs: Provider-specific configuration options
        
    Returns:
        An initialized AIProvider instance
        
    Raises:
        ValueError: If provider_type is unknown
        AIProviderError: If provider initialization fails
        
    Examples:
        # OpenAI
        provider = get_provider("openai", api_key="sk-...")
        
        # Gemini (uses GOOGLE_API_KEY env var if not provided)
        provider = get_provider("gemini")
        
        # Anthropic
        provider = get_provider("anthropic", api_key="...")
        
        # Local (Ollama - no API key needed)
        provider = get_provider("local")
        
        # With custom host for Ollama
        provider = get_provider("local", host="http://192.168.1.100:11434")
    """
    # Convert string to enum if needed
    if isinstance(provider_type, str):
        try:
            provider_type = ProviderType.from_string(provider_type)
        except ValueError as e:
            raise ValueError(
                f"Unknown provider: '{provider_type}'. "
                f"Supported: {[p.value for p in ProviderType]}"
            ) from e
    
    # Import and instantiate the appropriate provider
    if provider_type == ProviderType.OPENAI:
        from .openai_provider import OpenAIProvider
        return OpenAIProvider(api_key=api_key, **kwargs)
    
    elif provider_type == ProviderType.GEMINI:
        from .gemini_provider import GeminiProvider
        return GeminiProvider(api_key=api_key, **kwargs)
    
    elif provider_type == ProviderType.ANTHROPIC:
        from .anthropic_provider import AnthropicProvider
        return AnthropicProvider(api_key=api_key, **kwargs)
    
    elif provider_type == ProviderType.LOCAL:
        from .local_provider import LocalProvider
        return LocalProvider(**kwargs)
    
    else:
        raise ValueError(f"Unsupported provider type: {provider_type}")


def get_provider_for_settings(settings: Dict[str, Any]) -> AIProvider:
    """
    Create a provider based on application settings.
    
    This is a convenience function that reads provider configuration
    from a settings dictionary (e.g., from the app's config).
    
    Args:
        settings: Dictionary containing:
            - ai_provider: Provider name ("openai", "gemini", etc.)
            - openai_api_key: OpenAI API key (if using OpenAI)
            - gemini_api_key: Gemini API key (if using Gemini)
            - anthropic_api_key: Anthropic API key (if using Anthropic)
            - ollama_host: Ollama server URL (if using local)
            
    Returns:
        Configured AIProvider instance
    """
    provider_name = settings.get("ai_provider", "openai")
    
    # Get the appropriate API key
    api_key = None
    extra_kwargs = {}
    
    if provider_name == "openai":
        api_key = settings.get("openai_api_key")
    elif provider_name == "gemini":
        api_key = settings.get("gemini_api_key") or settings.get("google_api_key")
    elif provider_name == "anthropic":
        api_key = settings.get("anthropic_api_key")
    elif provider_name == "local":
        host = settings.get("ollama_host")
        if host:
            extra_kwargs["host"] = host
    
    return get_provider(provider_name, api_key=api_key, **extra_kwargs)


def list_available_providers() -> Dict[str, Dict[str, Any]]:
    """
    Get information about all available providers.
    
    Returns:
        Dictionary mapping provider names to their info:
        {
            "openai": {
                "name": "OpenAI",
                "description": "...",
                "requires_api_key": True,
                "env_var": "OPENAI_API_KEY",
                "models": [...]
            },
            ...
        }
    """
    return {
        "openai": {
            "name": "OpenAI",
            "description": "GPT-4o and GPT-4o-mini models with Whisper transcription",
            "requires_api_key": True,
            "env_var": "OPENAI_API_KEY",
            "website": "https://platform.openai.com",
            "capabilities": ["completion", "transcription", "vision"],
        },
        "gemini": {
            "name": "Google Gemini",
            "description": "Gemini 1.5 Pro/Flash with up to 1M token context",
            "requires_api_key": True,
            "env_var": "GOOGLE_API_KEY",
            "website": "https://makersuite.google.com/app/apikey",
            "capabilities": ["completion", "vision"],
            "free_tier": True,
        },
        "anthropic": {
            "name": "Anthropic Claude",
            "description": "Claude 3.5 Sonnet, Opus, and Haiku models",
            "requires_api_key": True,
            "env_var": "ANTHROPIC_API_KEY",
            "website": "https://console.anthropic.com",
            "capabilities": ["completion", "vision"],
        },
        "local": {
            "name": "Local (Ollama)",
            "description": "Run models locally - Llama 3, Mistral, Phi, etc.",
            "requires_api_key": False,
            "website": "https://ollama.ai",
            "capabilities": ["completion", "transcription"],
            "free": True,
            "privacy": "Data never leaves your device",
        },
    }


# Re-export common types for convenience
__all__ = [
    # Factory functions
    "get_provider",
    "get_provider_for_settings",
    "list_available_providers",
    # Types
    "ProviderType",
    "AIProvider",
    "CompletionResult",
    "TranscriptionResult",
    "ModelInfo",
    "ProviderCapability",
    # Exceptions
    "AIProviderError",
    "AuthenticationError",
    "RateLimitError",
    "ModelNotFoundError",
]

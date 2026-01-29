"""
Anthropic Claude Provider Implementation

Supports:
- Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
- Structured JSON output
- Vision capabilities
- Long context (200K tokens)

Benefits:
- Excellent reasoning and analysis
- Strong at following complex instructions
- Good for nuanced content evaluation

Cost Reference (as of 2024):
- Claude 3.5 Sonnet: $3.00/1M input, $15.00/1M output
- Claude 3 Opus: $15.00/1M input, $75.00/1M output
- Claude 3 Haiku: $0.25/1M input, $1.25/1M output
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


# Available Claude models
ANTHROPIC_MODELS = [
    ModelInfo(
        name="claude-3-5-sonnet-20241022",
        provider="anthropic",
        capabilities=[
            ProviderCapability.TEXT_COMPLETION,
            ProviderCapability.STRUCTURED_OUTPUT,
            ProviderCapability.VISION,
            ProviderCapability.STREAMING,
        ],
        max_tokens=8192,
        supports_json_mode=True,
        cost_per_1k_input=0.003,
        cost_per_1k_output=0.015,
        context_window=200000,
        description="Best balance of intelligence and speed",
    ),
    ModelInfo(
        name="claude-3-opus-20240229",
        provider="anthropic",
        capabilities=[
            ProviderCapability.TEXT_COMPLETION,
            ProviderCapability.STRUCTURED_OUTPUT,
            ProviderCapability.VISION,
            ProviderCapability.STREAMING,
        ],
        max_tokens=4096,
        supports_json_mode=True,
        cost_per_1k_input=0.015,
        cost_per_1k_output=0.075,
        context_window=200000,
        description="Most capable for complex tasks",
    ),
    ModelInfo(
        name="claude-3-haiku-20240307",
        provider="anthropic",
        capabilities=[
            ProviderCapability.TEXT_COMPLETION,
            ProviderCapability.STRUCTURED_OUTPUT,
            ProviderCapability.VISION,
            ProviderCapability.STREAMING,
        ],
        max_tokens=4096,
        supports_json_mode=True,
        cost_per_1k_input=0.00025,
        cost_per_1k_output=0.00125,
        context_window=200000,
        description="Fastest and most affordable Claude model",
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


class AnthropicProvider(AIProvider):
    """
    Anthropic Claude API provider implementation.
    
    Example:
        provider = AnthropicProvider(api_key="...")
        result = provider.complete(
            prompt="Analyze this clip content",
            schema={"type": "object", ...}
        )
    
    Note:
        Claude excels at nuanced content analysis and following
        complex multi-step instructions.
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize Anthropic provider.
        
        Args:
            api_key: Anthropic API key (or set ANTHROPIC_API_KEY env var)
        """
        api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        super().__init__(api_key, **kwargs)
        self._client = None
    
    @property
    def name(self) -> str:
        return "anthropic"
    
    @property
    def default_model(self) -> str:
        return "claude-3-haiku-20240307"
    
    def get_available_models(self) -> List[ModelInfo]:
        return ANTHROPIC_MODELS.copy()
    
    def _get_client(self):
        """Lazy-load the Anthropic client."""
        if self._client is None:
            try:
                from anthropic import Anthropic
            except ImportError:
                raise AIProviderError(
                    "anthropic package not installed. Run: pip install anthropic",
                    provider=self.name,
                    recoverable=False,
                )
            
            self._client = Anthropic(api_key=self.api_key)
        
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
        Generate a completion using Claude API.
        
        Args:
            prompt: The user prompt
            schema: Optional JSON schema for structured output
            model: Model name (defaults to claude-3-haiku)
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            system_prompt: Optional system message
            **kwargs: Additional Anthropic-specific parameters
            
        Returns:
            CompletionResult with content and parsed JSON
        """
        model_name = model or self.default_model
        client = self._get_client()
        
        # Build the messages
        messages = [{"role": "user", "content": prompt}]
        
        # If schema provided, add JSON instruction to system prompt
        system = system_prompt or ""
        if schema:
            json_instruction = (
                "\n\nYou must respond with valid JSON only. "
                "No markdown, no explanation, just the JSON object."
            )
            system = system + json_instruction if system else json_instruction.strip()
        
        request_kwargs = {
            "model": model_name,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        
        if system:
            request_kwargs["system"] = system
        
        try:
            response = client.messages.create(**request_kwargs)
        except Exception as e:
            error_str = str(e).lower()
            if "rate" in error_str or "429" in str(e):
                raise RateLimitError(
                    f"Anthropic rate limit exceeded: {e}",
                    provider=self.name,
                )
            elif "authentication" in error_str or "401" in str(e) or "api key" in error_str:
                raise AuthenticationError(
                    f"Anthropic authentication failed: {e}",
                    provider=self.name,
                )
            elif "model" in error_str and "not found" in error_str:
                raise ModelNotFoundError(
                    f"Model not found: {e}",
                    provider=self.name,
                    model=model_name,
                )
            raise AIProviderError(
                f"Anthropic API error: {e}",
                provider=self.name,
            )
        
        # Extract content
        content = ""
        if response.content:
            for block in response.content:
                if hasattr(block, "text"):
                    content += block.text
        
        parsed_json = None
        if schema:
            parsed_json = _extract_json(content)
        
        # Extract usage
        usage = None
        if response.usage:
            usage = {
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens,
                "total_tokens": response.usage.input_tokens + response.usage.output_tokens,
            }
        
        return CompletionResult(
            content=content,
            parsed_json=parsed_json,
            model=model_name,
            usage=usage,
            finish_reason=response.stop_reason or "",
            raw_response=response,
        )
    
    def validate_api_key(self) -> bool:
        """Validate the API key by making a minimal request."""
        if not self.api_key:
            raise AuthenticationError(
                "No Anthropic API key provided",
                provider=self.name,
            )
        
        try:
            client = self._get_client()
            # Make a minimal request to validate
            client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=10,
                messages=[{"role": "user", "content": "Hi"}],
            )
            return True
        except Exception as e:
            raise AuthenticationError(
                f"Invalid Anthropic API key: {e}",
                provider=self.name,
            )

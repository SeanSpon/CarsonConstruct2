"""
Google Gemini Provider Implementation

Supports:
- Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini Pro
- Structured JSON output
- Vision capabilities
- Long context (up to 1M tokens)

Benefits:
- Generous free tier (15 RPM, 1M tokens/day)
- Gemini Nano can run on-device (future)
- Strong reasoning capabilities

Cost Reference (as of 2024):
- Gemini 1.5 Pro: $3.50/1M input, $10.50/1M output
- Gemini 1.5 Flash: $0.075/1M input, $0.30/1M output
- Free tier available for development
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


# Available Gemini models
GEMINI_MODELS = [
    ModelInfo(
        name="gemini-1.5-pro",
        provider="gemini",
        capabilities=[
            ProviderCapability.TEXT_COMPLETION,
            ProviderCapability.STRUCTURED_OUTPUT,
            ProviderCapability.VISION,
            ProviderCapability.STREAMING,
        ],
        max_tokens=8192,
        supports_json_mode=True,
        cost_per_1k_input=0.0035,
        cost_per_1k_output=0.0105,
        context_window=1000000,  # 1M tokens!
        description="Most capable Gemini model with 1M context",
    ),
    ModelInfo(
        name="gemini-1.5-flash",
        provider="gemini",
        capabilities=[
            ProviderCapability.TEXT_COMPLETION,
            ProviderCapability.STRUCTURED_OUTPUT,
            ProviderCapability.VISION,
            ProviderCapability.STREAMING,
        ],
        max_tokens=8192,
        supports_json_mode=True,
        cost_per_1k_input=0.000075,
        cost_per_1k_output=0.0003,
        context_window=1000000,
        description="Fast and efficient, great for high-volume tasks",
    ),
    ModelInfo(
        name="gemini-pro",
        provider="gemini",
        capabilities=[
            ProviderCapability.TEXT_COMPLETION,
            ProviderCapability.STRUCTURED_OUTPUT,
            ProviderCapability.STREAMING,
        ],
        max_tokens=8192,
        supports_json_mode=True,
        cost_per_1k_input=0.0005,
        cost_per_1k_output=0.0015,
        context_window=32768,
        description="Balanced performance and cost",
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


class GeminiProvider(AIProvider):
    """
    Google Gemini API provider implementation.
    
    Example:
        provider = GeminiProvider(api_key="...")
        result = provider.complete(
            prompt="Analyze this text",
            schema={"type": "object", ...}
        )
    
    Note:
        Gemini has a generous free tier - great for development
        and small-scale production use.
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize Gemini provider.
        
        Args:
            api_key: Google AI API key (or set GOOGLE_API_KEY env var)
        """
        api_key = api_key or os.environ.get("GOOGLE_API_KEY")
        super().__init__(api_key, **kwargs)
        self._configured = False
    
    @property
    def name(self) -> str:
        return "gemini"
    
    @property
    def default_model(self) -> str:
        return "gemini-1.5-flash"
    
    def get_available_models(self) -> List[ModelInfo]:
        return GEMINI_MODELS.copy()
    
    def _configure(self):
        """Configure the Gemini SDK."""
        if self._configured:
            return
        
        try:
            import google.generativeai as genai
        except ImportError:
            raise AIProviderError(
                "google-generativeai package not installed. "
                "Run: pip install google-generativeai",
                provider=self.name,
                recoverable=False,
            )
        
        if self.api_key:
            genai.configure(api_key=self.api_key)
        
        self._configured = True
    
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
        Generate a completion using Gemini API.
        
        Args:
            prompt: The user prompt
            schema: Optional JSON schema for structured output
            model: Model name (defaults to gemini-1.5-flash)
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            system_prompt: Optional system instruction
            **kwargs: Additional Gemini-specific parameters
            
        Returns:
            CompletionResult with content and parsed JSON
        """
        self._configure()
        
        import google.generativeai as genai
        
        model_name = model or self.default_model
        
        # Build generation config
        generation_config = genai.GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        
        # Request JSON output if schema provided
        if schema:
            generation_config.response_mime_type = "application/json"
            # Gemini supports response_schema for structured output
            if kwargs.get("use_schema", True):
                try:
                    generation_config.response_schema = schema
                except Exception:
                    # Fall back to prompt-based JSON if schema fails
                    pass
        
        # Create model with optional system instruction
        model_kwargs = {}
        if system_prompt:
            model_kwargs["system_instruction"] = system_prompt
        
        try:
            gemini_model = genai.GenerativeModel(
                model_name,
                generation_config=generation_config,
                **model_kwargs
            )
            
            response = gemini_model.generate_content(prompt)
        except Exception as e:
            error_str = str(e).lower()
            if "quota" in error_str or "rate" in error_str or "429" in str(e):
                raise RateLimitError(
                    f"Gemini rate limit exceeded: {e}",
                    provider=self.name,
                )
            elif "api key" in error_str or "authentication" in error_str or "401" in str(e):
                raise AuthenticationError(
                    f"Gemini authentication failed: {e}",
                    provider=self.name,
                )
            elif "model" in error_str and "not found" in error_str:
                raise ModelNotFoundError(
                    f"Model not found: {e}",
                    provider=self.name,
                    model=model_name,
                )
            raise AIProviderError(
                f"Gemini API error: {e}",
                provider=self.name,
            )
        
        # Extract text content
        content = ""
        try:
            content = response.text
        except Exception:
            if response.parts:
                content = response.parts[0].text
        
        parsed_json = None
        if schema:
            parsed_json = _extract_json(content)
        
        # Extract usage info if available
        usage = None
        if hasattr(response, "usage_metadata"):
            meta = response.usage_metadata
            usage = {
                "prompt_tokens": getattr(meta, "prompt_token_count", 0),
                "completion_tokens": getattr(meta, "candidates_token_count", 0),
                "total_tokens": getattr(meta, "total_token_count", 0),
            }
        
        return CompletionResult(
            content=content,
            parsed_json=parsed_json,
            model=model_name,
            usage=usage,
            finish_reason=str(response.candidates[0].finish_reason) if response.candidates else "",
            raw_response=response,
        )
    
    def validate_api_key(self) -> bool:
        """Validate the API key by making a minimal request."""
        if not self.api_key:
            raise AuthenticationError(
                "No Gemini API key provided",
                provider=self.name,
            )
        
        try:
            self._configure()
            import google.generativeai as genai
            
            # List models to validate key
            list(genai.list_models())
            return True
        except Exception as e:
            raise AuthenticationError(
                f"Invalid Gemini API key: {e}",
                provider=self.name,
            )

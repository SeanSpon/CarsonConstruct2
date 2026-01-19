"""
Local AI Provider Implementation (Ollama)

Supports:
- Any Ollama-compatible model (Llama 3, Mistral, Phi, etc.)
- Local Whisper for transcription (whisper.cpp)
- Completely offline operation
- Zero API costs

Benefits:
- Privacy: Data never leaves the device
- Cost: No per-request charges
- Speed: No network latency
- Offline: Works without internet

Requirements:
- Ollama installed: https://ollama.ai
- Models pulled: ollama pull llama3
- For transcription: whisper.cpp or faster-whisper
"""

import json
import os
import subprocess
from typing import Any, Dict, List, Optional

from .base import (
    AIProvider,
    AIProviderError,
    CompletionResult,
    ModelInfo,
    ModelNotFoundError,
    ProviderCapability,
    TranscriptionResult,
)


# Common Ollama models
LOCAL_MODELS = [
    ModelInfo(
        name="llama3.2",
        provider="local",
        capabilities=[
            ProviderCapability.TEXT_COMPLETION,
            ProviderCapability.STRUCTURED_OUTPUT,
        ],
        max_tokens=4096,
        supports_json_mode=True,
        cost_per_1k_input=0.0,  # Free!
        cost_per_1k_output=0.0,
        context_window=8192,
        description="Meta's latest Llama model, great for general tasks",
    ),
    ModelInfo(
        name="llama3.2:1b",
        provider="local",
        capabilities=[
            ProviderCapability.TEXT_COMPLETION,
            ProviderCapability.STRUCTURED_OUTPUT,
        ],
        max_tokens=4096,
        supports_json_mode=True,
        cost_per_1k_input=0.0,
        cost_per_1k_output=0.0,
        context_window=8192,
        description="Lightweight Llama 3.2 1B model, fast on CPU",
    ),
    ModelInfo(
        name="mistral",
        provider="local",
        capabilities=[
            ProviderCapability.TEXT_COMPLETION,
            ProviderCapability.STRUCTURED_OUTPUT,
        ],
        max_tokens=4096,
        supports_json_mode=True,
        cost_per_1k_input=0.0,
        cost_per_1k_output=0.0,
        context_window=8192,
        description="Mistral 7B - efficient and capable",
    ),
    ModelInfo(
        name="phi3",
        provider="local",
        capabilities=[
            ProviderCapability.TEXT_COMPLETION,
            ProviderCapability.STRUCTURED_OUTPUT,
        ],
        max_tokens=4096,
        supports_json_mode=True,
        cost_per_1k_input=0.0,
        cost_per_1k_output=0.0,
        context_window=4096,
        description="Microsoft Phi-3 - small but powerful",
    ),
    ModelInfo(
        name="qwen2.5",
        provider="local",
        capabilities=[
            ProviderCapability.TEXT_COMPLETION,
            ProviderCapability.STRUCTURED_OUTPUT,
        ],
        max_tokens=4096,
        supports_json_mode=True,
        cost_per_1k_input=0.0,
        cost_per_1k_output=0.0,
        context_window=32768,
        description="Alibaba Qwen 2.5 - excellent reasoning",
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


def _check_ollama_installed() -> bool:
    """Check if Ollama is installed and running."""
    try:
        result = subprocess.run(
            ["ollama", "list"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        return result.returncode == 0
    except (subprocess.SubprocessError, FileNotFoundError):
        return False


def _get_installed_models() -> List[str]:
    """Get list of models installed in Ollama."""
    try:
        result = subprocess.run(
            ["ollama", "list"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode != 0:
            return []
        
        models = []
        for line in result.stdout.strip().split("\n")[1:]:  # Skip header
            if line.strip():
                # Format: NAME ID SIZE MODIFIED
                parts = line.split()
                if parts:
                    models.append(parts[0])
        return models
    except (subprocess.SubprocessError, FileNotFoundError):
        return []


class LocalProvider(AIProvider):
    """
    Local AI provider using Ollama.
    
    Example:
        provider = LocalProvider()
        result = provider.complete(
            prompt="Analyze this text",
            model="llama3.2"
        )
    
    Requirements:
        1. Install Ollama: https://ollama.ai
        2. Pull a model: ollama pull llama3.2
        3. Ollama server must be running
    
    Benefits:
        - Completely free (no API costs)
        - Privacy (data stays local)
        - Works offline
        - No rate limits
    """
    
    def __init__(
        self,
        host: str = "http://localhost:11434",
        **kwargs
    ):
        """
        Initialize local Ollama provider.
        
        Args:
            host: Ollama server URL (default: http://localhost:11434)
        """
        super().__init__(api_key=None, **kwargs)
        self.host = host
        self._client = None
    
    @property
    def name(self) -> str:
        return "local"
    
    @property
    def default_model(self) -> str:
        # Check what's actually installed
        installed = _get_installed_models()
        
        # Prefer these models in order
        preferred = ["llama3.2", "llama3", "mistral", "phi3", "qwen2.5"]
        for model in preferred:
            if any(model in m for m in installed):
                return model
        
        # Return first installed or default
        return installed[0] if installed else "llama3.2"
    
    def get_available_models(self) -> List[ModelInfo]:
        """Get models, checking which are actually installed."""
        installed = _get_installed_models()
        
        # Return known models that are installed
        available = []
        for model in LOCAL_MODELS:
            if any(model.name in m for m in installed):
                available.append(model)
        
        # Add any installed models not in our list
        known_names = {m.name for m in LOCAL_MODELS}
        for installed_name in installed:
            base_name = installed_name.split(":")[0]
            if base_name not in known_names:
                available.append(
                    ModelInfo(
                        name=installed_name,
                        provider="local",
                        capabilities=[
                            ProviderCapability.TEXT_COMPLETION,
                            ProviderCapability.STRUCTURED_OUTPUT,
                        ],
                        max_tokens=4096,
                        cost_per_1k_input=0.0,
                        cost_per_1k_output=0.0,
                        context_window=4096,
                        description=f"Local model: {installed_name}",
                    )
                )
        
        return available if available else LOCAL_MODELS.copy()
    
    def _get_client(self):
        """Lazy-load the Ollama client."""
        if self._client is None:
            try:
                import ollama
            except ImportError:
                raise AIProviderError(
                    "ollama package not installed. Run: pip install ollama",
                    provider=self.name,
                    recoverable=False,
                )
            
            # Check if Ollama is running
            if not _check_ollama_installed():
                raise AIProviderError(
                    "Ollama is not installed or not running. "
                    "Install from https://ollama.ai and run 'ollama serve'",
                    provider=self.name,
                    recoverable=False,
                )
            
            self._client = ollama
        
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
        Generate a completion using Ollama.
        
        Args:
            prompt: The user prompt
            schema: Optional JSON schema for structured output
            model: Model name (defaults to best available)
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            system_prompt: Optional system message
            **kwargs: Additional Ollama-specific parameters
            
        Returns:
            CompletionResult with content and parsed JSON
        """
        ollama = self._get_client()
        model_name = model or self.default_model
        
        # Build messages
        messages = []
        
        # Add system prompt with JSON instruction if schema provided
        system = system_prompt or ""
        if schema:
            json_instruction = (
                "\n\nYou must respond with valid JSON only. "
                "No markdown code blocks, no explanation, just the raw JSON object."
            )
            system = system + json_instruction if system else json_instruction.strip()
        
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        
        try:
            response = ollama.chat(
                model=model_name,
                messages=messages,
                options={
                    "temperature": temperature,
                    "num_predict": max_tokens,
                },
            )
        except Exception as e:
            error_str = str(e).lower()
            if "not found" in error_str or "pull" in error_str:
                raise ModelNotFoundError(
                    f"Model '{model_name}' not found. Run: ollama pull {model_name}",
                    provider=self.name,
                    model=model_name,
                )
            raise AIProviderError(
                f"Ollama error: {e}",
                provider=self.name,
            )
        
        content = response.get("message", {}).get("content", "")
        
        parsed_json = None
        if schema:
            parsed_json = _extract_json(content)
        
        # Extract token counts if available
        usage = None
        if "eval_count" in response or "prompt_eval_count" in response:
            usage = {
                "prompt_tokens": response.get("prompt_eval_count", 0),
                "completion_tokens": response.get("eval_count", 0),
                "total_tokens": (
                    response.get("prompt_eval_count", 0) +
                    response.get("eval_count", 0)
                ),
            }
        
        return CompletionResult(
            content=content,
            parsed_json=parsed_json,
            model=model_name,
            usage=usage,
            finish_reason="stop",
            raw_response=response,
        )
    
    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        **kwargs
    ) -> TranscriptionResult:
        """
        Transcribe audio using local Whisper.
        
        Requires faster-whisper or whisper.cpp to be installed.
        
        Args:
            audio_path: Path to audio file
            language: Optional language code
            **kwargs: Additional parameters
            
        Returns:
            TranscriptionResult with text and segments
        """
        # Try faster-whisper first (more efficient)
        try:
            return self._transcribe_faster_whisper(audio_path, language)
        except ImportError:
            pass
        
        # Fall back to openai-whisper
        try:
            return self._transcribe_openai_whisper(audio_path, language)
        except ImportError:
            pass
        
        raise AIProviderError(
            "Local transcription requires faster-whisper or openai-whisper. "
            "Run: pip install faster-whisper",
            provider=self.name,
            recoverable=False,
        )
    
    def _transcribe_faster_whisper(
        self,
        audio_path: str,
        language: Optional[str] = None
    ) -> TranscriptionResult:
        """Transcribe using faster-whisper."""
        from faster_whisper import WhisperModel
        
        # Use base model by default (good balance)
        model_size = self.config.get("whisper_model", "base")
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        
        segments_list, info = model.transcribe(
            audio_path,
            language=language,
            word_timestamps=True,
        )
        
        # Convert to our format
        text_parts = []
        words = []
        segments = []
        
        for segment in segments_list:
            text_parts.append(segment.text)
            segments.append({
                "text": segment.text,
                "start": segment.start,
                "end": segment.end,
            })
            
            if segment.words:
                for word in segment.words:
                    words.append({
                        "word": word.word,
                        "start": word.start,
                        "end": word.end,
                    })
        
        return TranscriptionResult(
            text=" ".join(text_parts).strip(),
            words=words,
            segments=segments,
            language=info.language or "",
            duration=info.duration or 0.0,
        )
    
    def _transcribe_openai_whisper(
        self,
        audio_path: str,
        language: Optional[str] = None
    ) -> TranscriptionResult:
        """Transcribe using openai-whisper."""
        import whisper
        
        model_size = self.config.get("whisper_model", "base")
        model = whisper.load_model(model_size)
        
        result = model.transcribe(
            audio_path,
            language=language,
            word_timestamps=True,
        )
        
        # Convert to our format
        words = []
        segments = []
        
        for segment in result.get("segments", []):
            segments.append({
                "text": segment.get("text", ""),
                "start": segment.get("start", 0),
                "end": segment.get("end", 0),
            })
            
            for word in segment.get("words", []):
                words.append({
                    "word": word.get("word", ""),
                    "start": word.get("start", 0),
                    "end": word.get("end", 0),
                })
        
        return TranscriptionResult(
            text=result.get("text", "").strip(),
            words=words,
            segments=segments,
            language=result.get("language", ""),
            duration=segments[-1]["end"] if segments else 0.0,
        )
    
    def validate_api_key(self) -> bool:
        """Check if Ollama is installed and has models."""
        if not _check_ollama_installed():
            raise AIProviderError(
                "Ollama is not installed or not running",
                provider=self.name,
                recoverable=False,
            )
        
        models = _get_installed_models()
        if not models:
            raise AIProviderError(
                "No models installed. Run: ollama pull llama3.2",
                provider=self.name,
                recoverable=True,
            )
        
        return True
    
    def pull_model(self, model_name: str) -> bool:
        """
        Pull a model from Ollama registry.
        
        Args:
            model_name: Model to pull (e.g., 'llama3.2')
            
        Returns:
            True if successful
        """
        try:
            result = subprocess.run(
                ["ollama", "pull", model_name],
                capture_output=True,
                text=True,
                timeout=600,  # 10 minutes for large models
            )
            return result.returncode == 0
        except (subprocess.SubprocessError, FileNotFoundError) as e:
            raise AIProviderError(
                f"Failed to pull model: {e}",
                provider=self.name,
            )

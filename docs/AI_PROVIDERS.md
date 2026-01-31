# AI Provider Architecture

This document describes the multi-provider AI abstraction layer in PodFlow Studio.

## Overview

The AI provider system allows you to switch between different AI backends (OpenAI, Gemini, Anthropic, or local models) without changing application code. This provides:

- **Flexibility**: Choose the best model for your use case
- **Cost Control**: Switch to cheaper providers or local models
- **Privacy**: Run completely offline with local models
- **Redundancy**: Fall back to other providers if one fails
- **Future-Proofing**: Add new providers as they become available

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION LAYER                              │
│           (Orchestrator, Translator, Thinker, Transcriber)              │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         get_provider() Factory                           │
│                    Returns appropriate AIProvider instance               │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────────────────────┐
        │                       │                       │               │
        ▼                       ▼                       ▼               ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐  ┌───────────────┐
│    OpenAI     │     │    Gemini     │     │   Anthropic   │  │     Local     │
│   Provider    │     │   Provider    │     │   Provider    │  │   Provider    │
├───────────────┤     ├───────────────┤     ├───────────────┤  ├───────────────┤
│ • GPT-4o      │     │ • 1.5 Pro     │     │ • Claude 3.5  │  │ • Llama 3     │
│ • GPT-4o-mini │     │ • 1.5 Flash   │     │ • Claude 3    │  │ • Mistral     │
│ • Whisper     │     │ • Gemini Pro  │     │ • Haiku       │  │ • Phi-3       │
└───────────────┘     └───────────────┘     └───────────────┘  └───────────────┘
```

## Quick Start

### Basic Usage

```python
from ai.providers import get_provider

# OpenAI (default)
provider = get_provider("openai", api_key="sk-...")
result = provider.complete(
    prompt="Analyze this clip: ...",
    schema={"type": "object", "properties": {...}}
)

# Gemini (has free tier!)
provider = get_provider("gemini", api_key="...")
result = provider.complete(prompt="Analyze this clip: ...")

# Local (free, offline, private)
provider = get_provider("local")
result = provider.complete(prompt="Analyze this clip: ...")
```

### In Application Settings

```python
settings = {
    "ai_provider": "gemini",      # or "openai", "anthropic", "local"
    "gemini_api_key": "...",
    "ai_model": "gemini-1.5-flash",
}

from ai.providers import get_provider_for_settings
provider = get_provider_for_settings(settings)
```

## Providers

### OpenAI

**Best for**: High-quality results, transcription needs

| Model | Cost (input/output per 1M tokens) | Context | Best For |
|-------|-----------------------------------|---------|----------|
| gpt-4o | $5.00 / $15.00 | 128K | Complex analysis |
| gpt-4o-mini | $0.15 / $0.60 | 128K | Cost-effective default |
| whisper-1 | $0.006/minute | - | Transcription |

```python
provider = get_provider("openai", api_key="sk-...")

# Completion
result = provider.complete(prompt="...", model="gpt-4o-mini")

# Transcription
transcript = provider.transcribe("audio.wav")
print(transcript.text)
print(transcript.words)  # Word-level timestamps
```

**Environment Variable**: `OPENAI_API_KEY`

### Google Gemini

**Best for**: Free tier development, long context (1M tokens!)

| Model | Cost (input/output per 1M tokens) | Context | Best For |
|-------|-----------------------------------|---------|----------|
| gemini-1.5-pro | $3.50 / $10.50 | 1M | Complex reasoning |
| gemini-1.5-flash | $0.075 / $0.30 | 1M | Fast, affordable |
| gemini-pro | $0.50 / $1.50 | 32K | Balanced |

```python
provider = get_provider("gemini", api_key="...")

result = provider.complete(
    prompt="...",
    model="gemini-1.5-flash"
)
```

**Free Tier**: 15 requests/minute, 1M tokens/day - perfect for development!

**Environment Variable**: `GOOGLE_API_KEY`

Get your key: https://makersuite.google.com/app/apikey

### Anthropic Claude

**Best for**: Nuanced analysis, complex instructions

| Model | Cost (input/output per 1M tokens) | Context | Best For |
|-------|-----------------------------------|---------|----------|
| claude-3.5-sonnet | $3.00 / $15.00 | 200K | Best quality/speed |
| claude-3-opus | $15.00 / $75.00 | 200K | Most capable |
| claude-3-haiku | $0.25 / $1.25 | 200K | Fast, affordable |

```python
provider = get_provider("anthropic", api_key="...")

result = provider.complete(
    prompt="...",
    model="claude-3-haiku-20240307"
)
```

**Environment Variable**: `ANTHROPIC_API_KEY`

### Local (Ollama)

**Best for**: Privacy, offline use, zero cost

| Model | Cost | Size | Best For |
|-------|------|------|----------|
| llama3.2 | Free | 4GB | General use |
| llama3.2:1b | Free | 1GB | Fast, low memory |
| mistral | Free | 4GB | Good reasoning |
| phi3 | Free | 2GB | Small but capable |

```python
# No API key needed!
provider = get_provider("local")

result = provider.complete(
    prompt="...",
    model="llama3.2"
)

# Transcription with local Whisper
transcript = provider.transcribe("audio.wav")
```

**Setup**:
1. Install Ollama: https://ollama.ai
2. Pull a model: `ollama pull llama3.2`
3. Start server: `ollama serve`

**Benefits**:
- ✅ Completely free
- ✅ Data never leaves your device
- ✅ Works offline
- ✅ No rate limits

## Provider Interface

All providers implement the same interface:

```python
class AIProvider:
    name: str                    # "openai", "gemini", etc.
    default_model: str           # Default model name
    
    def complete(
        self,
        prompt: str,
        schema: Optional[Dict] = None,  # For structured JSON output
        model: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 500,
        **kwargs
    ) -> CompletionResult:
        """Generate a completion."""
        
    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        **kwargs
    ) -> TranscriptionResult:
        """Transcribe audio (if supported)."""
        
    def get_available_models(self) -> List[ModelInfo]:
        """List available models."""
        
    def validate_api_key(self) -> bool:
        """Check if API key is valid."""
        
    def estimate_cost(
        self,
        input_tokens: int,
        output_tokens: int,
        model: Optional[str] = None
    ) -> float:
        """Estimate cost in USD."""
```

## Result Types

### CompletionResult

```python
@dataclass
class CompletionResult:
    content: str                           # Raw text response
    parsed_json: Optional[Dict] = None     # Parsed JSON if schema provided
    model: str = ""                        # Model used
    usage: Optional[Dict[str, int]] = None # Token counts
    finish_reason: str = ""                # Why generation stopped
```

### TranscriptionResult

```python
@dataclass
class TranscriptionResult:
    text: str                              # Full transcript
    words: List[Dict]                      # [{word, start, end}, ...]
    segments: List[Dict]                   # [{text, start, end}, ...]
    language: str = ""                     # Detected language
    duration: float = 0.0                  # Audio duration
    error: Optional[str] = None            # Error message if any
```

## Error Handling

The provider system uses custom exceptions for different error types:

```python
from ai.providers import (
    AIProviderError,      # Base exception
    AuthenticationError,  # Invalid API key
    RateLimitError,       # Rate limit exceeded
    ModelNotFoundError,   # Model not available
)

try:
    result = provider.complete(prompt="...")
except RateLimitError as e:
    # Wait and retry
    time.sleep(e.retry_after or 60)
except AuthenticationError as e:
    # Invalid API key
    print(f"Check your API key: {e}")
except ModelNotFoundError as e:
    # Use a different model
    result = provider.complete(prompt="...", model="fallback-model")
except AIProviderError as e:
    # General error
    if e.recoverable:
        # Try again or fall back
        pass
```

## Fallback Strategy

The translator and thinker modules include automatic fallbacks:

```python
# This works even without API keys
from ai.translator import translate_clip

# Will use AI if api_key provided, heuristics otherwise
meaning = translate_clip(clip_card, context_pack, api_key=None)
```

Fallback order:
1. Try configured provider
2. If provider fails, try legacy OpenAI direct call
3. If all AI fails, use deterministic heuristics

## Adding a New Provider

To add a new provider (e.g., Cohere, Mistral API):

1. Create `ai/providers/cohere_provider.py`:

```python
from .base import AIProvider, CompletionResult, ...

class CohereProvider(AIProvider):
    @property
    def name(self) -> str:
        return "cohere"
    
    @property
    def default_model(self) -> str:
        return "command-r"
    
    def get_available_models(self) -> List[ModelInfo]:
        return [...]
    
    def complete(self, prompt, schema=None, ...) -> CompletionResult:
        # Implementation
        pass
```

2. Register in `ai/providers/__init__.py`:

```python
class ProviderType(Enum):
    # ...
    COHERE = "cohere"

def get_provider(provider_type, ...):
    # ...
    elif provider_type == ProviderType.COHERE:
        from .cohere_provider import CohereProvider
        return CohereProvider(api_key=api_key, **kwargs)
```

## Cost Comparison

For processing 100 clips (~500 tokens input, ~200 tokens output each):

| Provider | Model | Estimated Cost |
|----------|-------|----------------|
| OpenAI | gpt-4o-mini | ~$0.02 |
| Gemini | gemini-1.5-flash | ~$0.01 |
| Anthropic | claude-3-haiku | ~$0.04 |
| Local | llama3.2 | $0.00 |

## Best Practices

### 1. Use Environment Variables

```bash
# .env file
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
GOOGLE_API_KEY=...
ANTHROPIC_API_KEY=...
```

```python
# Providers auto-read from env
provider = get_provider("openai")  # Uses OPENAI_API_KEY
```

### 2. Choose the Right Provider

- **Development**: Gemini (free tier) or Local (free)
- **Production**: OpenAI gpt-4o-mini (quality/cost balance)
- **Privacy-sensitive**: Local (data stays on device)
- **Complex analysis**: Anthropic Claude or OpenAI gpt-4o

### 3. Handle Errors Gracefully

```python
def get_ai_result(prompt, settings):
    try:
        provider = get_provider_for_settings(settings)
        return provider.complete(prompt)
    except AuthenticationError:
        # Fall back to local if available
        try:
            return get_provider("local").complete(prompt)
        except AIProviderError:
            return None  # Use heuristics
```

### 4. Monitor Costs

```python
result = provider.complete(prompt)
if result.usage:
    cost = provider.estimate_cost(
        result.usage["prompt_tokens"],
        result.usage["completion_tokens"]
    )
    print(f"Request cost: ${cost:.4f}")
```

## Future: Training Your Own Models

The provider architecture is designed to support custom trained models:

```python
# Future: Custom trained model
class CustomProvider(AIProvider):
    def complete(self, prompt, ...):
        # Call your fine-tuned model
        return self.custom_model.generate(prompt)

# Register and use
provider = get_provider("custom", model_path="/path/to/model")
```

Data collection hooks can be added to gather training data:
- Clip accept/reject decisions
- User trim adjustments
- Export choices
- Performance metrics (if user opts in)

## Files

```
podflow-studio/src/python/ai/
├── __init__.py           # Module exports
├── orchestrator.py       # Main AI pipeline coordinator
├── translator.py         # ClipCard → MeaningCard
├── thinker.py            # Clip selection logic
├── transcription.py      # Audio transcription
├── schemas.py            # Data structures
└── providers/
    ├── __init__.py       # Factory function
    ├── base.py           # Abstract base class
    ├── openai_provider.py
    ├── gemini_provider.py
    ├── anthropic_provider.py
    └── local_provider.py
```

/**
 * Base AI Provider Interface
 * 
 * Mirrors the Python ai/providers/base.py architecture.
 * All providers implement this interface for unified access.
 */

// ============================================
// CAPABILITIES
// ============================================

export enum ProviderCapability {
  TEXT_COMPLETION = 'text_completion',
  STRUCTURED_OUTPUT = 'structured_output',
  FUNCTION_CALLING = 'function_calling',
  TRANSCRIPTION = 'transcription',
  VISION = 'vision',
  IMAGE_GENERATION = 'image_generation',
  EMBEDDING = 'embedding',
  STREAMING = 'streaming',
}

// ============================================
// TYPES
// ============================================

export interface ModelInfo {
  name: string;
  provider: string;
  capabilities: ProviderCapability[];
  maxTokens: number;
  supportsJsonMode: boolean;
  supportsFunctionCalling: boolean;
  costPer1kInput: number;  // USD
  costPer1kOutput: number; // USD
  contextWindow: number;
  description: string;
}

export interface CompletionResult {
  content: string;
  parsedJson?: Record<string, unknown>;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
  provider: string;
}

export interface TranscriptionResult {
  text: string;
  words: Array<{ word: string; start: number; end: number }>;
  segments: Array<{ text: string; start: number; end: number }>;
  language: string;
  duration: number;
  error?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CompletionRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }>;
  systemPrompt?: string;
}

export interface CompletionResponse {
  success: boolean;
  content?: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  requiresToolResults?: boolean;
  error?: string;
  provider?: string;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ============================================
// ERRORS
// ============================================

export class AIProviderError extends Error {
  constructor(
    message: string,
    public provider: string = '',
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export class RateLimitError extends AIProviderError {
  constructor(
    message: string,
    provider: string = '',
    public retryAfter?: number
  ) {
    super(message, provider, true);
    this.name = 'RateLimitError';
  }
}

export class AuthenticationError extends AIProviderError {
  constructor(message: string, provider: string = '') {
    super(message, provider, false);
    this.name = 'AuthenticationError';
  }
}

export class ModelNotFoundError extends AIProviderError {
  constructor(
    message: string,
    provider: string = '',
    public model: string = ''
  ) {
    super(message, provider, false);
    this.name = 'ModelNotFoundError';
  }
}

// ============================================
// ABSTRACT PROVIDER
// ============================================

export abstract class AIProvider {
  protected apiKey?: string;
  protected config: Record<string, unknown>;
  
  constructor(apiKey?: string, config: Record<string, unknown> = {}) {
    this.apiKey = apiKey;
    this.config = config;
  }
  
  abstract get name(): string;
  abstract get defaultModel(): string;
  abstract getAvailableModels(): ModelInfo[];
  
  abstract complete(request: CompletionRequest): Promise<CompletionResponse>;
  
  // Optional: transcription support
  async transcribe(
    _audioPath: string,
    _language?: string
  ): Promise<TranscriptionResult> {
    throw new Error(`${this.name} provider does not support transcription`);
  }
  
  // Optional: vision support
  async analyzeImage(
    _imagePath: string,
    _prompt: string
  ): Promise<CompletionResponse> {
    throw new Error(`${this.name} provider does not support vision`);
  }
  
  // Optional: image generation
  async generateImage(
    _prompt: string,
    _options?: Record<string, unknown>
  ): Promise<{ url?: string; base64?: string; error?: string }> {
    throw new Error(`${this.name} provider does not support image generation`);
  }
  
  supports(capability: ProviderCapability): boolean {
    const models = this.getAvailableModels();
    return models.some(m => m.capabilities.includes(capability));
  }
  
  hasValidKey(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }
  
  estimateCost(
    inputTokens: number,
    outputTokens: number,
    model?: string
  ): number {
    const modelName = model || this.defaultModel;
    const models = this.getAvailableModels();
    const modelInfo = models.find(m => m.name === modelName);
    
    if (!modelInfo) return 0;
    
    const inputCost = (inputTokens / 1000) * modelInfo.costPer1kInput;
    const outputCost = (outputTokens / 1000) * modelInfo.costPer1kOutput;
    return inputCost + outputCost;
  }
}

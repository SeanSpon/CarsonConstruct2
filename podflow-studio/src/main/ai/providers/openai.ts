/**
 * OpenAI Provider
 * 
 * Best for: Whisper transcription, DALL-E image generation, GPT-4 reasoning
 */

import {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  ModelInfo,
  ProviderCapability,
  TranscriptionResult,
  AIProviderError,
  RateLimitError,
  AuthenticationError,
} from './base';
import * as fs from 'fs';
import * as path from 'path';

export class OpenAIProvider extends AIProvider {
  get name(): string {
    return 'openai';
  }
  
  get defaultModel(): string {
    return 'gpt-4o-mini';
  }
  
  getAvailableModels(): ModelInfo[] {
    return [
      {
        name: 'gpt-4o',
        provider: 'openai',
        capabilities: [
          ProviderCapability.TEXT_COMPLETION,
          ProviderCapability.STRUCTURED_OUTPUT,
          ProviderCapability.FUNCTION_CALLING,
          ProviderCapability.VISION,
          ProviderCapability.STREAMING,
        ],
        maxTokens: 4096,
        supportsJsonMode: true,
        supportsFunctionCalling: true,
        costPer1kInput: 0.005,
        costPer1kOutput: 0.015,
        contextWindow: 128000,
        description: 'Most capable GPT-4 model',
      },
      {
        name: 'gpt-4o-mini',
        provider: 'openai',
        capabilities: [
          ProviderCapability.TEXT_COMPLETION,
          ProviderCapability.STRUCTURED_OUTPUT,
          ProviderCapability.FUNCTION_CALLING,
          ProviderCapability.VISION,
          ProviderCapability.STREAMING,
        ],
        maxTokens: 4096,
        supportsJsonMode: true,
        supportsFunctionCalling: true,
        costPer1kInput: 0.00015,
        costPer1kOutput: 0.0006,
        contextWindow: 128000,
        description: 'Fast and affordable',
      },
      {
        name: 'whisper-1',
        provider: 'openai',
        capabilities: [ProviderCapability.TRANSCRIPTION],
        maxTokens: 0,
        supportsJsonMode: false,
        supportsFunctionCalling: false,
        costPer1kInput: 0.006, // per minute
        costPer1kOutput: 0,
        contextWindow: 0,
        description: 'Audio transcription',
      },
      {
        name: 'dall-e-3',
        provider: 'openai',
        capabilities: [ProviderCapability.IMAGE_GENERATION],
        maxTokens: 0,
        supportsJsonMode: false,
        supportsFunctionCalling: false,
        costPer1kInput: 0.04, // per image (1024x1024)
        costPer1kOutput: 0,
        contextWindow: 0,
        description: 'Image generation',
      },
    ];
  }
  
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.apiKey) {
      throw new AuthenticationError('OpenAI API key required', this.name);
    }
    
    const model = request.model || this.defaultModel;
    
    // Build messages
    const messages: Array<{ role: string; content: string }> = [];
    
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    
    messages.push(...request.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    })));
    
    // Build request body
    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: request.maxTokens || 4096,
    };
    
    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }
    
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        },
      }));
    }
    
    try {
      // Log request for debugging
      console.log('[OpenAIProvider] Request:', {
        model,
        hasTools: !!(request.tools && request.tools.length > 0),
        toolCount: request.tools?.length || 0,
      });
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OpenAIProvider] API Error:', response.status, errorText);
        
        if (response.status === 401) {
          throw new AuthenticationError('Invalid OpenAI API key', this.name);
        }
        if (response.status === 429) {
          throw new RateLimitError('Rate limit exceeded', this.name);
        }
        
        throw new AIProviderError(`API error ${response.status}: ${errorText}`, this.name);
      }
      
      const data = await response.json();
      const choice = data.choices?.[0];
      
      // Log response for debugging
      console.log('[OpenAIProvider] Response:', {
        finish_reason: choice?.finish_reason,
        hasToolCalls: !!(choice?.message?.tool_calls?.length),
        toolCallCount: choice?.message?.tool_calls?.length || 0,
      });
      
      if (!choice) {
        throw new AIProviderError('No response from OpenAI', this.name);
      }
      
      // Parse tool calls
      const toolCalls = choice.message?.tool_calls?.map((tc: {
        id: string;
        function: { name: string; arguments: string };
      }) => {
        console.log('[OpenAIProvider] Parsing tool call:', tc.function.name);
        return {
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments || '{}'),
        };
      });
      
      return {
        success: true,
        content: choice.message?.content || '',
        toolCalls: toolCalls?.length > 0 ? toolCalls : undefined,
        requiresToolResults: choice.finish_reason === 'tool_calls',
        provider: this.name,
        model,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
      };
      
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      throw new AIProviderError(
        err instanceof Error ? err.message : 'Unknown error',
        this.name
      );
    }
  }
  
  async transcribe(audioPath: string, language?: string): Promise<TranscriptionResult> {
    if (!this.apiKey) {
      throw new AuthenticationError('OpenAI API key required for transcription', this.name);
    }
    
    try {
      // Read file
      const audioBuffer = fs.readFileSync(audioPath);
      const fileName = path.basename(audioPath);
      
      // Create form data
      const formData = new FormData();
      formData.append('file', new Blob([audioBuffer]), fileName);
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities[]', 'word');
      formData.append('timestamp_granularities[]', 'segment');
      
      if (language) {
        formData.append('language', language);
      }
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new AIProviderError(`Transcription failed: ${errorText}`, this.name);
      }
      
      const data = await response.json();
      
      return {
        text: data.text || '',
        words: data.words || [],
        segments: data.segments || [],
        language: data.language || '',
        duration: data.duration || 0,
      };
      
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      throw new AIProviderError(
        err instanceof Error ? err.message : 'Transcription failed',
        this.name
      );
    }
  }
  
  async generateImage(
    prompt: string,
    options: { size?: string; quality?: string; style?: string } = {}
  ): Promise<{ url?: string; base64?: string; error?: string }> {
    if (!this.apiKey) {
      throw new AuthenticationError('OpenAI API key required for image generation', this.name);
    }
    
    try {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt,
          n: 1,
          size: options.size || '1024x1024',
          quality: options.quality || 'standard',
          style: options.style || 'natural',
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return { error: `Image generation failed: ${errorText}` };
      }
      
      const data = await response.json();
      return { url: data.data?.[0]?.url };
      
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Image generation failed' };
    }
  }
}

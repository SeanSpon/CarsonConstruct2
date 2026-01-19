/**
 * Anthropic Claude Provider
 * 
 * Best for: Complex reasoning, nuanced analysis, tool calling
 */

import {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  ModelInfo,
  ProviderCapability,
  AIProviderError,
  RateLimitError,
  AuthenticationError,
} from './base';

export class AnthropicProvider extends AIProvider {
  get name(): string {
    return 'anthropic';
  }
  
  get defaultModel(): string {
    return 'claude-sonnet-4-20250514';
  }
  
  getAvailableModels(): ModelInfo[] {
    return [
      {
        name: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
        capabilities: [
          ProviderCapability.TEXT_COMPLETION,
          ProviderCapability.STRUCTURED_OUTPUT,
          ProviderCapability.FUNCTION_CALLING,
          ProviderCapability.VISION,
          ProviderCapability.STREAMING,
        ],
        maxTokens: 8192,
        supportsJsonMode: true,
        supportsFunctionCalling: true,
        costPer1kInput: 0.003,
        costPer1kOutput: 0.015,
        contextWindow: 200000,
        description: 'Best balance of speed and intelligence',
      },
      {
        name: 'claude-3-5-sonnet-20241022',
        provider: 'anthropic',
        capabilities: [
          ProviderCapability.TEXT_COMPLETION,
          ProviderCapability.STRUCTURED_OUTPUT,
          ProviderCapability.FUNCTION_CALLING,
          ProviderCapability.VISION,
          ProviderCapability.STREAMING,
        ],
        maxTokens: 8192,
        supportsJsonMode: true,
        supportsFunctionCalling: true,
        costPer1kInput: 0.003,
        costPer1kOutput: 0.015,
        contextWindow: 200000,
        description: 'Previous generation Sonnet',
      },
      {
        name: 'claude-3-haiku-20240307',
        provider: 'anthropic',
        capabilities: [
          ProviderCapability.TEXT_COMPLETION,
          ProviderCapability.STRUCTURED_OUTPUT,
          ProviderCapability.FUNCTION_CALLING,
          ProviderCapability.STREAMING,
        ],
        maxTokens: 4096,
        supportsJsonMode: true,
        supportsFunctionCalling: true,
        costPer1kInput: 0.00025,
        costPer1kOutput: 0.00125,
        contextWindow: 200000,
        description: 'Fast and affordable',
      },
    ];
  }
  
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.apiKey) {
      throw new AuthenticationError('Anthropic API key required', this.name);
    }
    
    const model = request.model || this.defaultModel;
    
    // Build messages
    const messages = request.messages.map(msg => ({
      role: msg.role === 'system' ? 'user' : msg.role,
      content: msg.content,
    }));
    
    // Build request body
    const body: Record<string, unknown> = {
      model,
      max_tokens: request.maxTokens || 4096,
      messages,
    };
    
    if (request.systemPrompt) {
      body.system = request.systemPrompt;
    }
    
    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }
    
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools;
    }
    
    try {
      // Log request for debugging
      console.log('[AnthropicProvider] Request:', {
        model,
        hasTools: !!(request.tools && request.tools.length > 0),
        toolCount: request.tools?.length || 0,
        toolNames: request.tools?.map(t => t.name) || [],
      });
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AnthropicProvider] API Error:', response.status, errorText);
        
        if (response.status === 401) {
          throw new AuthenticationError('Invalid Anthropic API key', this.name);
        }
        if (response.status === 429) {
          throw new RateLimitError('Rate limit exceeded', this.name);
        }
        
        throw new AIProviderError(`API error ${response.status}: ${errorText}`, this.name);
      }
      
      const data = await response.json();
      
      // Log raw response for debugging
      console.log('[AnthropicProvider] Response:', {
        stop_reason: data.stop_reason,
        contentTypes: data.content?.map((b: { type: string }) => b.type) || [],
      });
      
      // Parse response
      let content = '';
      let thinking = '';
      const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];
      
      if (data.content && Array.isArray(data.content)) {
        for (const block of data.content) {
          if (block.type === 'text') {
            content += block.text;
          } else if (block.type === 'thinking') {
            thinking += block.thinking;
          } else if (block.type === 'tool_use') {
            console.log('[AnthropicProvider] Found tool_use:', block.name, block.input);
            toolCalls.push({
              id: block.id,
              name: block.name,
              arguments: block.input || {},
            });
          }
        }
      }
      
      // Log parsed tool calls
      if (toolCalls.length > 0) {
        console.log('[AnthropicProvider] Parsed tool calls:', toolCalls.map(tc => tc.name));
      }
      
      return {
        success: true,
        content,
        thinking: thinking || undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        requiresToolResults: data.stop_reason === 'tool_use',
        provider: this.name,
        model,
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
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
}

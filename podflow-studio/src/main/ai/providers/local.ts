/**
 * Local (Ollama) Provider
 * 
 * Best for: Privacy, offline use, zero cost
 * Requires Ollama running locally: https://ollama.ai
 */

import {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  ModelInfo,
  ProviderCapability,
  AIProviderError,
} from './base';

export class LocalProvider extends AIProvider {
  private host: string;
  
  constructor(config: Record<string, unknown> = {}) {
    super(undefined, config);
    this.host = (config.host as string) || 'http://localhost:11434';
  }
  
  get name(): string {
    return 'local';
  }
  
  get defaultModel(): string {
    return 'llama3.2';
  }
  
  getAvailableModels(): ModelInfo[] {
    // These are common Ollama models - actual availability depends on what's pulled
    return [
      {
        name: 'llama3.2',
        provider: 'local',
        capabilities: [
          ProviderCapability.TEXT_COMPLETION,
          ProviderCapability.STREAMING,
        ],
        maxTokens: 4096,
        supportsJsonMode: false,
        supportsFunctionCalling: false,
        costPer1kInput: 0,
        costPer1kOutput: 0,
        contextWindow: 128000,
        description: 'Llama 3.2 - Good all-around local model',
      },
      {
        name: 'llama3.2:1b',
        provider: 'local',
        capabilities: [
          ProviderCapability.TEXT_COMPLETION,
          ProviderCapability.STREAMING,
        ],
        maxTokens: 4096,
        supportsJsonMode: false,
        supportsFunctionCalling: false,
        costPer1kInput: 0,
        costPer1kOutput: 0,
        contextWindow: 128000,
        description: 'Llama 3.2 1B - Fast, low memory',
      },
      {
        name: 'mistral',
        provider: 'local',
        capabilities: [
          ProviderCapability.TEXT_COMPLETION,
          ProviderCapability.STREAMING,
        ],
        maxTokens: 4096,
        supportsJsonMode: false,
        supportsFunctionCalling: false,
        costPer1kInput: 0,
        costPer1kOutput: 0,
        contextWindow: 32000,
        description: 'Mistral 7B - Good reasoning',
      },
      {
        name: 'phi3',
        provider: 'local',
        capabilities: [
          ProviderCapability.TEXT_COMPLETION,
          ProviderCapability.STREAMING,
        ],
        maxTokens: 4096,
        supportsJsonMode: false,
        supportsFunctionCalling: false,
        costPer1kInput: 0,
        costPer1kOutput: 0,
        contextWindow: 128000,
        description: 'Phi-3 - Small but capable',
      },
    ];
  }
  
  hasValidKey(): boolean {
    // Local doesn't need an API key
    return true;
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.host}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const model = request.model || this.defaultModel;
    
    // Build prompt
    let prompt = '';
    
    if (request.systemPrompt) {
      prompt += `System: ${request.systemPrompt}\n\n`;
    }
    
    for (const msg of request.messages) {
      const role = msg.role === 'assistant' ? 'Assistant' : 'User';
      prompt += `${role}: ${msg.content}\n\n`;
    }
    
    prompt += 'Assistant: ';
    
    try {
      const response = await fetch(`${this.host}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature: request.temperature ?? 0.1,
            num_predict: request.maxTokens || 4096,
          },
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        
        if (errorText.includes('model') && errorText.includes('not found')) {
          throw new AIProviderError(
            `Model "${model}" not found. Run: ollama pull ${model}`,
            this.name
          );
        }
        
        throw new AIProviderError(`Ollama error: ${errorText}`, this.name);
      }
      
      const data = await response.json();
      
      return {
        success: true,
        content: data.response || '',
        provider: this.name,
        model,
        usage: data.prompt_eval_count && data.eval_count ? {
          promptTokens: data.prompt_eval_count,
          completionTokens: data.eval_count,
          totalTokens: data.prompt_eval_count + data.eval_count,
        } : undefined,
      };
      
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      
      // Check if Ollama is not running
      if (err instanceof TypeError && (err as Error).message.includes('fetch')) {
        throw new AIProviderError(
          'Ollama is not running. Start it with: ollama serve',
          this.name,
          true
        );
      }
      
      throw new AIProviderError(
        err instanceof Error ? err.message : 'Unknown error',
        this.name
      );
    }
  }
}

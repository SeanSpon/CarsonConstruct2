/**
 * Google Gemini Provider
 * 
 * Best for: Free tier, vision analysis, long context (1M tokens), image generation
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

export class GeminiProvider extends AIProvider {
  get name(): string {
    return 'gemini';
  }
  
  get defaultModel(): string {
    return 'gemini-1.5-flash';
  }
  
  getAvailableModels(): ModelInfo[] {
    return [
      {
        name: 'gemini-1.5-pro',
        provider: 'gemini',
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
        costPer1kInput: 0.0035,
        costPer1kOutput: 0.0105,
        contextWindow: 1000000, // 1M tokens!
        description: 'Most capable Gemini model',
      },
      {
        name: 'gemini-1.5-flash',
        provider: 'gemini',
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
        costPer1kInput: 0.000075,
        costPer1kOutput: 0.0003,
        contextWindow: 1000000,
        description: 'Fast and cheap with free tier',
      },
      {
        name: 'gemini-2.0-flash-exp',
        provider: 'gemini',
        capabilities: [
          ProviderCapability.TEXT_COMPLETION,
          ProviderCapability.STRUCTURED_OUTPUT,
          ProviderCapability.FUNCTION_CALLING,
          ProviderCapability.VISION,
          ProviderCapability.IMAGE_GENERATION,
          ProviderCapability.STREAMING,
        ],
        maxTokens: 8192,
        supportsJsonMode: true,
        supportsFunctionCalling: true,
        costPer1kInput: 0,
        costPer1kOutput: 0,
        contextWindow: 1000000,
        description: 'Experimental with image generation',
      },
    ];
  }
  
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.apiKey) {
      throw new AuthenticationError('Google API key required', this.name);
    }
    
    const model = request.model || this.defaultModel;
    
    // Build contents array for Gemini format
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    
    // Add system instruction if provided
    let systemInstruction: { parts: Array<{ text: string }> } | undefined;
    if (request.systemPrompt) {
      systemInstruction = { parts: [{ text: request.systemPrompt }] };
    }
    
    // Convert messages
    for (const msg of request.messages) {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      contents.push({
        role,
        parts: [{ text: msg.content }],
      });
    }
    
    // Build request body
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: request.maxTokens || 4096,
        temperature: request.temperature ?? 0.1,
      },
    };
    
    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }
    
    // Add tools if provided
    if (request.tools && request.tools.length > 0) {
      body.tools = [{
        functionDeclarations: request.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        })),
      }];
    }
    
    try {
      // Log request for debugging
      console.log('[GeminiProvider] Request:', {
        model,
        hasTools: !!(request.tools && request.tools.length > 0),
        toolCount: request.tools?.length || 0,
      });
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GeminiProvider] API Error:', response.status, errorText);
        
        if (response.status === 401 || response.status === 403) {
          throw new AuthenticationError('Invalid Google API key', this.name);
        }
        if (response.status === 429) {
          throw new RateLimitError('Rate limit exceeded', this.name);
        }
        
        throw new AIProviderError(`API error ${response.status}: ${errorText}`, this.name);
      }
      
      const data = await response.json();
      
      const candidate = data.candidates?.[0];
      
      // Log response for debugging  
      console.log('[GeminiProvider] Response:', {
        finishReason: candidate?.finishReason,
        partsCount: candidate?.content?.parts?.length || 0,
        partTypes: candidate?.content?.parts?.map((p: { text?: string; functionCall?: unknown }) => 
          p.text ? 'text' : p.functionCall ? 'functionCall' : 'unknown'
        ) || [],
      });
      
      if (!candidate) {
        throw new AIProviderError('No response from Gemini', this.name);
      }
      
      // Parse content
      let content = '';
      const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];
      
      for (const part of candidate.content?.parts || []) {
        if (part.text) {
          content += part.text;
        }
        if (part.functionCall) {
          console.log('[GeminiProvider] Found functionCall:', part.functionCall.name);
          toolCalls.push({
            id: `gemini_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: part.functionCall.name,
            arguments: part.functionCall.args || {},
          });
        }
      }
      
      // Check if stopped for function calling - Gemini uses different finish reasons
      // FUNCTION_CALL is the actual finish reason when tools are called
      const requiresToolResults = (candidate.finishReason === 'STOP' || candidate.finishReason === 'FUNCTION_CALL') && toolCalls.length > 0;
      
      if (toolCalls.length > 0) {
        console.log('[GeminiProvider] Parsed tool calls:', toolCalls.map(tc => tc.name));
      }
      
      return {
        success: true,
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        requiresToolResults,
        provider: this.name,
        model,
        usage: data.usageMetadata ? {
          promptTokens: data.usageMetadata.promptTokenCount || 0,
          completionTokens: data.usageMetadata.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata.totalTokenCount || 0,
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
  
  async analyzeImage(
    imagePath: string,
    prompt: string
  ): Promise<CompletionResponse> {
    if (!this.apiKey) {
      throw new AuthenticationError('Google API key required', this.name);
    }
    
    // For now, just do text completion with the prompt
    // Full vision implementation would read the image and send as base64
    return this.complete({
      messages: [{ role: 'user', content: `[Image analysis requested: ${imagePath}] ${prompt}` }],
    });
  }
}

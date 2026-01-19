/**
 * Capability Router - Automatically selects the best AI provider for each task
 * 
 * Mirrors the Python ai/providers/ architecture.
 * Routes tasks to providers based on capabilities and API key availability.
 */

import { AIProvider, ProviderCapability, CompletionResponse, CompletionRequest } from './providers/base';
import { AnthropicProvider } from './providers/anthropic';
import { OpenAIProvider } from './providers/openai';
import { GeminiProvider } from './providers/gemini';
import { LocalProvider } from './providers/local';

// ============================================
// TYPES
// ============================================

export type ProviderType = 'anthropic' | 'openai' | 'gemini' | 'local';

export interface ProviderConfig {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  ollamaHost?: string;
}

export interface RouteResult {
  provider: AIProvider;
  providerName: ProviderType;
  reason: string;
}

// ============================================
// PRIORITY CHAINS
// ============================================

// Define fallback chains for each capability
const CAPABILITY_CHAINS: Record<ProviderCapability, ProviderType[]> = {
  [ProviderCapability.TEXT_COMPLETION]: ['anthropic', 'openai', 'gemini', 'local'],
  [ProviderCapability.STRUCTURED_OUTPUT]: ['anthropic', 'openai', 'gemini'],
  [ProviderCapability.FUNCTION_CALLING]: ['anthropic', 'openai', 'gemini'],
  [ProviderCapability.TRANSCRIPTION]: ['openai', 'local'], // Whisper
  [ProviderCapability.VISION]: ['gemini', 'openai', 'anthropic'],
  [ProviderCapability.IMAGE_GENERATION]: ['gemini', 'openai'], // Gemini 2.0, DALL-E
  [ProviderCapability.EMBEDDING]: ['openai', 'local'],
  [ProviderCapability.STREAMING]: ['anthropic', 'openai', 'gemini', 'local'],
};

// ============================================
// ROUTER
// ============================================

export class CapabilityRouter {
  private providers: Map<ProviderType, AIProvider> = new Map();
  private config: ProviderConfig;
  
  constructor(config: ProviderConfig) {
    this.config = config;
    this.initializeProviders();
  }
  
  private initializeProviders(): void {
    // Initialize all providers with their keys
    if (this.config.anthropicApiKey) {
      this.providers.set('anthropic', new AnthropicProvider(this.config.anthropicApiKey));
    }
    
    if (this.config.openaiApiKey) {
      this.providers.set('openai', new OpenAIProvider(this.config.openaiApiKey));
    }
    
    if (this.config.geminiApiKey) {
      this.providers.set('gemini', new GeminiProvider(this.config.geminiApiKey));
    }
    
    // Local doesn't need an API key
    this.providers.set('local', new LocalProvider({
      host: this.config.ollamaHost || 'http://localhost:11434',
    }));
  }
  
  /**
   * Get the best provider for a specific capability
   */
  getProviderForCapability(capability: ProviderCapability): RouteResult | null {
    const chain = CAPABILITY_CHAINS[capability];
    
    for (const providerType of chain) {
      const provider = this.providers.get(providerType);
      
      if (provider && provider.hasValidKey() && provider.supports(capability)) {
        return {
          provider,
          providerName: providerType,
          reason: `Best available for ${capability}`,
        };
      }
    }
    
    return null;
  }
  
  /**
   * Get the best provider for chat/text completion (most common)
   */
  getChatProvider(): RouteResult | null {
    return this.getProviderForCapability(ProviderCapability.TEXT_COMPLETION);
  }
  
  /**
   * Get provider for transcription
   */
  getTranscriptionProvider(): RouteResult | null {
    return this.getProviderForCapability(ProviderCapability.TRANSCRIPTION);
  }
  
  /**
   * Get provider for vision/image analysis
   */
  getVisionProvider(): RouteResult | null {
    return this.getProviderForCapability(ProviderCapability.VISION);
  }
  
  /**
   * Get provider for image generation
   */
  getImageGenProvider(): RouteResult | null {
    return this.getProviderForCapability(ProviderCapability.IMAGE_GENERATION);
  }
  
  /**
   * Get a specific provider by name
   */
  getProvider(type: ProviderType): AIProvider | undefined {
    return this.providers.get(type);
  }
  
  /**
   * Check which providers are available
   */
  getAvailableProviders(): ProviderType[] {
    const available: ProviderType[] = [];
    
    for (const [type, provider] of this.providers) {
      if (provider.hasValidKey()) {
        available.push(type);
      }
    }
    
    return available;
  }
  
  /**
   * Update config and reinitialize providers
   */
  updateConfig(config: Partial<ProviderConfig>): void {
    this.config = { ...this.config, ...config };
    this.providers.clear();
    this.initializeProviders();
  }
  
  /**
   * Execute a completion request, auto-routing to best provider
   */
  async complete(
    request: CompletionRequest,
    preferredCapability: ProviderCapability = ProviderCapability.TEXT_COMPLETION
  ): Promise<CompletionResponse & { usedProvider: ProviderType }> {
    const route = this.getProviderForCapability(preferredCapability);
    
    if (!route) {
      return {
        success: false,
        error: `No provider available for ${preferredCapability}. Please configure an API key in settings.`,
        usedProvider: 'local',
      };
    }
    
    try {
      const response = await route.provider.complete(request);
      return {
        ...response,
        provider: route.providerName,
        usedProvider: route.providerName,
      };
    } catch (err) {
      // Try fallback providers
      const chain = CAPABILITY_CHAINS[preferredCapability];
      const currentIndex = chain.indexOf(route.providerName);
      
      for (let i = currentIndex + 1; i < chain.length; i++) {
        const fallbackType = chain[i];
        const fallbackProvider = this.providers.get(fallbackType);
        
        if (fallbackProvider?.hasValidKey() && fallbackProvider.supports(preferredCapability)) {
          try {
            console.log(`[CapabilityRouter] Falling back to ${fallbackType}`);
            const response = await fallbackProvider.complete(request);
            return {
              ...response,
              provider: fallbackType,
              usedProvider: fallbackType,
            };
          } catch {
            continue;
          }
        }
      }
      
      // All providers failed
      return {
        success: false,
        error: err instanceof Error ? err.message : 'All providers failed',
        usedProvider: route.providerName,
      };
    }
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let routerInstance: CapabilityRouter | null = null;

export function getRouter(config?: ProviderConfig): CapabilityRouter {
  if (!routerInstance && config) {
    routerInstance = new CapabilityRouter(config);
  }
  
  if (!routerInstance) {
    // Create with empty config - will be updated later
    routerInstance = new CapabilityRouter({});
  }
  
  return routerInstance;
}

export function updateRouterConfig(config: Partial<ProviderConfig>): void {
  if (routerInstance) {
    routerInstance.updateConfig(config);
  } else {
    routerInstance = new CapabilityRouter(config);
  }
}

// Re-export types
export { ProviderCapability } from './providers/base';

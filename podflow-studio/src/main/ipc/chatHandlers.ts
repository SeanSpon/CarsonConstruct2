/**
 * Chat Handlers - Unified AI chat with automatic provider routing
 * 
 * Uses the capability router to auto-select the best AI provider.
 * No hardcoded API endpoints - all providers go through the router.
 */

import { ipcMain } from 'electron';
import { getRouter, updateRouterConfig, ProviderCapability } from '../ai/capabilityRouter';
import type { CompletionRequest, CompletionResponse, ToolCall } from '../ai/providers/base';

// Tool definitions for the AI
const TOOL_DEFINITIONS = [
  // ========================================
  // ANALYSIS TOOLS
  // ========================================
  {
    name: 'analyze_clip_quality',
    description: 'Run algorithmic analysis on a clip to get detailed quality metrics including hook strength, energy curve, speech density, pacing score, and clipworthiness breakdown.',
    input_schema: {
      type: 'object',
      properties: {
        clipId: {
          type: 'string',
          description: 'The ID of the clip to analyze. If not provided, analyzes the currently selected clip.',
        },
      },
    },
  },
  {
    name: 'analyze_energy_curve',
    description: 'Get the energy/loudness profile over time for a clip or time range.',
    input_schema: {
      type: 'object',
      properties: {
        clipId: { type: 'string', description: 'Analyze energy for a specific clip' },
        startTime: { type: 'number', description: 'Start time in seconds' },
        endTime: { type: 'number', description: 'End time in seconds' },
        resolution: { type: 'number', description: 'Number of data points (default: 50)' },
      },
    },
  },
  {
    name: 'analyze_speech_patterns',
    description: 'Analyze speech patterns including rate, pauses, sentence boundaries. Useful for finding natural cut points.',
    input_schema: {
      type: 'object',
      properties: {
        clipId: { type: 'string', description: 'The clip to analyze' },
        startTime: { type: 'number', description: 'Start time in seconds' },
        endTime: { type: 'number', description: 'End time in seconds' },
      },
    },
  },
  {
    name: 'find_optimal_boundaries',
    description: 'Use VAD and speech analysis to find optimal start/end points that avoid mid-word cuts.',
    input_schema: {
      type: 'object',
      properties: {
        clipId: { type: 'string', description: 'The clip to optimize' },
        preferCleanStart: { type: 'boolean', description: 'Prefer sentence beginning (default: true)' },
        preferCleanEnd: { type: 'boolean', description: 'Prefer sentence end (default: true)' },
        maxExtension: { type: 'number', description: 'Max seconds to extend (default: 3)' },
      },
    },
  },
  {
    name: 'detect_highlights',
    description: 'Run highlight detection to find viral moments (payoff, monologue, laughter patterns).',
    input_schema: {
      type: 'object',
      properties: {
        startTime: { type: 'number', description: 'Start of range (default: 0)' },
        endTime: { type: 'number', description: 'End of range (default: full duration)' },
        patterns: {
          type: 'array',
          items: { type: 'string', enum: ['payoff', 'monologue', 'laughter', 'debate'] },
          description: 'Which patterns to detect (default: all)',
        },
        minScore: { type: 'number', description: 'Minimum score 0-100 (default: 60)' },
      },
    },
  },
  {
    name: 'compare_clips',
    description: 'Compare clips based on hook strength, pacing, energy, and viral potential.',
    input_schema: {
      type: 'object',
      properties: {
        clipIds: { type: 'array', items: { type: 'string' }, description: 'Clip IDs to compare' },
        criteria: {
          type: 'array',
          items: { type: 'string', enum: ['hook', 'energy', 'pacing', 'viral_potential', 'completeness'] },
        },
      },
      required: ['clipIds'],
    },
  },
  // ========================================
  // ACTION TOOLS
  // ========================================
  {
    name: 'smart_trim_clip',
    description: 'Intelligently trim a clip using algorithms to find optimal boundaries.',
    input_schema: {
      type: 'object',
      properties: {
        clipId: { type: 'string', description: 'The clip to trim' },
        strategy: {
          type: 'string',
          enum: ['tighten', 'extend_hook', 'sentence_boundaries', 'energy_peaks'],
          description: 'Trimming strategy',
        },
      },
      required: ['strategy'],
    },
  },
  {
    name: 'auto_review_clips',
    description: 'Automatically review and accept/reject clips based on quality thresholds.',
    input_schema: {
      type: 'object',
      properties: {
        minScore: { type: 'number', description: 'Minimum score to accept (default: 70)' },
        minHookStrength: { type: 'number', description: 'Minimum hook strength (default: 50)' },
        maxToAccept: { type: 'number', description: 'Max clips to accept (default: 10)' },
        dryRun: { type: 'boolean', description: 'Preview only, no changes (default: false)' },
      },
    },
  },
  {
    name: 'suggest_clip_order',
    description: 'Suggest optimal clip order for a compilation based on pacing and energy arc.',
    input_schema: {
      type: 'object',
      properties: {
        strategy: {
          type: 'string',
          enum: ['chronological', 'energy_arc', 'best_first', 'topic_clusters'],
        },
      },
    },
  },
  {
    name: 'run_detection',
    description: 'Start the AI clip detection pipeline to find viral moments in the video. This must be run before you can find/filter highlights. Use this when the user wants to analyze their video for clips.',
    input_schema: {
      type: 'object',
      properties: {
        targetCount: { type: 'number', description: 'Target number of clips to find (default: 10)' },
        minDuration: { type: 'number', description: 'Minimum clip duration in seconds (default: 15)' },
        maxDuration: { type: 'number', description: 'Maximum clip duration in seconds (default: 90)' },
        skipIntro: { type: 'number', description: 'Seconds to skip at start (default: 30)' },
        skipOutro: { type: 'number', description: 'Seconds to skip at end (default: 30)' },
      },
    },
  },
  {
    name: 'create_vod_compilation',
    description: 'Create a VOD (video on demand) compilation from detected clips. Selects the best clips to match target duration and arranges them optimally.',
    input_schema: {
      type: 'object',
      properties: {
        targetDurationMinutes: { type: 'number', description: 'Target VOD duration in minutes (e.g. 20 for 20 minutes)' },
        clipCount: { type: 'number', description: 'Maximum number of clips to include' },
        vibe: { 
          type: 'string', 
          enum: ['best_moments', 'chronological', 'high_energy', 'building'],
          description: 'How to order clips: best_moments (interspersed), chronological, high_energy (best first), building (save best for end)' 
        },
        includeTransitions: { type: 'boolean', description: 'Include crossfade transitions (default: true)' },
      },
    },
  },
  // ========================================
  // UI CONTROL TOOLS
  // ========================================
  {
    name: 'show_panel',
    description: 'Show or focus a panel in the UI',
    input_schema: {
      type: 'object',
      properties: {
        panel: {
          type: 'string',
          enum: ['effects', 'settings', 'timeline', 'clips'],
          description: 'Panel to show',
        },
      },
      required: ['panel'],
    },
  },
  {
    name: 'highlight_element',
    description: 'Highlight an element to draw user attention',
    input_schema: {
      type: 'object',
      properties: {
        elementId: { type: 'string', description: 'Element to highlight' },
        duration: { type: 'number', description: 'Duration in ms (default: 2000)' },
      },
      required: ['elementId'],
    },
  },
  // ========================================
  // BASIC TOOLS
  // ========================================
  {
    name: 'seek_to_time',
    description: 'Seek the video to a specific timestamp',
    input_schema: {
      type: 'object',
      properties: {
        time: { type: 'number', description: 'Timestamp in seconds' },
      },
      required: ['time'],
    },
  },
  {
    name: 'select_clip',
    description: 'Select a clip by ID or index',
    input_schema: {
      type: 'object',
      properties: {
        clipId: { type: 'string', description: 'Clip ID' },
        clipIndex: { type: 'number', description: 'Clip index (0-based)' },
      },
    },
  },
  {
    name: 'set_clip_status',
    description: 'Set clip status (accept, reject, pending)',
    input_schema: {
      type: 'object',
      properties: {
        clipIds: { type: 'array', items: { type: 'string' } },
        status: { type: 'string', enum: ['accepted', 'rejected', 'pending'] },
      },
      required: ['clipIds', 'status'],
    },
  },
  {
    name: 'trim_clip',
    description: 'Adjust trim offsets for a clip',
    input_schema: {
      type: 'object',
      properties: {
        clipId: { type: 'string' },
        trimStartOffset: { type: 'number' },
        trimEndOffset: { type: 'number' },
      },
    },
  },
  {
    name: 'get_project_state',
    description: 'Get current project state including clips and scores',
    input_schema: {
      type: 'object',
      properties: {
        includeTranscript: { type: 'boolean', description: 'Include transcript (default: false)' },
      },
    },
  },
  {
    name: 'get_transcript',
    description: 'Get transcript for a time range or clip',
    input_schema: {
      type: 'object',
      properties: {
        clipId: { type: 'string' },
        startTime: { type: 'number' },
        endTime: { type: 'number' },
      },
    },
  },
  {
    name: 'play_pause',
    description: 'Control video playback',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['play', 'pause', 'toggle'] },
      },
    },
  },
];

// ============================================
// TYPES
// ============================================

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  tools?: boolean;
  systemPrompt?: string;
  // Provider config - sent from settings
  providerConfig?: {
    anthropicApiKey?: string;
    openaiApiKey?: string;
    geminiApiKey?: string;
    ollamaHost?: string;
  };
}

interface ChatResponse {
  success: boolean;
  content?: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  requiresToolResults?: boolean;
  error?: string;
  // Tell UI which provider was used
  provider?: string;
  model?: string;
}

// ============================================
// HANDLERS
// ============================================

export function registerChatHandlers(): void {
  // Update provider config handler
  ipcMain.handle('chat-update-config', async (_event, config: {
    anthropicApiKey?: string;
    openaiApiKey?: string;
    geminiApiKey?: string;
    ollamaHost?: string;
  }) => {
    updateRouterConfig(config);
    const router = getRouter();
    return {
      success: true,
      availableProviders: router.getAvailableProviders(),
    };
  });
  
  // Get available providers handler
  ipcMain.handle('chat-get-providers', async () => {
    const router = getRouter();
    return {
      available: router.getAvailableProviders(),
      chatProvider: router.getChatProvider()?.providerName || null,
      transcriptionProvider: router.getTranscriptionProvider()?.providerName || null,
      visionProvider: router.getVisionProvider()?.providerName || null,
    };
  });

  // Main chat handler - auto-routes to best provider
  ipcMain.handle('chat-with-ai', async (_event, request: ChatRequest): Promise<ChatResponse> => {
    const { messages, tools, systemPrompt, providerConfig } = request;

    // Update router config if provided
    if (providerConfig) {
      updateRouterConfig(providerConfig);
    }

    const router = getRouter();
    const route = router.getChatProvider();
    
    if (!route) {
      console.error('[ChatHandlers] No AI provider available');
      return { 
        success: false, 
        error: 'No AI provider available. Please configure an API key in Settings.' 
      };
    }

    console.log(`[ChatHandlers] Using provider: ${route.providerName}`);
    console.log(`[ChatHandlers] Tools enabled: ${!!tools}, Tool count: ${tools ? TOOL_DEFINITIONS.length : 0}`);

    try {
      const completionRequest: CompletionRequest = {
        messages,
        systemPrompt,
        maxTokens: 4096,
        temperature: 0.1,
      };
      
      if (tools) {
        completionRequest.tools = TOOL_DEFINITIONS;
        console.log('[ChatHandlers] Passing tools to provider:', TOOL_DEFINITIONS.map(t => t.name));
      }

      const response = await route.provider.complete(completionRequest);
      
      // Log the response details
      console.log('[ChatHandlers] Response received:', {
        success: response.success,
        hasContent: !!response.content,
        contentLength: response.content?.length || 0,
        hasToolCalls: !!(response.toolCalls && response.toolCalls.length > 0),
        toolCallCount: response.toolCalls?.length || 0,
        toolCallNames: response.toolCalls?.map(tc => tc.name) || [],
        requiresToolResults: response.requiresToolResults,
      });

      return {
        success: response.success,
        content: response.content,
        thinking: response.thinking,
        toolCalls: response.toolCalls,
        requiresToolResults: response.requiresToolResults,
        error: response.error,
        provider: route.providerName,
        model: response.model,
      };

    } catch (err) {
      console.error('[ChatHandlers] Error:', err);
      
      // Try fallback
      const fallbackResult = await router.complete(
        { messages, systemPrompt, tools: tools ? TOOL_DEFINITIONS : undefined },
        ProviderCapability.TEXT_COMPLETION
      );
      
      if (fallbackResult.success) {
        return {
          ...fallbackResult,
          provider: fallbackResult.usedProvider,
        };
      }
      
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  });

  // Continue chat with tool results
  ipcMain.handle('chat-continue-with-tools', async (_event, request: {
    messages: ChatMessage[];
    toolResults: Array<{ toolName: string; result: unknown }>;
    systemPrompt?: string;
    providerConfig?: {
      anthropicApiKey?: string;
      openaiApiKey?: string;
      geminiApiKey?: string;
      ollamaHost?: string;
    };
  }): Promise<ChatResponse> => {
    const { messages, toolResults, systemPrompt, providerConfig } = request;

    if (providerConfig) {
      updateRouterConfig(providerConfig);
    }

    const router = getRouter();
    const route = router.getChatProvider();
    
    if (!route) {
      return { success: false, error: 'No AI provider available' };
    }

    try {
      // Build messages with tool results
      // This is provider-specific, so we handle it here
      const provider = route.provider;
      const providerName = route.providerName;
      
      // For Anthropic, tool results need special formatting
      if (providerName === 'anthropic') {
        const anthropicMessages = [...messages];
        
        // Add tool results as a user message with tool_result blocks
        const toolResultsContent = toolResults.map(tr => ({
          type: 'tool_result',
          tool_use_id: tr.toolName,
          content: JSON.stringify(tr.result),
        }));
        
        anthropicMessages.push({
          role: 'user',
          content: JSON.stringify(toolResultsContent),
        });
        
        const response = await provider.complete({
          messages: anthropicMessages,
          systemPrompt,
          tools: TOOL_DEFINITIONS,
        });
        
        return {
          success: response.success,
          content: response.content,
          thinking: response.thinking,
          toolCalls: response.toolCalls,
          requiresToolResults: response.requiresToolResults,
          provider: providerName,
          model: response.model,
        };
      }
      
      // For other providers, include tool results in the conversation
      const messagesWithResults = [...messages];
      
      // Add a summary of tool results as an assistant message
      const resultsSummary = toolResults.map(tr => 
        `Tool ${tr.toolName} returned: ${JSON.stringify(tr.result)}`
      ).join('\n');
      
      messagesWithResults.push({
        role: 'assistant',
        content: `I executed the tools. Results:\n${resultsSummary}`,
      });
      
      const response = await provider.complete({
        messages: messagesWithResults,
        systemPrompt,
        tools: TOOL_DEFINITIONS,
      });
      
      return {
        success: response.success,
        content: response.content,
        toolCalls: response.toolCalls,
        requiresToolResults: response.requiresToolResults,
        provider: providerName,
        model: response.model,
      };

    } catch (err) {
      console.error('[ChatHandlers] Error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  });

  console.log('[ChatHandlers] Registered chat handlers with auto-routing');
}

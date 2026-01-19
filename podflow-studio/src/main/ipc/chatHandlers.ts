import { ipcMain } from 'electron';

// Tool definitions for the AI - focused on algorithmic analysis and editing features
const TOOL_DEFINITIONS = [
  // ========================================
  // ANALYSIS TOOLS - Use algorithms to analyze content
  // ========================================
  {
    name: 'analyze_clip_quality',
    description: 'Run algorithmic analysis on a clip to get detailed quality metrics including hook strength, energy curve, speech density, pacing score, and clipworthiness breakdown. Use this to understand WHY a clip is good or bad.',
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
    description: 'Get the energy/loudness profile over time for a clip or time range. Returns an array of energy values that you can reason about to find peaks, buildups, and drops.',
    input_schema: {
      type: 'object',
      properties: {
        clipId: {
          type: 'string',
          description: 'Analyze energy for a specific clip',
        },
        startTime: {
          type: 'number',
          description: 'Start time in seconds (if not using clipId)',
        },
        endTime: {
          type: 'number',
          description: 'End time in seconds (if not using clipId)',
        },
        resolution: {
          type: 'number',
          description: 'Number of data points to return (default: 50)',
        },
      },
    },
  },
  {
    name: 'analyze_speech_patterns',
    description: 'Analyze speech patterns in a clip including speech rate, pause patterns, sentence boundaries, and speaker changes. Useful for finding natural cut points.',
    input_schema: {
      type: 'object',
      properties: {
        clipId: {
          type: 'string',
          description: 'The clip to analyze',
        },
        startTime: {
          type: 'number',
          description: 'Start time in seconds',
        },
        endTime: {
          type: 'number',
          description: 'End time in seconds',
        },
      },
    },
  },
  {
    name: 'find_optimal_boundaries',
    description: 'Use VAD (voice activity detection) and speech analysis to find optimal start/end points for a clip. Returns suggested trim offsets that snap to sentence boundaries and avoid mid-word cuts.',
    input_schema: {
      type: 'object',
      properties: {
        clipId: {
          type: 'string',
          description: 'The clip to optimize',
        },
        preferCleanStart: {
          type: 'boolean',
          description: 'Prefer starting at sentence beginning (default: true)',
        },
        preferCleanEnd: {
          type: 'boolean',
          description: 'Prefer ending at sentence end (default: true)',
        },
        maxExtension: {
          type: 'number',
          description: 'Maximum seconds to extend in either direction (default: 3)',
        },
      },
    },
  },
  {
    name: 'detect_highlights',
    description: 'Run highlight detection algorithms on a time range to find potential viral moments. Uses payoff detection (silence→spike), monologue detection (sustained energy), and laughter detection.',
    input_schema: {
      type: 'object',
      properties: {
        startTime: {
          type: 'number',
          description: 'Start of range to analyze (default: 0)',
        },
        endTime: {
          type: 'number',
          description: 'End of range to analyze (default: full duration)',
        },
        patterns: {
          type: 'array',
          items: { type: 'string', enum: ['payoff', 'monologue', 'laughter', 'debate'] },
          description: 'Which patterns to detect (default: all)',
        },
        minScore: {
          type: 'number',
          description: 'Minimum score threshold (0-100, default: 60)',
        },
      },
    },
  },
  {
    name: 'compare_clips',
    description: 'Compare two or more clips algorithmically and return which is better based on hook strength, pacing, energy, speech clarity, and viral potential.',
    input_schema: {
      type: 'object',
      properties: {
        clipIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of clip IDs to compare',
        },
        criteria: {
          type: 'array',
          items: { type: 'string', enum: ['hook', 'energy', 'pacing', 'speech_clarity', 'viral_potential', 'completeness'] },
          description: 'Criteria to compare on (default: all)',
        },
      },
      required: ['clipIds'],
    },
  },
  // ========================================
  // ACTION TOOLS - Make changes based on analysis
  // ========================================
  {
    name: 'smart_trim_clip',
    description: 'Intelligently trim a clip using algorithms to find optimal boundaries. Automatically snaps to speech boundaries and avoids mid-word cuts.',
    input_schema: {
      type: 'object',
      properties: {
        clipId: {
          type: 'string',
          description: 'The clip to trim',
        },
        strategy: {
          type: 'string',
          enum: ['tighten', 'extend_hook', 'sentence_boundaries', 'energy_peaks'],
          description: 'Trimming strategy: tighten (remove dead air), extend_hook (strengthen opening), sentence_boundaries (clean cuts), energy_peaks (cut at low energy points)',
        },
      },
      required: ['strategy'],
    },
  },
  {
    name: 'auto_review_clips',
    description: 'Automatically review and accept/reject clips based on algorithmic quality thresholds. Returns a summary of decisions made.',
    input_schema: {
      type: 'object',
      properties: {
        minScore: {
          type: 'number',
          description: 'Minimum final score to accept (default: 70)',
        },
        minHookStrength: {
          type: 'number',
          description: 'Minimum hook strength to accept (default: 50)',
        },
        requireCompleteThought: {
          type: 'boolean',
          description: 'Only accept clips marked as complete thoughts (default: false)',
        },
        maxToAccept: {
          type: 'number',
          description: 'Maximum clips to accept (default: 10)',
        },
        dryRun: {
          type: 'boolean',
          description: 'If true, only return recommendations without making changes (default: false)',
        },
      },
    },
  },
  {
    name: 'suggest_clip_order',
    description: 'Analyze accepted clips and suggest an optimal order for a compilation based on pacing, topic flow, and energy arc.',
    input_schema: {
      type: 'object',
      properties: {
        strategy: {
          type: 'string',
          enum: ['chronological', 'energy_arc', 'best_first', 'topic_clusters'],
          description: 'Ordering strategy (default: energy_arc)',
        },
      },
    },
  },
  // ========================================
  // BASIC TOOLS - Simple operations
  // ========================================
  {
    name: 'seek_to_time',
    description: 'Seek the video playhead to a specific timestamp',
    input_schema: {
      type: 'object',
      properties: {
        time: {
          type: 'number',
          description: 'The timestamp in seconds to seek to',
        },
      },
      required: ['time'],
    },
  },
  {
    name: 'select_clip',
    description: 'Select a clip by its ID or index',
    input_schema: {
      type: 'object',
      properties: {
        clipId: { type: 'string', description: 'The ID of the clip to select' },
        clipIndex: { type: 'number', description: 'The index (0-based) of the clip to select' },
      },
    },
  },
  {
    name: 'set_clip_status',
    description: 'Set the status of one or more clips (accept, reject, or reset to pending)',
    input_schema: {
      type: 'object',
      properties: {
        clipIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of clip IDs to update',
        },
        status: {
          type: 'string',
          enum: ['accepted', 'rejected', 'pending'],
          description: 'The status to set',
        },
      },
      required: ['clipIds', 'status'],
    },
  },
  {
    name: 'trim_clip',
    description: 'Manually adjust the trim offsets of a clip',
    input_schema: {
      type: 'object',
      properties: {
        clipId: { type: 'string', description: 'The clip to trim' },
        trimStartOffset: { type: 'number', description: 'Offset in seconds to add to start time' },
        trimEndOffset: { type: 'number', description: 'Offset in seconds to add to end time' },
      },
    },
  },
  {
    name: 'get_project_state',
    description: 'Get the current state of the project including all clips, their scores, and analysis data',
    input_schema: {
      type: 'object',
      properties: {
        includeTranscript: { type: 'boolean', description: 'Include full transcript (default: false)' },
        includeDeadSpaces: { type: 'boolean', description: 'Include dead space regions (default: true)' },
      },
    },
  },
  {
    name: 'get_transcript',
    description: 'Get the transcript for a time range or clip',
    input_schema: {
      type: 'object',
      properties: {
        clipId: { type: 'string', description: 'Get transcript for a specific clip' },
        startTime: { type: 'number', description: 'Start time in seconds' },
        endTime: { type: 'number', description: 'End time in seconds' },
      },
    },
  },
  {
    name: 'play_pause',
    description: 'Toggle video playback or set to specific state',
    input_schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['play', 'pause', 'toggle'],
          description: 'The playback action (default: toggle)',
        },
      },
    },
  },
];

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  model: string;
  apiKey: string;
  tools?: boolean;
  systemPrompt?: string;
}

interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

interface ChatResponse {
  success: boolean;
  content?: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  requiresToolResults?: boolean;
  error?: string;
}

export function registerChatHandlers(): void {
  // Chat with AI handler
  ipcMain.handle('chat-with-ai', async (_event, request: ChatRequest): Promise<ChatResponse> => {
    const { messages, model, apiKey, tools, systemPrompt } = request;

    if (!apiKey) {
      return { success: false, error: 'API key is required' };
    }

    try {
      // Build the request for Anthropic API
      const anthropicMessages = messages.map(msg => ({
        role: msg.role === 'system' ? 'user' : msg.role,
        content: msg.content,
      }));

      const requestBody: Record<string, unknown> = {
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: anthropicMessages,
      };

      // Add system prompt if provided
      if (systemPrompt) {
        requestBody.system = systemPrompt;
      }

      // Add tools if enabled
      if (tools) {
        requestBody.tools = TOOL_DEFINITIONS;
      }

      // Enable extended thinking for supported models
      // Claude claude-sonnet-4-20250514 and later support extended thinking
      const supportsThinking = model?.includes('claude-sonnet-4-20250514') || 
                               model?.includes('claude-3-5') || 
                               model?.includes('claude-3-opus');
      
      if (supportsThinking) {
        // Note: Extended thinking requires specific beta headers
        // For now, we'll use the standard API
      }

      console.log('[ChatHandlers] Sending request to Anthropic API...');

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          // Enable extended thinking beta if available
          // 'anthropic-beta': 'extended-thinking-2024-01-01',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('[ChatHandlers] API error:', response.status, errorData);
        
        // Parse error message if possible
        try {
          const errorJson = JSON.parse(errorData);
          return { 
            success: false, 
            error: errorJson.error?.message || `API error: ${response.status}` 
          };
        } catch {
          return { success: false, error: `API error: ${response.status}` };
        }
      }

      const data = await response.json();
      console.log('[ChatHandlers] Received response:', JSON.stringify(data, null, 2).slice(0, 500));

      // Parse the response
      let content = '';
      let thinking = '';
      const toolCalls: ToolCall[] = [];

      if (data.content && Array.isArray(data.content)) {
        for (const block of data.content) {
          if (block.type === 'text') {
            content += block.text;
          } else if (block.type === 'thinking') {
            thinking += block.thinking;
          } else if (block.type === 'tool_use') {
            toolCalls.push({
              name: block.name,
              arguments: block.input || {},
            });
          }
        }
      }

      // Check if we need tool results (stop_reason === 'tool_use')
      const requiresToolResults = data.stop_reason === 'tool_use';

      return {
        success: true,
        content,
        thinking,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        requiresToolResults,
      };

    } catch (err) {
      console.error('[ChatHandlers] Error:', err);
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
    model: string;
    apiKey: string;
    systemPrompt?: string;
  }): Promise<ChatResponse> => {
    const { messages, toolResults, model, apiKey, systemPrompt } = request;

    if (!apiKey) {
      return { success: false, error: 'API key is required' };
    }

    try {
      // Build messages including tool results
      const anthropicMessages = messages.map(msg => ({
        role: msg.role === 'system' ? 'user' : msg.role,
        content: msg.content,
      }));

      // Add tool results as a user message
      const toolResultsContent = toolResults.map(tr => ({
        type: 'tool_result',
        tool_use_id: tr.toolName, // This should be the actual tool_use_id
        content: JSON.stringify(tr.result),
      }));

      anthropicMessages.push({
        role: 'user',
        content: toolResultsContent as unknown as string,
      });

      const requestBody: Record<string, unknown> = {
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: anthropicMessages,
        tools: TOOL_DEFINITIONS,
      };

      if (systemPrompt) {
        requestBody.system = systemPrompt;
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('[ChatHandlers] API error:', response.status, errorData);
        return { success: false, error: `API error: ${response.status}` };
      }

      const data = await response.json();

      // Parse the response
      let content = '';
      let thinking = '';
      const toolCalls: ToolCall[] = [];

      if (data.content && Array.isArray(data.content)) {
        for (const block of data.content) {
          if (block.type === 'text') {
            content += block.text;
          } else if (block.type === 'thinking') {
            thinking += block.thinking;
          } else if (block.type === 'tool_use') {
            toolCalls.push({
              name: block.name,
              arguments: block.input || {},
            });
          }
        }
      }

      return {
        success: true,
        content,
        thinking,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        requiresToolResults: data.stop_reason === 'tool_use',
      };

    } catch (err) {
      console.error('[ChatHandlers] Error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  });

  console.log('[ChatHandlers] Registered chat handlers');
}

/**
 * ClipBot MVP Page
 * 
 * Story-first podcast clip generation interface.
 * Allows users to:
 * - Select a video file
 * - Configure generation settings
 * - Generate clips with story detection
 * - Preview and export clips
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

// Types
interface VideoInfo {
  path: string;
  name: string;
  size: number;
}

interface GeneratedClip {
  path: string;
  filename: string;
  index: number;
  duration: number;
  story_score: number;
  has_setup: boolean;
  has_conflict: boolean;
  has_payoff: boolean;
  engagement_score: number;
  word_count: number;
  text_preview: string;
  source_start: number;
  source_end: number;
}

interface ClipBotConfig {
  whisperModel: string;
  minDuration: number;
  maxDuration: number;
  maxClips: number;
  minStoryScore: number;
  captionStyle: 'word_by_word' | 'three_word_chunks';
  cutsPerMinute: number;
  stylePreset: 'viral_fast' | 'storytelling' | 'educational' | 'raw_authentic' | 'hype';
}

type PageState = 'idle' | 'configuring' | 'generating' | 'complete' | 'error';

const defaultConfig: ClipBotConfig = {
  whisperModel: 'base',
  minDuration: 15,
  maxDuration: 90,
  maxClips: 10,
  minStoryScore: 40,
  captionStyle: 'three_word_chunks',
  cutsPerMinute: 10,
  stylePreset: 'storytelling',
};

const stylePresets = [
  { id: 'viral_fast', name: 'Viral Fast', description: 'High energy, 15 cuts/min', icon: '🔥' },
  { id: 'storytelling', name: 'Storytelling', description: 'Medium pace, 8 cuts/min', icon: '📖' },
  { id: 'educational', name: 'Educational', description: 'Slower pace, 6 cuts/min', icon: '📚' },
  { id: 'raw_authentic', name: 'Raw Authentic', description: 'Minimal edits, 4 cuts/min', icon: '🎯' },
  { id: 'hype', name: 'Hype', description: 'Maximum energy, 20 cuts/min', icon: '⚡' },
];

export function ClipBotPage() {
  // State
  const [pageState, setPageState] = useState<PageState>('idle');
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [outputDir, setOutputDir] = useState<string>('');
  const [config, setConfig] = useState<ClipBotConfig>(defaultConfig);
  const [jobId, setJobId] = useState<string>('');
  const [progress, setProgress] = useState({ percent: 0, message: '' });
  const [clips, setClips] = useState<GeneratedClip[]>([]);
  const [error, setError] = useState<string>('');

  // Event listeners for ClipBot
  useEffect(() => {
    const unsubProgress = window.api.onClipbotProgress((data) => {
      if (data.jobId === jobId) {
        setProgress({ percent: data.percent, message: data.message });
      }
    });

    const unsubComplete = window.api.onClipbotComplete((data) => {
      if (data.jobId === jobId) {
        setClips(data.clips);
        setOutputDir(data.outputDir);
        setPageState('complete');
      }
    });

    const unsubError = window.api.onClipbotError((data) => {
      if (data.jobId === jobId) {
        setError(data.error);
        setPageState('error');
      }
    });

    return () => {
      unsubProgress();
      unsubComplete();
      unsubError();
    };
  }, [jobId]);

  // Handlers
  const handleSelectVideo = useCallback(async () => {
    const result = await window.api.clipbotSelectVideo();
    if (result) {
      setVideo(result);
      setPageState('configuring');
      setError('');
    }
  }, []);

  const handleSelectOutputDir = useCallback(async () => {
    const result = await window.api.clipbotSelectOutputDir();
    if (result) {
      setOutputDir(result);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!video) return;

    const newJobId = `clipbot_${Date.now()}`;
    setJobId(newJobId);
    setPageState('generating');
    setProgress({ percent: 0, message: 'Starting...' });
    setError('');

    const result = await window.api.clipbotGenerate({
      jobId: newJobId,
      videoPath: video.path,
      outputDir: outputDir || '',
      config,
    });

    if (!result.success) {
      setError(result.error || 'Failed to start generation');
      setPageState('error');
    } else if (result.outputDir) {
      setOutputDir(result.outputDir);
    }
  }, [video, outputDir, config]);

  const handleCancel = useCallback(async () => {
    if (jobId) {
      await window.api.clipbotCancel(jobId);
      setPageState('configuring');
    }
  }, [jobId]);

  const handleExportClip = useCallback(async (clip: GeneratedClip) => {
    const result = await window.api.clipbotExportClip({
      sourcePath: clip.path,
      suggestedName: clip.filename,
    });

    if (result.success && result.path) {
      // Show success feedback
      alert(`Clip exported to: ${result.path}`);
    }
  }, []);

  const handleOpenFolder = useCallback(async () => {
    if (outputDir) {
      await window.api.clipbotOpenFolder(outputDir);
    }
  }, [outputDir]);

  const handleStartNew = useCallback(() => {
    setPageState('idle');
    setVideo(null);
    setClips([]);
    setOutputDir('');
    setError('');
  }, []);

  // Render helpers
  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return mb >= 1000 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Idle state - select video
  if (pageState === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-sz-text mb-2">🎬 ClipBot</h1>
          <p className="text-sz-text-secondary text-lg">Story-First Podcast Clips</p>
        </div>

        <Button
          size="lg"
          onClick={handleSelectVideo}
          className="px-8 py-4 text-lg"
        >
          📁 Select Video
        </Button>

        <p className="text-sz-text-muted mt-4 text-sm">
          Supports MP4, MOV, AVI, MKV, WebM
        </p>
      </div>
    );
  }

  // Configuring state - set options
  if (pageState === 'configuring') {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-2xl font-bold text-sz-text mb-6">🎬 ClipBot Configuration</h1>

        {/* Selected Video */}
        <Card className="mb-6 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-sz-text">{video?.name}</h3>
              <p className="text-sz-text-muted text-sm">{video && formatSize(video.size)}</p>
            </div>
            <Button variant="ghost" onClick={handleSelectVideo}>
              Change
            </Button>
          </div>
        </Card>

        {/* Style Preset */}
        <h3 className="text-lg font-medium text-sz-text mb-3">Style Preset</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {stylePresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setConfig((c) => ({ ...c, stylePreset: preset.id as typeof c.stylePreset }))}
              className={`p-3 rounded-lg border text-left transition-all ${
                config.stylePreset === preset.id
                  ? 'border-sz-accent bg-sz-accent/10'
                  : 'border-sz-border hover:border-sz-border-light'
              }`}
            >
              <div className="text-2xl mb-1">{preset.icon}</div>
              <div className="font-medium text-sz-text text-sm">{preset.name}</div>
              <div className="text-sz-text-muted text-xs">{preset.description}</div>
            </button>
          ))}
        </div>

        {/* Settings */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sz-text-secondary text-sm mb-1">Min Duration (sec)</label>
            <input
              type="number"
              value={config.minDuration}
              onChange={(e) => setConfig((c) => ({ ...c, minDuration: parseInt(e.target.value) || 15 }))}
              className="w-full px-3 py-2 bg-sz-bg-secondary border border-sz-border rounded-lg text-sz-text"
              min={5}
              max={60}
            />
          </div>
          <div>
            <label className="block text-sz-text-secondary text-sm mb-1">Max Duration (sec)</label>
            <input
              type="number"
              value={config.maxDuration}
              onChange={(e) => setConfig((c) => ({ ...c, maxDuration: parseInt(e.target.value) || 90 }))}
              className="w-full px-3 py-2 bg-sz-bg-secondary border border-sz-border rounded-lg text-sz-text"
              min={30}
              max={180}
            />
          </div>
          <div>
            <label className="block text-sz-text-secondary text-sm mb-1">Max Clips</label>
            <input
              type="number"
              value={config.maxClips}
              onChange={(e) => setConfig((c) => ({ ...c, maxClips: parseInt(e.target.value) || 10 }))}
              className="w-full px-3 py-2 bg-sz-bg-secondary border border-sz-border rounded-lg text-sz-text"
              min={1}
              max={20}
            />
          </div>
          <div>
            <label className="block text-sz-text-secondary text-sm mb-1">Caption Style</label>
            <select
              value={config.captionStyle}
              onChange={(e) => setConfig((c) => ({ ...c, captionStyle: e.target.value as typeof c.captionStyle }))}
              className="w-full px-3 py-2 bg-sz-bg-secondary border border-sz-border rounded-lg text-sz-text"
            >
              <option value="three_word_chunks">3-Word Chunks</option>
              <option value="word_by_word">Word by Word</option>
            </select>
          </div>
        </div>

        {/* Output Directory (optional) */}
        <div className="mb-6">
          <label className="block text-sz-text-secondary text-sm mb-1">Output Directory (optional)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={outputDir}
              readOnly
              placeholder="Auto-generated if not specified"
              className="flex-1 px-3 py-2 bg-sz-bg-secondary border border-sz-border rounded-lg text-sz-text text-sm"
            />
            <Button variant="secondary" onClick={handleSelectOutputDir}>
              Browse
            </Button>
          </div>
        </div>

        {/* Generate Button */}
        <div className="flex gap-4">
          <Button onClick={handleStartNew} variant="ghost">
            ← Back
          </Button>
          <Button onClick={handleGenerate} className="flex-1">
            🚀 Generate Clips
          </Button>
        </div>
      </div>
    );
  }

  // Generating state - show progress
  if (pageState === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-sz-text mb-2">Generating Clips...</h1>
          <p className="text-sz-text-secondary">{video?.name}</p>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-md mb-4">
          <div className="h-2 bg-sz-bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-sz-accent transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-sz-text-secondary">{progress.message}</span>
            <span className="text-sz-text-muted">{progress.percent}%</span>
          </div>
        </div>

        {/* Spinner */}
        <div className="w-12 h-12 border-4 border-sz-bg-tertiary border-t-sz-accent rounded-full animate-spin mb-8" />

        <Button variant="secondary" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    );
  }

  // Error state
  if (pageState === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-sz-danger mb-2">❌ Error</h1>
          <p className="text-sz-text-secondary max-w-md">{error}</p>
        </div>

        <div className="flex gap-4">
          <Button onClick={handleStartNew}>
            Start New
          </Button>
          <Button variant="secondary" onClick={() => setPageState('configuring')}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Complete state - show clips
  if (pageState === 'complete') {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-sz-text">✅ Generated {clips.length} Clips</h1>
            <p className="text-sz-text-secondary">{video?.name}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleOpenFolder}>
              📂 Open Folder
            </Button>
            <Button onClick={handleStartNew}>
              ← Start New
            </Button>
          </div>
        </div>

        {/* Clips Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clips.map((clip) => (
            <Card key={clip.index} className="overflow-hidden">
              {/* Video Preview */}
              <div className="aspect-[9/16] bg-black relative">
                <video
                  src={`file://${clip.path}`}
                  className="w-full h-full object-contain"
                  controls
                  preload="metadata"
                />
              </div>

              {/* Clip Info */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sz-text">Clip {clip.index}</h3>
                  <span className="px-2 py-1 bg-sz-accent/20 text-sz-accent rounded text-sm font-medium">
                    ⭐ {clip.story_score}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-sm text-sz-text-secondary mb-2">
                  <span>⏱️ {formatDuration(clip.duration)}</span>
                  <span>📝 {clip.word_count} words</span>
                </div>

                {/* Story elements */}
                <div className="flex gap-2 mb-3 text-xs">
                  <span className={`px-2 py-0.5 rounded ${clip.has_setup ? 'bg-green-500/20 text-green-400' : 'bg-sz-bg-tertiary text-sz-text-muted'}`}>
                    Setup {clip.has_setup ? '✓' : '✗'}
                  </span>
                  <span className={`px-2 py-0.5 rounded ${clip.has_conflict ? 'bg-yellow-500/20 text-yellow-400' : 'bg-sz-bg-tertiary text-sz-text-muted'}`}>
                    Conflict {clip.has_conflict ? '✓' : '✗'}
                  </span>
                  <span className={`px-2 py-0.5 rounded ${clip.has_payoff ? 'bg-blue-500/20 text-blue-400' : 'bg-sz-bg-tertiary text-sz-text-muted'}`}>
                    Payoff {clip.has_payoff ? '✓' : '✗'}
                  </span>
                </div>

                {/* Text preview */}
                <p className="text-sz-text-muted text-sm line-clamp-3 mb-3">
                  {clip.text_preview}
                </p>

                {/* Export button */}
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => handleExportClip(clip)}
                >
                  💾 Export
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {clips.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sz-text-secondary">No clips were generated.</p>
            <p className="text-sz-text-muted text-sm mt-2">
              Try adjusting the settings or using a different video.
            </p>
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default ClipBotPage;

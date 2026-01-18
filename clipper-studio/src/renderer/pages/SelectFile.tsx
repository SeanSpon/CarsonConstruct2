import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileVideo, Upload, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { formatFileSize, formatDuration } from '../types';

export default function SelectFile() {
  const navigate = useNavigate();
  const { filePath, fileName, fileSize, fileDuration, setFile, clearFile } = useProjectStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectFile = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const file = await window.api.selectFile();
      
      if (!file) {
        setIsLoading(false);
        return;
      }

      // Validate the file
      const validation = await window.api.validateFile(file.path);
      
      if (!validation.valid) {
        setError(validation.error || 'Invalid video file');
        setIsLoading(false);
        return;
      }

      setFile({
        path: file.path,
        name: file.name,
        size: file.size,
        duration: validation.duration,
        valid: true,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = () => {
    if (filePath) {
      navigate('/processing');
    }
  };

  const handleClear = () => {
    clearFile();
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      {/* Logo / Title */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Sparkles className="w-10 h-10 text-violet-500" />
          <h1 className="text-4xl font-bold">
            <span className="text-violet-400">Clipper</span> Studio
          </h1>
        </div>
        <p className="text-zinc-400 text-lg">
          Find viral moments in your podcasts. No AI, no upload, no wait.
        </p>
      </div>

      {/* File Selection Area */}
      <div className="w-full max-w-xl">
        {!filePath ? (
          // Drop zone
          <button
            onClick={handleSelectFile}
            disabled={isLoading}
            className={`
              w-full border-2 border-dashed rounded-2xl p-12 text-center 
              transition-all duration-200 cursor-pointer
              ${isLoading 
                ? 'border-zinc-700 bg-zinc-900/50 cursor-wait' 
                : 'border-zinc-700 hover:border-violet-500 hover:bg-violet-500/5 bg-zinc-900/30'
              }
            `}
          >
            {isLoading ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 text-violet-500 animate-spin" />
                <p className="text-zinc-300">Reading file...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center">
                  <FileVideo className="w-10 h-10 text-zinc-400" />
                </div>
                <div>
                  <p className="text-xl font-medium text-zinc-200">Select your podcast video</p>
                  <p className="text-sm text-zinc-500 mt-2">MP4, MOV, WEBM, MKV supported</p>
                </div>
                <div className="mt-4 px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-lg font-medium text-white transition-colors">
                  <Upload className="w-4 h-4 inline-block mr-2" />
                  Choose File
                </div>
              </div>
            )}
          </button>
        ) : (
          // Selected file display
          <div className="border border-zinc-800 rounded-2xl p-6 bg-zinc-900/50">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                <FileVideo className="w-7 h-7 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-zinc-100 truncate">{fileName}</h3>
                <div className="flex items-center gap-4 mt-1 text-sm text-zinc-400">
                  <span>{formatFileSize(fileSize)}</span>
                  <span>•</span>
                  <span>{formatDuration(fileDuration)}</span>
                </div>
              </div>
              <button
                onClick={handleClear}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                Change
              </button>
            </div>

            {/* Analyze button */}
            <button
              onClick={handleAnalyze}
              className="w-full mt-6 py-4 bg-violet-600 hover:bg-violet-500 rounded-xl font-semibold text-white text-lg transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Analyze for Viral Moments
            </button>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">Error</p>
              <p className="text-red-300/80 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Feature highlights */}
      <div className="mt-16 grid grid-cols-3 gap-8 text-center max-w-2xl">
        <div>
          <div className="text-3xl mb-2">⚡</div>
          <h3 className="font-semibold text-zinc-200">90 Seconds</h3>
          <p className="text-sm text-zinc-500">2hr video analyzed</p>
        </div>
        <div>
          <div className="text-3xl mb-2">🎯</div>
          <h3 className="font-semibold text-zinc-200">2 Viral Patterns</h3>
          <p className="text-sm text-zinc-500">Payoff + Monologue</p>
        </div>
        <div>
          <div className="text-3xl mb-2">💰</div>
          <h3 className="font-semibold text-zinc-200">$0 Cost</h3>
          <p className="text-sm text-zinc-500">No AI, no servers</p>
        </div>
      </div>
    </div>
  );
}

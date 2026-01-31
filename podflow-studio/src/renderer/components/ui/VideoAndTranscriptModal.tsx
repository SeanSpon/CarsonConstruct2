import { useState } from 'react';

interface VideoAndTranscriptModalProps {
  onConfirm: (data: { videoPath: string; videoName: string; videoSize: number; videoHash: string }) => void;
  onCancel: () => void;
}

export function VideoAndTranscriptModal({ onConfirm, onCancel }: VideoAndTranscriptModalProps) {
  const [videoFile, setVideoFile] = useState<{ path: string; name: string; size: number } | null>(null);
  const [transcriptSegments, setTranscriptSegments] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectVideo = async () => {
    try {
      setLoading(true);
      const file = await window.api.selectFile();
      if (!file) return;

      const validation = await window.api.validateFile(file.path);
      if (!validation.valid) {
        setError(validation.error || 'Invalid video file');
        return;
      }

      setVideoFile({ path: file.path, name: file.name, size: file.size });
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUploadTranscript = async () => {
    if (!videoFile) return;

    try {
      setLoading(true);
      // Use the filename as the videoHash identifier
      const videoHash = videoFile.name;
      console.log('[Modal] Video hash for transcript:', videoHash);
      const result = await window.api.uploadTranscript({
        projectId: `temp_${Date.now()}`,
        videoHash: videoHash,
      });

      if (result.success) {
        setTranscriptSegments(result.segmentCount || 0);
        setError(null);
      } else {
        setError(result.error || 'Failed to upload transcript');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || 'Transcript upload failed');
    } finally {
      setLoading(false);
    }
  };

  // Can proceed with just video file - transcript auto-generated
  const canProceed = videoFile !== null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-sz-bg text-sz-text rounded-2xl border border-sz-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-sz-border bg-sz-bg-secondary">
          <h2 className="text-2xl font-bold">Create New Project</h2>
          <p className="text-sm text-sz-text-muted mt-1">Upload video • Transcript auto-generated</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Step 1: Video Upload */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${videoFile ? 'bg-green-600 text-white' : 'bg-sz-bg-secondary text-sz-text-muted'}`}>
                {videoFile ? '✓' : '1'}
              </span>
              Video File
            </h3>
            {videoFile ? (
              <div className="p-3 bg-sz-bg-secondary rounded-lg border border-green-600/30">
                <p className="text-sm font-medium text-green-400">✓ {videoFile.name}</p>
                <p className="text-xs text-sz-text-muted mt-1">
                  {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                </p>
                <button
                  onClick={() => setVideoFile(null)}
                  className="mt-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Change video
                </button>
              </div>
            ) : (
              <button
                onClick={handleSelectVideo}
                disabled={loading}
                className="w-full px-4 py-3 bg-sz-bg-secondary hover:bg-sz-bg-tertiary border border-sz-border rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : '📹 Select Video File'}
              </button>
            )}
          </div>

          {/* Step 2: Transcript Upload (Optional Override) */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${transcriptSegments ? 'bg-green-600 text-white' : 'bg-blue-500/50 text-white'}`}>
                {transcriptSegments ? '✓' : '⚡'}
              </span>
              Transcript File (Optional)
            </h3>
            <p className="text-xs text-sz-text-muted">
              Auto-generated if not provided • Formats: SRT, VTT, or JSON
            </p>
            {transcriptSegments ? (
              <div className="p-3 bg-sz-bg-secondary rounded-lg border border-green-600/30">
                <p className="text-sm font-medium text-green-400">✓ {transcriptSegments} captions loaded</p>
                <button
                  onClick={() => setTranscriptSegments(null)}
                  className="mt-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Change transcript
                </button>
              </div>
            ) : (
              <button
                onClick={handleUploadTranscript}
                disabled={!videoFile || loading}
                className="w-full px-4 py-3 bg-sz-bg-secondary hover:bg-sz-bg-tertiary border border-sz-border rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Uploading...' : '📄 Override with Custom Transcript'}
              </button>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-sm space-y-2">
            <p className="font-semibold">✓ Transcript Handling</p>
            <ul className="text-xs text-sz-text-muted space-y-1 list-disc list-inside">
              <li>Auto-transcribes with word-level timing</li>
              <li>Viral karaoke-style captions included</li>
              <li>Upload custom transcript to override</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-sz-border">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-sz-bg-secondary hover:bg-sz-bg-tertiary border border-sz-border rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (videoFile) {
                  // Use filename as the videoHash identifier
                  onConfirm({
                    videoPath: videoFile.path,
                    videoName: videoFile.name,
                    videoSize: videoFile.size,
                    videoHash: videoFile.name,
                  });
                }
              }}
              disabled={!canProceed}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Detection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

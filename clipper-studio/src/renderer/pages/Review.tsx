import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ArrowLeft, Check, X, Clock } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import ClipCard from '../components/ClipCard';
import ExportModal from '../components/ExportModal';

export default function Review() {
  const navigate = useNavigate();
  const { filePath, fileName, clips, reset } = useProjectStore();
  const [showExportModal, setShowExportModal] = useState(false);

  // Redirect if no clips
  useEffect(() => {
    if (!filePath || clips.length === 0) {
      navigate('/');
    }
  }, [filePath, clips, navigate]);

  const acceptedClips = clips.filter(c => c.status === 'accepted');
  const rejectedClips = clips.filter(c => c.status === 'rejected');
  const pendingClips = clips.filter(c => c.status === 'pending');

  const handleStartOver = () => {
    reset();
    navigate('/');
  };

  if (!filePath) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleStartOver}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-zinc-400" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-zinc-100">Review Clips</h1>
                <p className="text-sm text-zinc-500 truncate max-w-md">{fileName}</p>
              </div>
            </div>

            <button
              onClick={() => setShowExportModal(true)}
              disabled={acceptedClips.length === 0}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-colors ${
                acceptedClips.length > 0
                  ? 'bg-violet-600 hover:bg-violet-500 text-white'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              <Download className="w-4 h-4" />
              Export {acceptedClips.length} Clips
            </button>
          </div>

          {/* Stats bar */}
          <div className="flex gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-sm text-zinc-300">
                <span className="font-semibold text-emerald-400">{acceptedClips.length}</span> accepted
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm text-zinc-300">
                <span className="font-semibold text-red-400">{rejectedClips.length}</span> rejected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-zinc-500" />
              <span className="text-sm text-zinc-300">
                <span className="font-semibold text-zinc-400">{pendingClips.length}</span> pending
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Clips Grid */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {clips.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-400">No clips detected. Try a different video.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clips.map((clip) => (
              <ClipCard key={clip.id} clip={clip} videoPath={filePath} />
            ))}
          </div>
        )}
      </main>

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          clips={acceptedClips}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}

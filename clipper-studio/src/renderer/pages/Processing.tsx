import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, XCircle, AlertCircle } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';

// Simplified steps for 2-pattern detection
const STEPS = [
  { id: 'extracting', label: 'Extracting audio', targetProgress: 20 },
  { id: 'payoff', label: 'Detecting payoff moments', targetProgress: 50 },
  { id: 'monologue', label: 'Detecting energy monologues', targetProgress: 75 },
  { id: 'scoring', label: 'Scoring and selecting clips', targetProgress: 100 },
];

export default function Processing() {
  const navigate = useNavigate();
  const {
    filePath,
    fileName,
    detectionProgress,
    detectionError,
    setDetecting,
    setDetectionProgress,
    setDetectionError,
    setClips,
  } = useProjectStore();
  
  const [hasStarted, setHasStarted] = useState(false);

  // Start detection when component mounts
  useEffect(() => {
    if (!filePath) {
      navigate('/');
      return;
    }

    if (hasStarted) return;
    setHasStarted(true);

    const startDetection = async () => {
      setDetecting(true);
      setDetectionError(null);

      // Set up event listeners
      const unsubProgress = window.api.onDetectionProgress((data) => {
        setDetectionProgress(data);
      });

      const unsubComplete = window.api.onDetectionComplete((data) => {
        setClips(data.clips, data.waveform);
        navigate('/review');
      });

      const unsubError = window.api.onDetectionError((data) => {
        setDetectionError(data.error);
        setDetecting(false);
      });

      // Start the detection
      const result = await window.api.startDetection(filePath);
      
      if (!result.success) {
        setDetectionError(result.error || 'Failed to start detection');
        setDetecting(false);
      }

      // Cleanup on unmount
      return () => {
        unsubProgress();
        unsubComplete();
        unsubError();
      };
    };

    startDetection();
  }, [filePath, hasStarted, navigate, setDetecting, setDetectionProgress, setDetectionError, setClips]);

  const handleCancel = async () => {
    await window.api.cancelDetection();
    navigate('/');
  };

  const handleRetry = () => {
    setHasStarted(false);
    setDetectionError(null);
  };

  const currentStep = detectionProgress?.step || 'extracting';
  const currentProgress = detectionProgress?.progress || 0;
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  if (detectionError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-100 mb-2">Detection Failed</h2>
          <p className="text-zinc-400 mb-6 text-sm">{detectionError}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium text-zinc-200 transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={handleRetry}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-lg font-medium text-white transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-lg text-center">
        {/* Spinner */}
        <div className="mb-8">
          <Loader2 className="w-16 h-16 text-violet-500 animate-spin mx-auto" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">
          Finding Viral Moments
        </h2>
        <p className="text-zinc-400 mb-8 truncate">
          {fileName}
        </p>

        {/* Progress bar */}
        <div className="w-full bg-zinc-800 rounded-full h-3 mb-4 overflow-hidden">
          <div
            className="bg-gradient-to-r from-violet-600 to-violet-400 h-3 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${currentProgress}%` }}
          />
        </div>

        {/* Progress percentage */}
        <p className="text-3xl font-bold text-violet-400 mb-2">
          {currentProgress}%
        </p>
        
        {/* Current step message */}
        <p className="text-zinc-400 mb-8">
          {detectionProgress?.message || 'Initializing...'}
        </p>

        {/* Steps list */}
        <div className="space-y-3 text-left">
          {STEPS.map((step, index) => {
            const isComplete = index < currentStepIndex || 
              (index === currentStepIndex && currentProgress >= step.targetProgress);
            const isCurrent = index === currentStepIndex && currentProgress < step.targetProgress;
            
            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 py-2 px-4 rounded-lg transition-colors ${
                  isCurrent ? 'bg-violet-500/10' : ''
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  isComplete 
                    ? 'bg-emerald-500 text-white' 
                    : isCurrent 
                      ? 'bg-violet-500 text-white' 
                      : 'bg-zinc-800 text-zinc-500'
                }`}>
                  {isComplete ? '✓' : index + 1}
                </div>
                <span className={`${
                  isComplete 
                    ? 'text-zinc-400' 
                    : isCurrent 
                      ? 'text-zinc-100 font-medium' 
                      : 'text-zinc-600'
                }`}>
                  {step.label}
                </span>
                {isCurrent && (
                  <Loader2 className="w-4 h-4 text-violet-400 animate-spin ml-auto" />
                )}
              </div>
            );
          })}
        </div>

        {/* Cancel button */}
        <button
          onClick={handleCancel}
          className="mt-8 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium text-zinc-300 transition-colors flex items-center gap-2 mx-auto"
        >
          <XCircle className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}

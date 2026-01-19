import { memo, useState, useCallback } from 'react';
import { Film, Scissors, Video, Mic, ArrowRight, Upload, Link as LinkIcon, MessageSquare } from 'lucide-react';

export type ProjectType = 'short-form' | 'long-form' | 'long-form-clips';

export interface EditingPreferences {
  projectType: ProjectType;
  bRollEnabled: boolean;
  referenceVideoUrl: string;
  editingPrompt: string;
  pacingStyle: 'fast' | 'moderate' | 'slow' | 'match-reference';
  cameras: CameraInput[];
}

export interface CameraInput {
  id: string;
  name: string;
  filePath: string;
  speakerName?: string;
  isMain: boolean;
}

interface ProjectSetupProps {
  onComplete: (preferences: EditingPreferences) => void;
  onBack: () => void;
  initialPreferences?: Partial<EditingPreferences>;
}

const projectTypes: Array<{
  type: ProjectType;
  title: string;
  description: string;
  icon: React.ReactNode;
  recommended?: boolean;
}> = [
  {
    type: 'short-form',
    title: 'Short Form Only',
    description: 'Polish an existing short video. Apply cuts, effects, and enhancements.',
    icon: <Scissors className="w-8 h-8" />,
  },
  {
    type: 'long-form',
    title: 'Long Form Only',
    description: 'Edit a full podcast episode. Multi-cam switching, silence removal, no clips.',
    icon: <Video className="w-8 h-8" />,
  },
  {
    type: 'long-form-clips',
    title: 'Long Form + Clips',
    description: 'Full podcast edit plus extract viral short-form clips automatically.',
    icon: <Film className="w-8 h-8" />,
    recommended: true,
  },
];

const pacingOptions = [
  { value: 'fast', label: 'Fast Cuts', description: 'Quick transitions, high energy' },
  { value: 'moderate', label: 'Moderate', description: 'Balanced pacing' },
  { value: 'slow', label: 'Cinematic', description: 'Longer shots, breathing room' },
  { value: 'match-reference', label: 'Match Reference', description: 'Copy style from reference video' },
];

function ProjectSetup({ onComplete, onBack, initialPreferences }: ProjectSetupProps) {
  const [step, setStep] = useState<'type' | 'cameras' | 'style'>('type');
  const [selectedType, setSelectedType] = useState<ProjectType>(
    initialPreferences?.projectType || 'long-form-clips'
  );
  const [cameras, setCameras] = useState<CameraInput[]>(initialPreferences?.cameras || []);
  const [bRollEnabled, setBRollEnabled] = useState(initialPreferences?.bRollEnabled ?? false);
  const [referenceVideoUrl, setReferenceVideoUrl] = useState(initialPreferences?.referenceVideoUrl || '');
  const [editingPrompt, setEditingPrompt] = useState(initialPreferences?.editingPrompt || '');
  const [pacingStyle, setPacingStyle] = useState<EditingPreferences['pacingStyle']>(
    initialPreferences?.pacingStyle || 'moderate'
  );

  const handleAddCamera = useCallback(async () => {
    try {
      const file = await window.api.selectFile();
      if (file) {
        const newCamera: CameraInput = {
          id: `cam_${Date.now()}`,
          name: `Camera ${cameras.length + 1}`,
          filePath: file.path,
          isMain: cameras.length === 0,
        };
        setCameras([...cameras, newCamera]);
      }
    } catch (err) {
      console.error('Failed to select camera file:', err);
    }
  }, [cameras]);

  const handleRemoveCamera = useCallback((id: string) => {
    setCameras(cameras.filter(c => c.id !== id));
  }, [cameras]);

  const handleSetMainCamera = useCallback((id: string) => {
    setCameras(cameras.map(c => ({ ...c, isMain: c.id === id })));
  }, [cameras]);

  const handleUpdateCameraName = useCallback((id: string, name: string) => {
    setCameras(cameras.map(c => c.id === id ? { ...c, name } : c));
  }, [cameras]);

  const handleUpdateSpeakerName = useCallback((id: string, speakerName: string) => {
    setCameras(cameras.map(c => c.id === id ? { ...c, speakerName } : c));
  }, [cameras]);

  const handleComplete = useCallback(() => {
    onComplete({
      projectType: selectedType,
      bRollEnabled,
      referenceVideoUrl,
      editingPrompt,
      pacingStyle,
      cameras,
    });
  }, [onComplete, selectedType, bRollEnabled, referenceVideoUrl, editingPrompt, pacingStyle, cameras]);

  const handleNext = useCallback(() => {
    if (step === 'type') {
      // Skip camera setup for short-form
      if (selectedType === 'short-form') {
        setStep('style');
      } else {
        setStep('cameras');
      }
    } else if (step === 'cameras') {
      setStep('style');
    } else {
      handleComplete();
    }
  }, [step, selectedType, handleComplete]);

  const handleBack = useCallback(() => {
    if (step === 'style') {
      if (selectedType === 'short-form') {
        setStep('type');
      } else {
        setStep('cameras');
      }
    } else if (step === 'cameras') {
      setStep('type');
    } else {
      onBack();
    }
  }, [step, selectedType, onBack]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-sz-bg">
      <div className="w-full max-w-3xl">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {['type', 'cameras', 'style'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step === s
                    ? 'bg-sz-accent text-white'
                    : i < ['type', 'cameras', 'style'].indexOf(step)
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-sz-bg-secondary text-sz-text-muted'
                }`}
              >
                {i + 1}
              </div>
              {i < 2 && (
                <div className={`w-12 h-0.5 ${
                  i < ['type', 'cameras', 'style'].indexOf(step)
                    ? 'bg-emerald-500/40'
                    : 'bg-sz-border'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Project Type Selection */}
        {step === 'type' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-sz-text mb-2">Choose Project Type</h2>
              <p className="text-sz-text-secondary">What kind of video are you editing?</p>
            </div>

            <div className="grid gap-4">
              {projectTypes.map(({ type, title, description, icon, recommended }) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`relative p-6 rounded-xl border-2 transition-all text-left ${
                    selectedType === type
                      ? 'border-sz-accent bg-sz-accent/10'
                      : 'border-sz-border bg-sz-bg-secondary hover:border-sz-border-light hover:bg-sz-bg-tertiary'
                  }`}
                >
                  {recommended && (
                    <span className="absolute top-3 right-3 px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded">
                      Recommended
                    </span>
                  )}
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${
                      selectedType === type ? 'bg-sz-accent/20 text-sz-accent' : 'bg-sz-bg-tertiary text-sz-text-secondary'
                    }`}>
                      {icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-sz-text mb-1">{title}</h3>
                      <p className="text-sm text-sz-text-secondary">{description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Camera Setup (for long-form) */}
        {step === 'cameras' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-sz-text mb-2">Camera Setup</h2>
              <p className="text-sz-text-secondary">
                Add your camera angles. The AI will automatically switch between them based on who's speaking.
              </p>
            </div>

            <div className="space-y-3">
              {cameras.map((camera) => (
                <div
                  key={camera.id}
                  className="p-4 rounded-lg border border-sz-border bg-sz-bg-secondary"
                >
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleSetMainCamera(camera.id)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        camera.isMain
                          ? 'border-sz-accent bg-sz-accent'
                          : 'border-sz-border hover:border-sz-accent'
                      }`}
                    >
                      {camera.isMain && <div className="w-2 h-2 bg-white rounded-full" />}
                    </button>
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={camera.name}
                        onChange={(e) => handleUpdateCameraName(camera.id, e.target.value)}
                        placeholder="Camera name"
                        className="px-3 py-2 rounded-lg bg-sz-bg-tertiary border border-sz-border text-sz-text text-sm focus:outline-none focus:border-sz-accent"
                      />
                      <input
                        type="text"
                        value={camera.speakerName || ''}
                        onChange={(e) => handleUpdateSpeakerName(camera.id, e.target.value)}
                        placeholder="Speaker name (optional)"
                        className="px-3 py-2 rounded-lg bg-sz-bg-tertiary border border-sz-border text-sz-text text-sm focus:outline-none focus:border-sz-accent"
                      />
                    </div>
                    <Mic className="w-4 h-4 text-sz-text-muted" />
                    <button
                      onClick={() => handleRemoveCamera(camera.id)}
                      className="px-3 py-1 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-sz-text-muted truncate pl-10">
                    {camera.filePath}
                  </p>
                </div>
              ))}

              <button
                onClick={handleAddCamera}
                className="w-full p-4 rounded-lg border-2 border-dashed border-sz-border hover:border-sz-accent hover:bg-sz-bg-secondary transition-colors flex items-center justify-center gap-2 text-sz-text-secondary hover:text-sz-text"
              >
                <Upload className="w-5 h-5" />
                <span>Add Camera Angle</span>
              </button>
            </div>

            {cameras.length === 0 && (
              <p className="text-center text-sm text-sz-text-muted">
                You can skip this step if you have a single camera. The main video will be used.
              </p>
            )}
          </div>
        )}

        {/* Step 3: Editing Style */}
        {step === 'style' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-sz-text mb-2">Editing Style</h2>
              <p className="text-sz-text-secondary">Tell us how you want your video edited.</p>
            </div>

            {/* Editing Prompt */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-sz-text">
                <MessageSquare className="w-4 h-4" />
                Editing Instructions
              </label>
              <textarea
                value={editingPrompt}
                onChange={(e) => setEditingPrompt(e.target.value)}
                placeholder="Describe how you want the video edited... e.g., 'Make it energetic with fast cuts, add zoom effects on funny moments, keep it engaging for TikTok'"
                rows={4}
                className="w-full px-4 py-3 rounded-lg bg-sz-bg-secondary border border-sz-border text-sz-text text-sm focus:outline-none focus:border-sz-accent resize-none"
              />
            </div>

            {/* Reference Video */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-sz-text">
                <LinkIcon className="w-4 h-4" />
                Reference Video URL (Optional)
              </label>
              <input
                type="url"
                value={referenceVideoUrl}
                onChange={(e) => setReferenceVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or TikTok link"
                className="w-full px-4 py-3 rounded-lg bg-sz-bg-secondary border border-sz-border text-sz-text text-sm focus:outline-none focus:border-sz-accent"
              />
              <p className="text-xs text-sz-text-muted">
                We'll analyze this video and match its editing style.
              </p>
            </div>

            {/* Pacing Style */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-sz-text">Pacing Style</label>
              <div className="grid grid-cols-2 gap-3">
                {pacingOptions.map(({ value, label, description }) => (
                  <button
                    key={value}
                    onClick={() => setPacingStyle(value as EditingPreferences['pacingStyle'])}
                    disabled={value === 'match-reference' && !referenceVideoUrl}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      pacingStyle === value
                        ? 'border-sz-accent bg-sz-accent/10'
                        : 'border-sz-border bg-sz-bg-secondary hover:border-sz-border-light'
                    } ${value === 'match-reference' && !referenceVideoUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <h4 className="font-medium text-sz-text">{label}</h4>
                    <p className="text-xs text-sz-text-secondary mt-1">{description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* B-Roll Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-sz-bg-secondary border border-sz-border">
              <div>
                <h4 className="font-medium text-sz-text">Enable B-Roll</h4>
                <p className="text-sm text-sz-text-secondary">
                  Add supporting footage and visual effects during narration
                </p>
              </div>
              <button
                onClick={() => setBRollEnabled(!bRollEnabled)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  bRollEnabled ? 'bg-sz-accent' : 'bg-sz-bg-tertiary'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    bRollEnabled ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-8">
          <button
            onClick={handleBack}
            className="px-6 py-3 rounded-lg border border-sz-border text-sz-text hover:bg-sz-bg-secondary transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            className="px-6 py-3 rounded-lg bg-sz-accent text-white hover:bg-sz-accent-hover transition-colors flex items-center gap-2"
          >
            {step === 'style' ? 'Start Editing' : 'Continue'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(ProjectSetup);

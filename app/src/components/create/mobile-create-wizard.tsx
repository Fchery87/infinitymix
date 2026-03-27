'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Upload, Music2, Zap, ChevronRight, ChevronLeft, Check, Mic2, RotateCcw } from 'lucide-react';
import { FileUpload } from '@/components/file-upload';
import { Track } from '@/components/track-list';

type TransitionStyle =
  | 'smooth'
  | 'drop'
  | 'energy'
  | 'cut'
  | 'filter_sweep'
  | 'echo_reverb'
  | 'backspin'
  | 'tape_stop'
  | 'stutter_edit'
  | 'three_band_swap'
  | 'bass_drop'
  | 'snare_roll'
  | 'noise_riser'
  | 'vocal_handoff'
  | 'bass_swap'
  | 'reverb_wash'
  | 'echo_out';

type TransitionStyleOption = {
  id: TransitionStyle;
  name: string;
  description?: string;
  category?: string;
  duration?: number;
};

type MixMode = 'standard' | 'stem_mashup' | 'auto_dj';

interface MobileCreateWizardProps {
  // Upload
  isUploading: boolean;
  onFileUpload: (files: FileList) => void;
  uploadedTracks: Track[];
  completedTracks: Track[];
  selectedTrackIds: string[];
  onToggleTrack: (trackId: string) => void;

  // Style
  mixMode: MixMode;
  onMixModeChange: (mode: MixMode) => void;
  transitionStyles: TransitionStyleOption[];
  selectedTransitionStyle: TransitionStyle;
  onTransitionStyleChange: (style: TransitionStyle) => void;
  stemMashupAvailable: boolean;

  // Generation
  isGenerating: boolean;
  generationMessage: string | null;
  onGenerate: () => void;

  // Draft
  draftRestored: boolean;
}

const STEPS = [
  { number: 1, title: 'Upload', subtitle: 'Add your tracks', icon: Upload },
  { number: 2, title: 'Style', subtitle: 'Pick your vibe', icon: Music2 },
  { number: 3, title: 'Generate', subtitle: 'Create magic', icon: Zap },
] as const;

function StepIndicator({ currentStep, completedSteps }: { currentStep: number; completedSteps: Set<number> }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-8">
      {STEPS.map((step, index) => {
        const isActive = currentStep === step.number;
        const isCompleted = completedSteps.has(step.number);
        return (
          <div key={step.number} className="flex items-center">
            <div
              className={`
                relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300
                ${isActive
                  ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-110'
                  : isCompleted
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/5 text-gray-500 border border-white/10'
                }
              `}
            >
              {isCompleted && !isActive ? (
                <Check className="w-4 h-4" />
              ) : (
                <step.icon className="w-4 h-4" />
              )}
              {isActive && (
                <motion.div
                  layoutId="mobile-wizard-active-ring"
                  className="absolute inset-0 rounded-full border-2 border-primary/50"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`w-8 h-0.5 mx-1 rounded-full transition-colors duration-300 ${
                  completedSteps.has(step.number) ? 'bg-emerald-500/40' : 'bg-white/10'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 80 : -80,
    opacity: 0,
  }),
};

export function MobileCreateWizard({
  isUploading,
  onFileUpload,
  uploadedTracks,
  completedTracks,
  selectedTrackIds,
  onToggleTrack,
  mixMode,
  onMixModeChange,
  transitionStyles,
  selectedTransitionStyle,
  onTransitionStyleChange,
  stemMashupAvailable,
  isGenerating,
  generationMessage,
  onGenerate,
  draftRestored,
}: MobileCreateWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const goToStep = useCallback((step: number) => {
    setDirection(step > currentStep ? 1 : -1);
    setCurrentStep(step);
  }, [currentStep]);

  const markCompleted = useCallback((step: number) => {
    setCompletedSteps((prev) => new Set([...prev, step]));
  }, []);

  const canGoNext = () => {
    if (currentStep === 1) return completedTracks.length >= 1;
    if (currentStep === 2) return selectedTrackIds.length >= 2;
    return false;
  };

  const handleNext = () => {
    if (currentStep < 3 && canGoNext()) {
      markCompleted(currentStep);
      goToStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      goToStep(currentStep - 1);
    }
  };

  const handleGenerate = () => {
    markCompleted(3);
    onGenerate();
  };

  return (
    <div className="pb-8">
      <StepIndicator currentStep={currentStep} completedSteps={completedSteps} />

      {/* Step title */}
      <div className="text-center mb-6">
        <h3 className="text-lg font-bold text-white">
          {STEPS[currentStep - 1].title}
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          {STEPS[currentStep - 1].subtitle}
        </p>
      </div>

      {/* Step content */}
      <div className="relative overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="space-y-4"
          >
            {currentStep === 1 && (
              <MobileUploadStep
                isUploading={isUploading}
                onFileUpload={onFileUpload}
                completedTracks={completedTracks}
                selectedTrackIds={selectedTrackIds}
                onToggleTrack={onToggleTrack}
              />
            )}
            {currentStep === 2 && (
              <MobileStyleStep
                mixMode={mixMode}
                onMixModeChange={onMixModeChange}
                transitionStyles={transitionStyles}
                selectedTransitionStyle={selectedTransitionStyle}
                onTransitionStyleChange={onTransitionStyleChange}
                stemMashupAvailable={stemMashupAvailable}
                selectedTrackIds={selectedTrackIds}
              />
            )}
            {currentStep === 3 && (
              <MobileGenerateStep
                completedTracks={completedTracks}
                selectedTrackIds={selectedTrackIds}
                mixMode={mixMode}
                selectedTransitionStyle={selectedTransitionStyle}
                transitionStyles={transitionStyles}
                isGenerating={isGenerating}
                generationMessage={generationMessage}
                onGenerate={handleGenerate}
                onBackToStep={() => goToStep(1)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 mt-8 px-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          disabled={currentStep === 1}
          className="flex-1 h-11 text-gray-400 border border-white/10"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        {currentStep < 3 && (
          <Button
            size="sm"
            onClick={handleNext}
            disabled={!canGoNext()}
            className="flex-1 h-11 bg-primary hover:bg-primary/90"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>

      {/* Draft restored */}
      {draftRestored && (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
          <RotateCcw className="w-4 h-4 flex-shrink-0" />
          <span>Draft restored from your last session.</span>
        </div>
      )}
    </div>
  );
}

// ── Step 1: Upload ──────────────────────────────────────────

function MobileUploadStep({
  isUploading,
  onFileUpload,
  completedTracks,
  selectedTrackIds,
  onToggleTrack,
}: {
  isUploading: boolean;
  onFileUpload: (files: FileList) => void;
  completedTracks: Track[];
  selectedTrackIds: string[];
  onToggleTrack: (trackId: string) => void;
}) {
  return (
    <div className="space-y-5 px-1">
      <FileUpload onUpload={onFileUpload} isUploading={isUploading} />

      {isUploading && (
        <p className="text-sm text-gray-400 text-center">
          Uploading &amp; analyzing tracks...
        </p>
      )}

      {/* Track selection (compact) */}
      {completedTracks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider">
            Select 1-2 tracks
          </p>
          <div className="space-y-1.5 max-h-56 overflow-y-auto rounded-lg border border-white/5 bg-black/20 p-2">
            {completedTracks.map((track) => {
              const isSelected = selectedTrackIds.includes(track.id);
              return (
                <button
                  key={track.id}
                  onClick={() => onToggleTrack(track.id)}
                  className={`
                    w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all
                    ${isSelected
                      ? 'bg-primary/10 border border-primary/30'
                      : 'bg-white/[0.03] border border-transparent hover:border-white/10'
                    }
                  `}
                >
                  <div
                    className={`
                      flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                      ${isSelected ? 'bg-primary text-white' : 'bg-white/10 text-gray-500'}
                    `}
                  >
                    {isSelected ? <Check className="w-4 h-4" /> : <Music2 className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                      {track.original_filename}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {track.bpm ? `${track.bpm} BPM` : 'Analyzing...'}
                      {track.musical_key ? ` • ${track.musical_key}` : ''}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          {selectedTrackIds.length > 0 && (
            <p className="text-xs text-primary">
              {selectedTrackIds.length} track{selectedTrackIds.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step 2: Style ───────────────────────────────────────────

function MobileStyleStep({
  mixMode,
  onMixModeChange,
  transitionStyles,
  selectedTransitionStyle,
  onTransitionStyleChange,
  stemMashupAvailable,
  selectedTrackIds,
}: {
  mixMode: MixMode;
  onMixModeChange: (mode: MixMode) => void;
  transitionStyles: TransitionStyleOption[];
  selectedTransitionStyle: TransitionStyle;
  onTransitionStyleChange: (style: TransitionStyle) => void;
  stemMashupAvailable: boolean;
  selectedTrackIds: string[];
}) {
  const modeOptions = [
    { id: 'standard' as MixMode, label: 'Standard Mix', desc: 'Layer full tracks', icon: Music2 },
    { id: 'auto_dj' as MixMode, label: 'Auto DJ', desc: 'Event-ready mix', icon: Zap },
  ];

  if (stemMashupAvailable) {
    modeOptions.splice(1, 0, { id: 'stem_mashup' as MixMode, label: 'Stem Mashup', desc: 'Vocals + instrumental', icon: Mic2 });
  }

  return (
    <div className="space-y-5 px-1">
      {/* Mix mode cards */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500 uppercase tracking-wider">Mix Mode</p>
        <div className="grid gap-2">
          {modeOptions.map((opt) => {
            const isActive = mixMode === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onMixModeChange(opt.id)}
                className={`
                  flex items-center gap-3 p-4 rounded-xl text-left transition-all
                  ${isActive
                    ? 'bg-primary/10 border border-primary/30 shadow-sm'
                    : 'bg-white/[0.03] border border-white/5 hover:border-white/15'
                  }
                `}
              >
                <div
                  className={`
                    w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                    ${isActive ? 'bg-primary/20 text-primary' : 'bg-white/10 text-gray-400'}
                  `}
                >
                  <opt.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-300'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </div>
                {isActive && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Transition style */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500 uppercase tracking-wider">Transition Style</p>
        <div className="grid grid-cols-2 gap-2">
          {(transitionStyles.length > 0
            ? transitionStyles.slice(0, 6)
            : [
                { id: 'smooth' as TransitionStyle, name: 'Smooth' },
                { id: 'drop' as TransitionStyle, name: 'Drop' },
                { id: 'energy' as TransitionStyle, name: 'Energy' },
                { id: 'cut' as TransitionStyle, name: 'Cut' },
              ]
          ).map((style) => {
            const isActive = selectedTransitionStyle === style.id;
            return (
              <button
                key={style.id}
                onClick={() => onTransitionStyleChange(style.id)}
                className={`
                  p-3 rounded-lg text-center text-sm font-medium transition-all
                  ${isActive
                    ? 'bg-primary/15 border border-primary/30 text-white'
                    : 'bg-white/[0.03] border border-white/5 text-gray-400 hover:border-white/15'
                  }
                `}
              >
                {style.name}
                {isActive && <span className="ml-1 text-primary">{'\u2713'}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {selectedTrackIds.length < 2 && (
        <p className="text-xs text-amber-400 text-center">
          Select at least 2 tracks in Step 1 to proceed
        </p>
      )}
    </div>
  );
}

// ── Step 3: Generate ────────────────────────────────────────

function MobileGenerateStep({
  completedTracks,
  selectedTrackIds,
  mixMode,
  selectedTransitionStyle,
  transitionStyles,
  isGenerating,
  generationMessage,
  onGenerate,
  onBackToStep,
}: {
  completedTracks: Track[];
  selectedTrackIds: string[];
  mixMode: MixMode;
  selectedTransitionStyle: TransitionStyle;
  transitionStyles: TransitionStyleOption[];
  isGenerating: boolean;
  generationMessage: string | null;
  onGenerate: () => void;
  onBackToStep: () => void;
}) {
  const selectedTracks = selectedTrackIds
    .map((id) => completedTracks.find((t) => t.id === id))
    .filter(Boolean) as Track[];

  const styleName =
    transitionStyles.find((s) => s.id === selectedTransitionStyle)?.name ??
    selectedTransitionStyle;

  const modeLabel =
    mixMode === 'auto_dj' ? 'Auto DJ Mix' : mixMode === 'stem_mashup' ? 'Stem Mashup' : 'Standard Mix';

  const canGenerate = selectedTrackIds.length >= 2 && !isGenerating;

  return (
    <div className="space-y-5 px-1">
      {/* Summary card */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Tracks</p>
          <div className="space-y-1.5">
            {selectedTracks.map((track, i) => (
              <div key={track.id} className="flex items-center gap-2 text-sm">
                <span className="w-5 h-5 rounded-full bg-white/10 text-[10px] flex items-center justify-center text-gray-400 flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-white truncate">{track.original_filename}</span>
                {track.bpm && <span className="text-gray-500 text-xs ml-auto">{track.bpm} BPM</span>}
              </div>
            ))}
            {selectedTracks.length === 0 && (
              <p className="text-sm text-gray-500">No tracks selected</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Mode</p>
            <p className="text-white">{modeLabel}</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Style</p>
            <p className="text-white">{styleName}</p>
          </div>
        </div>
      </div>

      {selectedTracks.length < 2 && (
        <button
          onClick={onBackToStep}
          className="w-full py-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm"
        >
          Need at least 2 tracks — go back to upload
        </button>
      )}

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={!canGenerate}
        className={`
          w-full h-14 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all
          ${canGenerate
            ? 'bg-gradient-to-r from-primary to-orange-500 text-white shadow-lg shadow-primary/25 active:scale-[0.98]'
            : 'bg-white/5 text-gray-500 cursor-not-allowed'
          }
        `}
      >
        {isGenerating ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Generating...</span>
          </>
        ) : (
          <>
            <Zap className="w-5 h-5 fill-white" />
            <span>Generate</span>
          </>
        )}
      </button>

      {generationMessage && (
        <p className="text-sm text-center text-emerald-400">{generationMessage}</p>
      )}
    </div>
  );
}

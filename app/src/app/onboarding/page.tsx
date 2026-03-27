'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sparkles,
  Music2,
  Upload,
  ArrowRight,
  ArrowLeft,
  Check,
  Volume2,
  Sliders,
  Zap,
  X,
} from 'lucide-react';

const ONBOARDING_COMPLETE_KEY = 'infinitymix_onboarding_complete';

type Genre = 'electronic' | 'hip-hop' | 'pop' | 'rock' | 'latin' | 'r&b' | 'country' | 'other';
type Mood = 'party' | 'chill' | 'energetic' | 'romantic' | 'melancholic' | 'uplifting';

interface OnboardingData {
  genres: Genre[];
  mood: Mood;
  projectName: string;
}

const GENRES: { id: Genre; label: string; icon: string }[] = [
  { id: 'electronic', label: 'Electronic', icon: '🎧' },
  { id: 'hip-hop', label: 'Hip-Hop', icon: '🎤' },
  { id: 'pop', label: 'Pop', icon: '🎵' },
  { id: 'rock', label: 'Rock', icon: '🎸' },
  { id: 'latin', label: 'Latin', icon: '💃' },
  { id: 'r&b', label: 'R&B', icon: '🎷' },
  { id: 'country', label: 'Country', icon: '🤠' },
  { id: 'other', label: 'Other', icon: '🌍' },
];

const MOODS: { id: Mood; label: string; description: string; color: string }[] = [
  { id: 'party', label: 'Party', description: 'High energy, crowd pleaser', color: 'from-pink-500 to-rose-500' },
  { id: 'chill', label: 'Chill', description: 'Relaxed vibes', color: 'from-blue-400 to-cyan-400' },
  { id: 'energetic', label: 'Energetic', description: 'Pumped up', color: 'from-orange-500 to-amber-400' },
  { id: 'romantic', label: 'Romantic', description: 'Love songs', color: 'from-red-400 to-pink-400' },
  { id: 'melancholic', label: 'Melancholic', description: 'Moody & emotional', color: 'from-indigo-500 to-purple-500' },
  { id: 'uplifting', label: 'Uplifting', description: 'Feel good', color: 'from-green-400 to-emerald-400' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    genres: [],
    mood: 'party',
    projectName: 'My First Mix',
  });
  const [isSkipping, setIsSkipping] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_COMPLETE_KEY);
    if (completed === 'true') {
      router.replace('/create');
    }
  }, [router]);

  const handleComplete = useCallback(() => {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    router.push('/create');
  }, [router]);

  const handleSkip = useCallback(() => {
    setIsSkipping(true);
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    router.push('/create');
  }, [router]);

  const toggleGenre = (genre: Genre) => {
    setData((prev) => ({
      ...prev,
      genres: prev.genres.includes(genre)
        ? prev.genres.filter((g) => g !== genre)
        : [...prev.genres, genre],
    }));
  };

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, 3));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const steps = [
    {
      title: 'Welcome to InfinityMix',
      description: "Let's personalize your experience",
      icon: Sparkles,
    },
    {
      title: 'Set Up Your First Project',
      description: 'Give your project a name',
      icon: Music2,
    },
    {
      title: 'Try an Upload',
      description: 'Drag & drop your first track',
      icon: Upload,
    },
    {
      title: 'Quick Tutorial',
      description: 'How to create your first mashup',
      icon: Zap,
    },
  ];

  const StepIcon = steps[currentStep].icon;

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950/30 via-purple-950/20 to-indigo-950/30" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVycklubGluZT0ibm8iPjxwYXRoIGQ9Ik0zNiAzNHY2SDI0di0yaDEydjJ6bTAtOGgyNHYtMkgyNHYyeiIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwJSIgaGVpZ2h0PSIxMCUiIGZpbGw9Im5vbmUiLz48L3N2Zz4=')] opacity-20" />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <Music2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">InfinityMix</span>
            </div>
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="text-gray-400 hover:text-white"
            >
              Skip
              <X className="w-4 h-4 ml-2" />
            </Button>
          </div>

          <div className="flex gap-2 mb-8">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  idx === currentStep
                    ? 'bg-gradient-to-r from-violet-500 to-indigo-500 w-full'
                    : idx < currentStep
                    ? 'bg-emerald-500'
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            {currentStep === 0 && (
              <StepOne
                key="step1"
                data={data}
                onToggleGenre={toggleGenre}
                onNext={nextStep}
                onMoodSelect={(mood) =>
                  setData((prev) => ({ ...prev, mood }))
                }
                icon={StepIcon}
              />
            )}
            {currentStep === 1 && (
              <StepTwo
                key="step2"
                data={data}
                onUpdateData={setData}
                onNext={nextStep}
                onPrev={prevStep}
                icon={StepIcon}
              />
            )}
            {currentStep === 2 && (
              <StepThree
                key="step3"
                onNext={nextStep}
                onPrev={prevStep}
                onSkip={handleSkip}
                icon={StepIcon}
              />
            )}
            {currentStep === 3 && (
              <StepFour
                key="step4"
                onComplete={handleComplete}
                onPrev={prevStep}
                icon={StepIcon}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

function StepOne({
  data,
  onToggleGenre,
  onNext,
  onMoodSelect,
  icon: Icon,
}: {
  data: OnboardingData;
  onToggleGenre: (genre: Genre) => void;
  onNext: () => void;
  onMoodSelect: (mood: Mood) => void;
  icon: typeof Sparkles;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <Card className="bg-gray-900/80 backdrop-blur-xl border-white/10">
        <CardContent className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-xl flex items-center justify-center">
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">What music do you like?</h2>
              <p className="text-gray-400">Select your preferred genres</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {GENRES.map((genre) => (
              <button
                key={genre.id}
                onClick={() => onToggleGenre(genre.id)}
                className={`p-4 rounded-xl border transition-all ${
                  data.genres.includes(genre.id)
                    ? 'border-violet-500 bg-violet-500/20 text-white'
                    : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                }`}
              >
                <span className="text-2xl block mb-2">{genre.icon}</span>
                <span className="text-sm font-medium">{genre.label}</span>
              </button>
            ))}
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Pick a mood</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {MOODS.map((mood) => (
                <button
                  key={mood.id}
                  onClick={() => onMoodSelect(mood.id)}
                  className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden ${
                    data.mood === mood.id
                      ? 'border-white bg-white/10 text-white'
                      : 'border-white/10 text-gray-400 hover:border-white/20'
                  }`}
                >
                  {data.mood === mood.id && (
                    <div className={`absolute inset-0 bg-gradient-to-r ${mood.color} opacity-20`} />
                  )}
                  <p className="font-semibold relative z-10">{mood.label}</p>
                  <p className="text-xs text-gray-500 relative z-10">{mood.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={onNext}
              size="lg"
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500"
            >
              Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StepTwo({
  data,
  onUpdateData,
  onNext,
  onPrev,
  icon: Icon,
}: {
  data: OnboardingData;
  onUpdateData: React.Dispatch<React.SetStateAction<OnboardingData>>;
  onNext: () => void;
  onPrev: () => void;
  icon: typeof Music2;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <Card className="bg-gray-900/80 backdrop-blur-xl border-white/10">
        <CardContent className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-xl flex items-center justify-center">
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Name your first project</h2>
              <p className="text-gray-400">Give it a memorable name</p>
            </div>
          </div>

          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={data.projectName}
              onChange={(e) =>
                onUpdateData((prev: OnboardingData) => ({
                  ...prev,
                  projectName: e.target.value,
                }))
              }
              className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
              placeholder="My First Mix"
            />
          </div>

          <div className="bg-black/20 rounded-xl p-4 border border-white/5 mb-8">
            <p className="text-gray-400 text-sm">
              <span className="text-white font-medium">Tip:</span> Projects help you organize your
              mashups. You can create multiple projects for different events or themes.
            </p>
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={onPrev} className="text-gray-400">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </Button>
            <Button
              onClick={onNext}
              size="lg"
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500"
            >
              Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StepThree({
  onNext,
  onPrev,
  onSkip,
  icon: Icon,
}: {
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  icon: typeof Upload;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [demoUpload, setDemoUpload] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <Card className="bg-gray-900/80 backdrop-blur-xl border-white/10">
        <CardContent className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-xl flex items-center justify-center">
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Try an upload</h2>
              <p className="text-gray-400">Drag & drop your favorite track</p>
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              setDemoUpload(true);
              setTimeout(() => setDemoUpload(false), 1500);
            }}
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
              isDragging
                ? 'border-violet-500 bg-violet-500/10 scale-105'
                : demoUpload
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-white/10 hover:border-white/20'
            }`}
          >
            {demoUpload ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex flex-col items-center"
              >
                <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mb-4">
                  <Check className="w-8 h-8 text-white" />
                </div>
                <p className="text-xl font-semibold text-white">Upload Complete!</p>
                <p className="text-gray-400">Your track is ready</p>
              </motion.div>
            ) : (
              <>
                <Upload className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <p className="text-xl font-medium text-white mb-2">
                  Drag & drop audio files here
                </p>
                <p className="text-gray-500">MP3, WAV up to 50MB</p>
              </>
            )}
          </div>

          <div className="flex justify-between mt-8">
            <Button variant="ghost" onClick={onPrev} className="text-gray-400">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </Button>
            <Button
              onClick={onSkip}
              size="lg"
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500"
            >
              Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StepFour({
  onComplete,
  onPrev,
  icon: Icon,
}: {
  onComplete: () => void;
  onPrev: () => void;
  icon: typeof Zap;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <Card className="bg-gray-900/80 backdrop-blur-xl border-white/10">
        <CardContent className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-xl flex items-center justify-center">
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">How to create a mashup</h2>
              <p className="text-gray-400">Four simple steps</p>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            {[
              {
                step: '1',
                title: 'Upload Tracks',
                desc: 'Drag & drop 2+ audio files (MP3, WAV)',
                icon: Upload,
              },
              {
                step: '2',
                title: 'Select Tracks',
                desc: 'Click to select the tracks you want to mix',
                icon: Music2,
              },
              {
                step: '3',
                title: 'Choose Settings',
                desc: 'Pick duration & transition style',
                icon: Sliders,
              },
              {
                step: '4',
                title: 'Generate Mashup',
                desc: 'Click generate & let AI create your mix',
                icon: Volume2,
              },
            ].map((item) => (
              <div
                key={item.step}
                className="flex items-center gap-4 p-4 bg-black/20 rounded-xl border border-white/5"
              >
                <div className="w-8 h-8 bg-violet-500/20 rounded-full flex items-center justify-center">
                  <span className="text-violet-400 font-bold">{item.step}</span>
                </div>
                <div>
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={onPrev} className="text-gray-400">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </Button>
            <Button
              onClick={onComplete}
              size="lg"
              className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400"
            >
              Start Creating
              <Check className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
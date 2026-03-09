// src/app/create/components/GenerationControls.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Wand2 } from 'lucide-react';

type MixMode = 'standard' | 'stem_mashup' | 'auto_dj';

interface GenerationControlsProps {
  mixMode: MixMode;
  selectedTrackCount: number;
  isGenerating: boolean;
  generationMessage: string | null;
  onGenerate: () => void;
}

export function GenerationControls({
  mixMode,
  selectedTrackCount,
  isGenerating,
  generationMessage,
  onGenerate,
}: GenerationControlsProps) {
  const getButtonText = () => {
    if (isGenerating) return 'Generating...';
    
    switch (mixMode) {
      case 'stem_mashup':
        return 'Generate Stem Mashup';
      case 'auto_dj':
        return 'Generate Auto DJ Mix';
      default:
        return 'Generate Mashup';
    }
  };

  const getMinTracks = () => {
    return mixMode === 'stem_mashup' ? 2 : 2;
  };

  const canGenerate = selectedTrackCount >= getMinTracks() && !isGenerating;

  return (
    <Card className="bg-card/60 backdrop-blur-xl border-white/10">
      <CardContent className="pt-6 space-y-4">
        <Button
          onClick={onGenerate}
          disabled={!canGenerate}
          variant="glow"
          size="lg"
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
              {getButtonText()}
            </>
          ) : (
            <>
              <Wand2 className="w-5 h-5 mr-2" aria-hidden="true" />
              {getButtonText()}
            </>
          )}
        </Button>
        
        {!canGenerate && selectedTrackCount < getMinTracks() && (
          <p className="text-xs text-center text-gray-500">
            Select at least {getMinTracks()} tracks to generate
          </p>
        )}
        
        {generationMessage && (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-sm text-primary">
            {generationMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

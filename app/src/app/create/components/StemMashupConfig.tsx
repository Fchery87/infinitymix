// src/app/create/components/StemMashupConfig.tsx
'use client';

import { Mic2, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Track } from '@/components/track-list';

type StemKeyInfo = {
  vocalKey: string | null;
  instKey: string | null;
  keysCompatible: boolean;
  vocalBpm: number | null;
  instBpm: number | null;
} | null;

interface StemMashupConfigProps {
  stemTracks: Track[];
  vocalTrackId: string | null;
  instrumentalTrackId: string | null;
  autoKeyMatch: boolean;
  beatAlign: boolean;
  beatAlignMode: 'downbeat' | 'any';
  stemKeyInfo: StemKeyInfo;
  onVocalTrackChange: (id: string | null) => void;
  onInstrumentalTrackChange: (id: string | null) => void;
  onAutoKeyMatchChange: (enabled: boolean) => void;
  onBeatAlignChange: (enabled: boolean) => void;
  onBeatAlignModeChange: (mode: 'downbeat' | 'any') => void;
}

export function StemMashupConfig({
  stemTracks,
  vocalTrackId,
  instrumentalTrackId,
  autoKeyMatch,
  beatAlign,
  beatAlignMode,
  stemKeyInfo,
  onVocalTrackChange,
  onInstrumentalTrackChange,
  onAutoKeyMatchChange,
  onBeatAlignChange,
  onBeatAlignModeChange,
}: StemMashupConfigProps) {
  if (stemTracks.length < 2) {
    return (
      <Card className="bg-card/60 backdrop-blur-xl border-primary/20">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Mic2 className="w-4 h-4 text-primary" aria-hidden="true" />
            <p className="text-sm font-medium text-white">Stem Mashup Setup</p>
          </div>
          <div className="text-center py-4">
            <p className="text-sm text-gray-400 mb-2">
              Need at least 2 tracks with stems generated
            </p>
            <p className="text-xs text-gray-500">
              Click the scissors icon on your tracks below to generate stems
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/60 backdrop-blur-xl border-primary/20">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Mic2 className="w-4 h-4 text-primary" aria-hidden="true" />
          <p className="text-sm font-medium text-white">Stem Mashup Setup</p>
        </div>

        {/* Vocal Track Selection */}
        <div>
          <label htmlFor="vocal-track-select" className="text-xs text-gray-400 mb-2 block">
            Take VOCALS from:
          </label>
          <select
            id="vocal-track-select"
            value={vocalTrackId || ''}
            onChange={(e) => onVocalTrackChange(e.target.value || null)}
            className="w-full p-3 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:border-primary outline-none"
          >
            <option value="">Select track for vocals...</option>
            {stemTracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.original_filename}
                {track.camelot_key ? ` (${track.camelot_key})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Arrow indicator */}
        <div className="flex justify-center">
          <ArrowRight className="w-5 h-5 text-primary rotate-90" aria-hidden="true" />
        </div>

        {/* Instrumental Track Selection */}
        <div>
          <label htmlFor="instrumental-track-select" className="text-xs text-gray-400 mb-2 block">
            Take INSTRUMENTAL from:
          </label>
          <select
            id="instrumental-track-select"
            value={instrumentalTrackId || ''}
            onChange={(e) => onInstrumentalTrackChange(e.target.value || null)}
            className="w-full p-3 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:border-primary outline-none"
          >
            <option value="">Select track for instrumental...</option>
            {stemTracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.original_filename}
                {track.camelot_key ? ` (${track.camelot_key})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Key compatibility info */}
        {stemKeyInfo && (
          <div className={`p-3 rounded-lg border ${
            stemKeyInfo.keysCompatible 
              ? 'bg-emerald-500/10 border-emerald-500/30' 
              : 'bg-amber-500/10 border-amber-500/30'
          }`}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">
                {stemKeyInfo.vocalKey || '?'} → {stemKeyInfo.instKey || '?'}
              </span>
              <span className={stemKeyInfo.keysCompatible ? 'text-emerald-300' : 'text-amber-300'}>
                {stemKeyInfo.keysCompatible ? 'Keys match!' : 'Will pitch-shift'}
              </span>
            </div>
            {stemKeyInfo.vocalBpm && stemKeyInfo.instBpm && (
              <div className="text-xs text-gray-500 mt-1">
                {stemKeyInfo.vocalBpm} BPM → {stemKeyInfo.instBpm} BPM 
                {Math.abs(stemKeyInfo.vocalBpm - stemKeyInfo.instBpm) > 5 && ' (will time-stretch)'}
              </div>
            )}
          </div>
        )}

        {/* Auto key match toggle */}
        <label className="flex items-center gap-3 p-3 rounded-lg bg-black/20 border border-white/5 cursor-pointer hover:border-white/10">
          <input
            type="checkbox"
            checked={autoKeyMatch}
            onChange={(e) => onAutoKeyMatchChange(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <div>
            <p className="text-sm text-white">Auto key-match</p>
            <p className="text-xs text-gray-500">Pitch-shift vocals to match instrumental key</p>
          </div>
        </label>

        {/* Beat alignment */}
        <div className="grid gap-2 rounded-lg bg-black/20 border border-white/5 p-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={beatAlign}
              onChange={(e) => onBeatAlignChange(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <div>
              <p className="text-sm text-white">Beat-sync alignment</p>
              <p className="text-xs text-gray-500">Align downbeats for tighter sync</p>
            </div>
          </label>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <label htmlFor="beat-align-mode" className="whitespace-nowrap">Mode</label>
            <select
              id="beat-align-mode"
              value={beatAlignMode}
              onChange={(e) => onBeatAlignModeChange(e.target.value as 'downbeat' | 'any')}
              disabled={!beatAlign}
              className="flex-1 p-2 rounded-md bg-black/30 border border-white/10 text-white text-xs focus:border-primary outline-none disabled:opacity-50"
            >
              <option value="downbeat">Downbeat</option>
              <option value="any">Nearest beat</option>
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

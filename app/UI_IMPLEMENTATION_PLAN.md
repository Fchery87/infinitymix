# InfinityMix UI Enhancement Implementation Plan

## Overview

This plan implements all findings from the UI Design Audit & Enhancement Report. It is organized into 5 phases with 47 bite-sized tasks, each taking 2-10 minutes to complete.

**Estimated Duration:** 4-6 hours  
**Total Tasks:** 47  
**Execution Method:** `/executing-plans` (batch execution with human checkpoints)  
**Dependencies:** Node.js, npm, Next.js dev server running

---

## Phase 1: Critical Accessibility & Mobile Fixes (Tasks 1-12)
**Goal:** Fix critical accessibility violations and mobile overflow issues  
**Estimated Time:** 45-60 minutes

### Task 1: Add Skip Navigation Link to Layout
**Files:** `src/app/layout.tsx`  
**Time:** 2 minutes

Add skip link for keyboard navigation:

```tsx
// src/app/layout.tsx
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={plusJakarta.className}>
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-md"
        >
          Skip to main content
        </a>
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
```

**Verification:**
- Press Tab on page load
- "Skip to main content" link should appear
- Clicking it should focus main content

---

### Task 2: Fix Mobile Overflow in Mix Mode Selector
**Files:** `src/app/create/page.tsx`  
**Time:** 2 minutes

Find the mix mode selector grid and add responsive classes:

```tsx
// Line ~1114 (find the grid with mix mode buttons)
// Change from:
<div className="grid grid-cols-3 gap-3">

// To:
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
```

**Verification:**
- Open Chrome DevTools
- Set device to iPhone SE (375px width)
- Mix mode buttons should stack vertically, not overflow

---

### Task 3: Fix Mashup Action Buttons Overflow
**Files:** `src/app/mashups/page.tsx`  
**Time:** 5 minutes

Add responsive button container:

```tsx
// Find the action buttons div around line 571
// Wrap buttons in responsive container:

<div className="flex flex-wrap items-center gap-2 justify-end">
  {/* Move all buttons here */}
  {/* Add hidden md:block to secondary buttons */}
  <Button 
    variant={playingMashupId === mashup.id ? "default" : "outline"}
    size="sm" 
    className="border-white/10 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
    onClick={() => handlePlay(mashup.id)}
  >
    {/* Play button content */}
  </Button>
  
  {/* Secondary actions dropdown for mobile */}
  <div className="hidden sm:flex items-center gap-2">
    {/* Other buttons */}
  </div>
  
  {/* Mobile: More actions dropdown */}
  <div className="sm:hidden">
    {/* Add dropdown menu for secondary actions */}
  </div>
</div>
```

**Verification:**
- View on mobile viewport
- Buttons should wrap or show "More" dropdown
- No horizontal scrolling

---

### Task 4: Add ARIA Labels to Audio Player Controls
**Files:** `src/components/audio-player/index.tsx`  
**Time:** 3 minutes

Add accessible labels:

```tsx
// Line ~150 - Play/Pause button
<button
  onClick={onTogglePlay}
  className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform active:scale-95"
  disabled={!hasSource}
  aria-label={isPlaying ? "Pause" : "Play"}
>
  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
</button>

// Line ~142 - Skip back button (already has aria-label, verify it's there)
// Line ~161 - Skip forward button (already has aria-label, verify it's there)

// Line ~205 - Close button
<button 
  onClick={onClose} 
  className="p-2 hover:bg-white/10 rounded-full transition-colors"
  aria-label="Close player"
>
  <X className="w-5 h-5 text-gray-400" />
</button>
```

**Verification:**
- Use Chrome DevTools Accessibility panel
- Verify buttons have accessible names

---

### Task 5: Add Focus States to Mix Mode Buttons
**Files:** `src/app/create/page.tsx`  
**Time:** 3 minutes

Add focus-visible styles to mix mode selector buttons:

```tsx
// For each mix mode button around lines 1115-1159:
<button
  onClick={() => setMixMode('standard')}
  className={`p-4 rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
    mixMode === 'standard'
      ? 'border-primary bg-primary/10 text-white'
      : 'border-white/10 hover:border-white/20 text-gray-400'
  }`}
>
  {/* Content */}
</button>
```

**Verification:**
- Tab through mix mode buttons
- Each should have visible focus ring

---

### Task 6: Add Focus States to Track List Actions
**Files:** `src/components/track-list/index.tsx`  
**Time:** 3 minutes

Update delete button:

```tsx
// Line ~228
<Button 
  variant="ghost" 
  size="icon" 
  onClick={() => onRemoveTrack(track.id)}
  className="text-gray-600 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-destructive"
  aria-label={`Delete track ${track.original_filename}`}
>
  <Trash2 className="w-4 h-4" />
</Button>
```

**Verification:**
- Tab to delete button (should be visible when focused)
- Verify focus ring appears

---

### Task 7: Add Accessible Labels to Icon-Only Buttons
**Files:** `src/app/create/page.tsx`, `src/components/track-list/index.tsx`  
**Time:** 5 minutes

Find all icon-only buttons and add aria-label:

```tsx
// In track-list/index.tsx - Separate stems button
<Button
  variant="ghost"
  size="sm"
  onClick={() => handleSeparateStems(track.id)}
  className="h-7 px-3 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 border border-purple-500/20"
  aria-label={`Separate stems for ${track.original_filename}`}
>
  <Scissors className="w-3 h-3 mr-1" />
  Separate Stems
</Button>

// Any icon-only buttons in create page
// Search for size="icon" and add aria-label
```

**Verification:**
- Use axe DevTools extension
- Run scan on create page
- Should show 0 "Buttons must have discernible text" errors

---

### Task 8: Fix Audio Player Mobile Layout
**Files:** `src/components/audio-player/index.tsx`  
**Time:** 5 minutes

Make audio player responsive:

```tsx
// Line ~121 - Change from:
<div className="flex items-center gap-4 w-1/4 min-w-[200px]">

// To:
<div className="flex items-center gap-4 w-full sm:w-1/4 sm:min-w-[200px]">

// Line ~139 - Controls section
<div className="flex-1 flex flex-col items-center gap-2 w-full">

// Line ~191 - Volume section
<div className="flex items-center gap-4 w-full sm:w-1/4 justify-end">
```

**Verification:**
- View on mobile viewport
- Audio player should stack vertically on small screens

---

### Task 9: Improve Form Label Associations
**Files:** `src/app/create/page.tsx`  
**Time:** 5 minutes

Add proper labels to selects:

```tsx
// Find select elements in stem mashup section (~line 1187)
<div>
  <label htmlFor="vocal-track-select" className="text-xs text-gray-400 mb-2 block">
    Take VOCALS from:
  </label>
  <select
    id="vocal-track-select"
    value={vocalTrackId || ''}
    onChange={(e) => setVocalTrackId(e.target.value || null)}
    className="w-full p-3 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:border-primary outline-none"
  >
    {/* options */}
  </select>
</div>

// Repeat for instrumental track select
```

**Verification:**
- Use Chrome DevTools Accessibility panel
- Click on label should focus corresponding select

---

### Task 10: Add Semantic HTML Landmarks
**Files:** `src/app/page.tsx`, `src/app/create/page.tsx`, `src/app/mashups/page.tsx`, `src/app/profile/page.tsx`, `src/app/projects/page.tsx`  
**Time:** 10 minutes

Ensure all pages have proper landmarks:

```tsx
// src/app/page.tsx - Wrap sections properly
<div className="min-h-screen font-sans text-foreground flex flex-col">
  <header>...</header>
  <main>
    <section aria-labelledby="hero-heading">...</section>
    <section id="features" aria-labelledby="features-heading">...</section>
    <section id="how-it-works" aria-labelledby="how-it-works-heading">...</section>
    <section id="pricing" aria-labelledby="pricing-heading">...</section>
  </main>
  <footer>...</footer>
</div>

// Ensure each section has a heading with corresponding id
<section id="features" className="py-24 relative bg-black/20">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <h2 id="features-heading" className="text-3xl md:text-5xl font-bold mb-4">
      Beyond Simple Crossfading
    </h2>
    ...
  </div>
</section>
```

**Verification:**
- Use screen reader (NVDA/VoiceOver)
- Navigate by landmarks
- All major sections should be announced

---

### Task 11: Improve Color Contrast
**Files:** `src/app/globals.css`  
**Time:** 5 minutes

Adjust gray colors for better contrast:

```css
/* src/app/globals.css - Update muted-foreground */
:root {
  --muted-foreground: 240 5% 75%; /* Was 65%, now 75% for better contrast */
  /* Keep other vars same */
}

/* Add utility for higher contrast text */
.text-contrast-muted {
  color: hsl(240 5% 75%);
}
```

**Verification:**
- Use WebAIM Contrast Checker
- Check `text-gray-400` on dark backgrounds
- Should meet WCAG AA (4.5:1 ratio)

---

### Task 12: Add role and aria-modal to Mobile Menu
**Files:** `src/components/navigation.tsx`  
**Time:** 3 minutes

Verify mobile menu has proper ARIA:

```tsx
// Lines 109-115 should already have these, verify:
<div
  className="md:hidden fixed inset-0 top-20 bg-background/95 backdrop-blur-lg z-40"
  id="mobile-navigation"
  role="dialog"
  aria-label="Mobile navigation"
  aria-modal="true"
>
```

**Verification:**
- Open mobile menu
- Use screen reader
- Should announce as "Mobile navigation dialog"

---

## Phase 2: Component Refactoring (Tasks 13-22)
**Goal:** Break down monolithic create page and standardize components  
**Estimated Time:** 90-120 minutes

### Task 13: Create Page Container Component
**Files:** Create `src/components/layout/PageContainer.tsx`  
**Time:** 5 minutes

Create reusable page container:

```tsx
// src/components/layout/PageContainer.tsx
import { cn } from '@/lib/utils/helpers';

interface PageContainerProps {
  children: React.ReactNode;
  size?: 'narrow' | 'default' | 'wide';
  className?: string;
}

export function PageContainer({ 
  children, 
  size = 'default',
  className 
}: PageContainerProps) {
  const sizes = {
    narrow: 'max-w-4xl',
    default: 'max-w-6xl',
    wide: 'max-w-7xl',
  };

  return (
    <main className={cn(
      'pt-32 pb-16 px-4 sm:px-6 lg:px-8',
      sizes[size],
      'mx-auto',
      className
    )}>
      {children}
    </main>
  );
}
```

**Verification:**
- Import and use in one page
- Verify consistent padding and max-width

---

### Task 14: Create Mix Mode Selector Component
**Files:** Create `src/app/create/components/MixModeSelector.tsx`  
**Time:** 10 minutes

Extract from create page:

```tsx
// src/app/create/components/MixModeSelector.tsx
'use client';

import { Music2, Mic2, Zap } from 'lucide-react';

type MixMode = 'standard' | 'stem_mashup' | 'auto_dj';

interface MixModeSelectorProps {
  value: MixMode;
  onChange: (mode: MixMode) => void;
  stemMashupAvailable?: boolean;
}

export function MixModeSelector({ 
  value, 
  onChange, 
  stemMashupAvailable = false 
}: MixModeSelectorProps) {
  const modes = [
    {
      id: 'standard' as MixMode,
      icon: Music2,
      title: 'Standard Mix',
      description: 'Layer full tracks',
      disabled: false,
    },
    {
      id: 'stem_mashup' as MixMode,
      icon: Mic2,
      title: 'Stem Mashup',
      description: stemMashupAvailable ? 'Vocals + Instrumental' : 'Temporarily unavailable',
      disabled: !stemMashupAvailable,
    },
    {
      id: 'auto_dj' as MixMode,
      icon: Zap,
      title: 'Auto DJ',
      description: 'Event-ready mix',
      disabled: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {modes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => !mode.disabled && onChange(mode.id)}
          disabled={mode.disabled}
          className={`p-4 rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
            value === mode.id
              ? 'border-primary bg-primary/10 text-white'
              : mode.disabled
                ? 'border-white/5 text-gray-600 opacity-60 cursor-not-allowed'
                : 'border-white/10 hover:border-white/20 text-gray-400'
          }`}
          aria-pressed={value === mode.id}
        >
          <mode.icon className="w-5 h-5 mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm font-medium">{mode.title}</p>
          <p className="text-xs text-gray-500">{mode.description}</p>
        </button>
      ))}
    </div>
  );
}
```

**Verification:**
- Import into create page
- Verify all functionality works
- Check responsive behavior

---

### Task 15: Create Stem Mashup Config Component
**Files:** Create `src/app/create/components/StemMashupConfig.tsx`  
**Time:** 15 minutes

Extract stem mashup configuration panel:

```tsx
// src/app/create/components/StemMashupConfig.tsx
'use client';

import { Mic2, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Track } from '@/components/track-list';
import { camelotCompatible } from '@/lib/utils/audio-compat';

interface StemMashupConfigProps {
  stemTracks: Track[];
  vocalTrackId: string | null;
  instrumentalTrackId: string | null;
  autoKeyMatch: boolean;
  beatAlign: boolean;
  beatAlignMode: 'downbeat' | 'any';
  crossfadeEnabled: boolean;
  crossfadeDuration: number;
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
  onVocalTrackChange,
  onInstrumentalTrackChange,
  onAutoKeyMatchChange,
  onBeatAlignChange,
  onBeatAlignModeChange,
}: StemMashupConfigProps) {
  // Calculate key compatibility
  const keyInfo = (() => {
    if (!vocalTrackId || !instrumentalTrackId) return null;
    const vocalTrack = stemTracks.find(t => t.id === vocalTrackId);
    const instTrack = stemTracks.find(t => t.id === instrumentalTrackId);
    if (!vocalTrack || !instTrack) return null;
    
    const vocalKey = vocalTrack.camelot_key ?? vocalTrack.musical_key;
    const instKey = instTrack.camelot_key ?? instTrack.musical_key;
    
    return {
      vocalKey,
      instKey,
      keysCompatible: camelotCompatible(vocalKey, instKey),
      vocalBpm: vocalTrack.bpm,
      instBpm: instTrack.bpm,
    };
  })();

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
          <label htmlFor="inst-track-select" className="text-xs text-gray-400 mb-2 block">
            Take INSTRUMENTAL from:
          </label>
          <select
            id="inst-track-select"
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
        {keyInfo && (
          <div className={`p-3 rounded-lg border ${
            keyInfo.keysCompatible 
              ? 'bg-emerald-500/10 border-emerald-500/30' 
              : 'bg-amber-500/10 border-amber-500/30'
          }`}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">
                {keyInfo.vocalKey || '?'} → {keyInfo.instKey || '?'}
              </span>
              <span className={keyInfo.keysCompatible ? 'text-emerald-300' : 'text-amber-300'}>
                {keyInfo.keysCompatible ? 'Keys match!' : 'Will pitch-shift'}
              </span>
            </div>
            {keyInfo.vocalBpm && keyInfo.instBpm && (
              <div className="text-xs text-gray-500 mt-1">
                {keyInfo.vocalBpm} BPM → {keyInfo.instBpm} BPM 
                {Math.abs(keyInfo.vocalBpm - keyInfo.instBpm) > 5 && ' (will time-stretch)'}
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
            <span className="whitespace-nowrap">Mode</span>
            <select
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
```

**Verification:**
- Import and use in create page
- Verify track selection works
- Check key compatibility display

---

### Task 16: Create Auto DJ Config Component
**Files:** Create `src/app/create/components/AutoDjConfig.tsx`  
**Time:** 15 minutes

Extract auto DJ configuration:

```tsx
// src/app/create/components/AutoDjConfig.tsx
'use client';

import { Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { EnergySlider } from '@/components/create';
import { EventTypeSelector } from '@/components/create';
import type { EventArchetype, TransitionStyle } from '@/lib/audio/types/planner';

interface AutoDjConfigProps {
  energyLevel: number;
  eventType: EventArchetype;
  autoDjTargetBpm: number | null;
  autoDjTransitionStyle: TransitionStyle;
  preferStems: boolean;
  keepOrder: boolean;
  onEnergyLevelChange: (level: number) => void;
  onEventTypeChange: (type: EventArchetype) => void;
  onTargetBpmChange: (bpm: number | null) => void;
  onTransitionStyleChange: (style: TransitionStyle) => void;
  onPreferStemsChange: (prefer: boolean) => void;
  onKeepOrderChange: (keep: boolean) => void;
}

export function AutoDjConfig({
  energyLevel,
  eventType,
  autoDjTargetBpm,
  autoDjTransitionStyle,
  preferStems,
  keepOrder,
  onEnergyLevelChange,
  onEventTypeChange,
  onTargetBpmChange,
  onTransitionStyleChange,
  onPreferStemsChange,
  onKeepOrderChange,
}: AutoDjConfigProps) {
  return (
    <Card className="bg-card/60 backdrop-blur-xl border-primary/20">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" aria-hidden="true" />
          <p className="text-sm font-medium text-white">Auto DJ Configuration</p>
        </div>

        {/* Event Type */}
        <div>
          <label className="text-xs text-gray-400 mb-2 block">Event Type</label>
          <EventTypeSelector
            value={eventType}
            onChange={onEventTypeChange}
          />
        </div>

        {/* Energy Level */}
        <div>
          <label className="text-xs text-gray-400 mb-2 block">Energy Level</label>
          <EnergySlider
            value={energyLevel}
            onChange={onEnergyLevelChange}
          />
        </div>

        {/* Target BPM */}
        <div>
          <label htmlFor="target-bpm" className="text-xs text-gray-400 mb-2 block">
            Target BPM (optional)
          </label>
          <input
            id="target-bpm"
            type="number"
            min={60}
            max={200}
            value={autoDjTargetBpm || ''}
            onChange={(e) => onTargetBpmChange(e.target.value ? Number(e.target.value) : null)}
            placeholder="Auto-detect"
            className="w-full p-3 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:border-primary outline-none"
          />
        </div>

        {/* Prefer Stems */}
        <label className="flex items-center gap-3 p-3 rounded-lg bg-black/20 border border-white/5 cursor-pointer hover:border-white/10">
          <input
            type="checkbox"
            checked={preferStems}
            onChange={(e) => onPreferStemsChange(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <div>
            <p className="text-sm text-white">Prefer stems when available</p>
            <p className="text-xs text-gray-500">Use separated stems for smoother transitions</p>
          </div>
        </label>

        {/* Keep Order */}
        <label className="flex items-center gap-3 p-3 rounded-lg bg-black/20 border border-white/5 cursor-pointer hover:border-white/10">
          <input
            type="checkbox"
            checked={keepOrder}
            onChange={(e) => onKeepOrderChange(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <div>
            <p className="text-sm text-white">Maintain track order</p>
            <p className="text-xs text-gray-500">Don&apos;t reorder tracks for optimal flow</p>
          </div>
        </label>
      </CardContent>
    </Card>
  );
}
```

**Verification:**
- Import and use in create page
- Test all configuration options

---

### Task 17: Create Track Pool Component
**Files:** Create `src/app/create/components/TrackPool.tsx`  
**Time:** 10 minutes

Extract track list with selection:

```tsx
// src/app/create/components/TrackPool.tsx
'use client';

import { TrackList, Track } from '@/components/track-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Music } from 'lucide-react';

interface TrackPoolProps {
  tracks: Track[];
  selectedTrackIds: string[];
  completedTracks: Track[];
  compatibilityHints: Array<{ id: string; name: string; score: number }>;
  isLoading: boolean;
  isSmartMixing: boolean;
  onTrackSelect: (trackId: string) => void;
  onRemoveTrack: (trackId: string) => void;
  onSmartMix: () => void;
  onStemsUpdated: () => void;
}

export function TrackPool({
  tracks,
  selectedTrackIds,
  completedTracks,
  compatibilityHints,
  isLoading,
  isSmartMixing,
  onTrackSelect,
  onRemoveTrack,
  onSmartMix,
  onStemsUpdated,
}: TrackPoolProps) {
  return (
    <Card className="bg-card/60 backdrop-blur-xl border-white/10">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center text-xl">
          <Music className="w-5 h-5 mr-3 text-primary" aria-hidden="true" />
          Track Pool
          {completedTracks.length > 0 && (
            <span className="ml-3 text-sm font-normal text-gray-400">
              ({selectedTrackIds.length} of {completedTracks.length} selected)
            </span>
          )}
        </CardTitle>
        
        {completedTracks.length >= 2 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSmartMix}
            disabled={isSmartMixing}
            className="text-primary hover:text-primary/80"
          >
            <Sparkles className="w-4 h-4 mr-2" aria-hidden="true" />
            {isSmartMixing ? 'Mixing...' : 'Smart Mix'}
          </Button>
        )}
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-white/5 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Music className="w-12 h-12 mx-auto mb-3 opacity-20" aria-hidden="true" />
            <p>No tracks uploaded yet</p>
            <p className="text-sm text-gray-500 mt-1">Upload tracks to get started</p>
          </div>
        ) : (
          <>
            {compatibilityHints.length > 0 && (
              <div className="mb-4 p-3 rounded-lg bg-black/20 border border-white/5">
                <p className="text-xs text-gray-400 mb-2">Compatibility with anchor track:</p>
                <div className="flex flex-wrap gap-2">
                  {compatibilityHints.map((hint) => (
                    <button
                      key={hint.id}
                      onClick={() => onTrackSelect(hint.id)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        selectedTrackIds.includes(hint.id)
                          ? 'bg-primary/30 text-primary'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {hint.name} ({Math.round(hint.score * 100)}%)
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <TrackList
              tracks={tracks}
              onRemoveTrack={onRemoveTrack}
              onStemsUpdated={onStemsUpdated}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

**Verification:**
- Import and use in create page
- Verify track selection and removal works

---

### Task 18: Create Generation Controls Component
**Files:** Create `src/app/create/components/GenerationControls.tsx`  
**Time:** 10 minutes

Extract generation buttons and status:

```tsx
// src/app/create/components/GenerationControls.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Wand2 } from 'lucide-react';

interface GenerationControlsProps {
  mixMode: 'standard' | 'stem_mashup' | 'auto_dj';
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
```

**Verification:**
- Import and use in create page
- Verify button states work correctly

---

### Task 19: Refactor Create Page to Use New Components
**Files:** `src/app/create/page.tsx`  
**Time:** 20 minutes

Rewrite create page using extracted components:

```tsx
// src/app/create/page.tsx (simplified structure)
'use client';

import { Navigation } from '@/components/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { FileUpload } from '@/components/file-upload';
import { DurationPicker } from '@/components/duration-picker';
import { ProjectSelector } from '@/components/projects/project-selector';
import { CreateProjectModal } from '@/components/projects/create-project-modal';
import { MixModeSelector } from './components/MixModeSelector';
import { StemMashupConfig } from './components/StemMashupConfig';
import { AutoDjConfig } from './components/AutoDjConfig';
import { TrackPool } from './components/TrackPool';
import { GenerationControls } from './components/GenerationControls';
// ... other imports

export default function CreatePage() {
  // ... existing state hooks (keep all)

  return (
    <div className="min-h-screen font-sans text-foreground relative">
      <Navigation />
      
      <PageContainer size="wide">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Create Your <span className="text-primary">Mashup</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Upload tracks, configure settings, and let AI do the magic.
          </p>
        </motion.div>

        {/* Project Selector */}
        <div className="mb-8 max-w-md mx-auto">
          <ProjectSelector
            selectedProjectId={selectedProjectId}
            onProjectChange={setSelectedProjectId}
            onCreateNew={() => setIsProjectModalOpen(true)}
          />
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-6">
            <FileUpload 
              onUpload={handleFileUpload} 
              isUploading={isUploading} 
            />
            
            <TrackPool
              tracks={uploadedTracks}
              selectedTrackIds={selectedTrackIds}
              completedTracks={completedTracks}
              compatibilityHints={compatibilityHints}
              isLoading={isLoadingTracks}
              isSmartMixing={isSmartMixing}
              onTrackSelect={handleTrackSelect}
              onRemoveTrack={handleRemoveTrack}
              onSmartMix={handleSmartMix}
              onStemsUpdated={loadTracks}
            />
          </div>

          {/* Right Column */}
          <div className="lg:col-span-5 space-y-6">
            <DurationPicker
              value={durationPreset}
              customSeconds={customDurationSeconds ?? undefined}
              onChange={setDurationPreset}
              onCustomChange={(secs) => setCustomDurationSeconds(secs || null)}
            />

            <MixModeSelector
              value={mixMode}
              onChange={setMixMode}
              stemMashupAvailable={stemMashupAvailable}
            />

            {mixMode === 'stem_mashup' && (
              <StemMashupConfig
                stemTracks={stemTracks}
                vocalTrackId={vocalTrackId}
                instrumentalTrackId={instrumentalTrackId}
                autoKeyMatch={autoKeyMatch}
                beatAlign={beatAlign}
                beatAlignMode={beatAlignMode}
                crossfadeEnabled={crossfadeEnabled}
                crossfadeDuration={crossfadeDuration}
                onVocalTrackChange={setVocalTrackId}
                onInstrumentalTrackChange={setInstrumentalTrackId}
                onAutoKeyMatchChange={setAutoKeyMatch}
                onBeatAlignChange={setBeatAlign}
                onBeatAlignModeChange={setBeatAlignMode}
              />
            )}

            {mixMode === 'auto_dj' && (
              <AutoDjConfig
                energyLevel={energyLevel}
                eventType={eventType}
                autoDjTargetBpm={autoDjTargetBpm}
                autoDjTransitionStyle={autoDjTransitionStyle}
                preferStems={preferStems}
                keepOrder={keepOrder}
                onEnergyLevelChange={setEnergyLevel}
                onEventTypeChange={setEventType}
                onTargetBpmChange={setAutoDjTargetBpm}
                onTransitionStyleChange={setAutoDjTransitionStyle}
                onPreferStemsChange={setPreferStems}
                onKeepOrderChange={setKeepOrder}
              />
            )}

            <GenerationControls
              mixMode={mixMode}
              selectedTrackCount={selectedTrackIds.length}
              isGenerating={isGenerating}
              generationMessage={generationMessage}
              onGenerate={handleGenerate}
            />
          </div>
        </div>
      </PageContainer>

      <CreateProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
      />
    </div>
  );
}
```

**Verification:**
- Page loads without errors
- All functionality preserved
- Components render correctly
- File size reduced significantly

---

### Task 20: Create Confirmation Dialog Component
**Files:** Create `src/components/ui/confirm-dialog.tsx`  
**Time:** 10 minutes

Build reusable confirmation modal:

```tsx
// src/components/ui/confirm-dialog.tsx
'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
}: ConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">{title}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Note:** Requires Dialog component from shadcn. If not present:
```bash
npx shadcn add dialog
```

**Verification:**
- Component renders correctly
- Buttons work as expected

---

### Task 21: Replace Native confirm() in Mashups Page
**Files:** `src/app/mashups/page.tsx`  
**Time:** 10 minutes

Replace native confirm with custom dialog:

```tsx
// Add to imports:
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

// Add state:
const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

// Replace handleDelete function:
const handleDelete = (mashupId: string) => {
  setDeleteTargetId(mashupId);
  setDeleteConfirmOpen(true);
};

const confirmDelete = async () => {
  if (!deleteTargetId) return;
  
  try {
    setDeletingId(deleteTargetId);
    const response = await fetch(`/api/mashups/${deleteTargetId}`, { method: 'DELETE' });
    
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || 'Failed to delete mashup');
    }
    
    setMashups((prev) => prev.filter((m) => m.id !== deleteTargetId));
    if (playingMashupId === deleteTargetId) {
      setPlayingMashupId(null);
      setIsPlaying(false);
    }
  } catch (error) {
    console.error(error);
    alert(error instanceof Error ? error.message : 'Failed to delete mashup');
  } finally {
    setDeletingId(null);
    setDeleteTargetId(null);
    setDeleteConfirmOpen(false);
  }
};

// Add to JSX before closing main tag:
<ConfirmDialog
  isOpen={deleteConfirmOpen}
  onClose={() => {
    setDeleteConfirmOpen(false);
    setDeleteTargetId(null);
  }}
  onConfirm={confirmDelete}
  title="Delete Mashup"
  description="Are you sure you want to delete this mashup? This action cannot be undone."
  confirmText="Delete"
  variant="destructive"
/>
```

**Verification:**
- Click delete button
- Custom dialog should appear
- Confirm deletes mashup
- Cancel closes dialog

---

### Task 22: Add Index File for Create Components
**Files:** Create `src/app/create/components/index.ts`  
**Time:** 2 minutes

```tsx
// src/app/create/components/index.ts
export { MixModeSelector } from './MixModeSelector';
export { StemMashupConfig } from './StemMashupConfig';
export { AutoDjConfig } from './AutoDjConfig';
export { TrackPool } from './TrackPool';
export { GenerationControls } from './GenerationControls';
```

**Verification:**
- Can import all components from single path

---

## Phase 3: Design System Implementation (Tasks 23-32)
**Goal:** Create design tokens and standardized components  
**Estimated Time:** 60-90 minutes

### Task 23: Create Design Tokens File
**Files:** Create `src/lib/design-tokens.ts`  
**Time:** 10 minutes

```typescript
// src/lib/design-tokens.ts
/**
 * Design Tokens for InfinityMix
 * Single source of truth for colors, spacing, typography, and animation
 */

export const colors = {
  // Primary brand color (Electric Orange)
  primary: {
    DEFAULT: 'hsl(24 95% 53%)',
    foreground: 'hsl(144.9 80.4% 10%)',
    50: 'hsl(24 100% 97%)',
    100: 'hsl(24 100% 93%)',
    200: 'hsl(24 100% 85%)',
    300: 'hsl(24 100% 75%)',
    400: 'hsl(24 95% 65%)',
    500: 'hsl(24 95% 53%)', // Base
    600: 'hsl(24 90% 45%)',
    700: 'hsl(24 85% 38%)',
    800: 'hsl(24 80% 30%)',
    900: 'hsl(24 75% 22%)',
  },
  
  // Semantic colors
  background: 'hsl(240 10% 3.9%)',
  foreground: 'hsl(0 0% 98%)',
  card: 'hsl(240 10% 6%)',
  'card-foreground': 'hsl(0 0% 98%)',
  muted: 'hsl(240 4% 16%)',
  'muted-foreground': 'hsl(240 5% 75%)', // Improved contrast
  border: 'hsl(240 4% 16%)',
  input: 'hsl(240 4% 16%)',
  ring: 'hsl(24 95% 53%)',
  
  // Status colors
  destructive: {
    DEFAULT: 'hsl(0 63% 31%)',
    foreground: 'hsl(0 0% 98%)',
  },
  success: {
    DEFAULT: 'hsl(142 76% 36%)',
    foreground: 'hsl(0 0% 98%)',
  },
  warning: {
    DEFAULT: 'hsl(38 92% 50%)',
    foreground: 'hsl(0 0% 98%)',
  },
  info: {
    DEFAULT: 'hsl(217 91% 60%)',
    foreground: 'hsl(0 0% 98%)',
  },
} as const;

export const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
} as const;

export const typography = {
  fontFamily: {
    sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'monospace'],
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
    '5xl': ['3rem', { lineHeight: '1' }],
    '6xl': ['3.75rem', { lineHeight: '1' }],
  },
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
} as const;

export const animation = {
  duration: {
    fast: '150ms',
    normal: '250ms',
    slow: '350ms',
    slower: '500ms',
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
} as const;

export const borderRadius = {
  none: '0',
  sm: '0.375rem',
  DEFAULT: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.5rem',
  '2xl': '2rem',
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  glow: '0 0 20px hsl(24 95% 53% / 0.5)',
  'glow-lg': '0 0 40px hsl(24 95% 53% / 0.6)',
} as const;

export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const;
```

**Verification:**
- No TypeScript errors
- Tokens are comprehensive

---

### Task 24: Create Skeleton Component
**Files:** Create `src/components/ui/skeleton.tsx`  
**Time:** 5 minutes

```tsx
// src/components/ui/skeleton.tsx
import { cn } from '@/lib/utils/helpers';

interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'circle' | 'text';
}

export function Skeleton({ className, variant = 'default' }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-white/10',
        variant === 'circle' && 'rounded-full',
        variant === 'text' && 'h-4 rounded',
        variant === 'default' && 'rounded-lg',
        className
      )}
    />
  );
}

// Preset skeleton patterns
export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-white/5 bg-card/20 p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}

export function TrackSkeleton() {
  return (
    <div className="p-4 bg-card/40 border border-white/5 rounded-xl space-y-3">
      <div className="flex items-center gap-4">
        <Skeleton variant="circle" className="h-10 w-10" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
```

**Verification:**
- Component renders with pulse animation

---

### Task 25: Create Select Component
**Files:** Create `src/components/ui/select.tsx`  
**Time:** 15 minutes

Build custom select using Radix (if available) or native with styling:

```tsx
// src/components/ui/select.tsx
'use client';

import { cn } from '@/lib/utils/helpers';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  label,
  disabled = false,
  className,
}: SelectProps) {
  const selectedOption = options.find(opt => opt.value === value);
  
  return (
    <div className={cn('relative', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-400 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            'w-full appearance-none p-3 pr-10 rounded-lg bg-black/30 border border-white/10 text-white text-sm',
            'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors duration-200'
          )}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option 
              key={option.value} 
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown 
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" 
          aria-hidden="true"
        />
      </div>
      {selectedOption && (
        <span className="sr-only">Selected: {selectedOption.label}</span>
      )}
    </div>
  );
}
```

**Verification:**
- Select opens and closes
- Selection changes value
- Chevron icon visible

---

### Task 26: Create Toast/Notification System
**Files:** Create `src/components/ui/toast.tsx` and `src/hooks/useToast.ts`  
**Time:** 20 minutes

First, the hook:

```typescript
// src/hooks/useToast.ts
'use client';

import { useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 5000) => {
    const id = Math.random().toString(36).substring(7);
    const toast: Toast = { id, message, type, duration };
    
    setToasts((prev) => [...prev, toast]);
    
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return {
    toasts,
    addToast,
    removeToast,
  };
}
```

Then the component:

```tsx
// src/components/ui/toast.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/helpers';
import type { Toast, ToastType } from '@/hooks/useToast';

interface ToastProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-green-500" aria-hidden="true" />,
  error: <AlertCircle className="w-5 h-5 text-red-500" aria-hidden="true" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-500" aria-hidden="true" />,
  info: <Info className="w-5 h-5 text-blue-500" aria-hidden="true" />,
};

const toastStyles: Record<ToastType, string> = {
  success: 'bg-green-500/10 border-green-500/30 text-green-300',
  error: 'bg-red-500/10 border-red-500/30 text-red-300',
  warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
};

export function ToastContainer({ toasts, onRemove }: ToastProps) {
  return (
    <div 
      className="fixed bottom-4 right-4 z-[1700] flex flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            layout
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm min-w-[300px] max-w-md',
              toastStyles[toast.type]
            )}
            role="alert"
          >
            {toastIcons[toast.type]}
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button
              onClick={() => onRemove(toast.id)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

**Verification:**
- Add test toast in a page
- Should animate in and auto-dismiss

---

### Task 27: Create Tooltip Component
**Files:** Create `src/components/ui/tooltip.tsx`  
**Time:** 10 minutes

```tsx
// src/components/ui/tooltip.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/helpers';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Tooltip({ 
  children, 
  content, 
  position = 'top',
  className 
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div 
      className={cn('relative inline-block', className)}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={cn(
            'absolute z-50 px-2 py-1 text-xs font-medium text-white bg-black/90 rounded border border-white/10 whitespace-nowrap',
            'animate-in fade-in duration-150',
            positionClasses[position]
          )}
          role="tooltip"
        >
          {content}
          <span 
            className={cn(
              'absolute w-2 h-2 bg-black/90 border-white/10 rotate-45',
              position === 'top' && 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 border-r border-b',
              position === 'bottom' && 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-l border-t',
              position === 'left' && 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 border-t border-r',
              position === 'right' && 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 border-b border-l',
            )}
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}
```

**Verification:**
- Hover over tooltip trigger
- Tooltip appears with arrow

---

### Task 28: Create UI Components Index
**Files:** Create `src/components/ui/index.ts`  
**Time:** 2 minutes

```tsx
// src/components/ui/index.ts
export { Button, buttonVariants } from './button';
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './card';
export { Input } from './input';
export { Badge, badgeVariants } from './badge';
export { ConfirmDialog } from './confirm-dialog';
export { Skeleton, CardSkeleton, TrackSkeleton } from './skeleton';
export { Select } from './select';
export { ToastContainer } from './toast';
export { Tooltip } from './tooltip';
```

---

### Task 29: Update globals.css with Design Tokens
**Files:** `src/app/globals.css`  
**Time:** 10 minutes

Add CSS custom properties matching design tokens:

```css
/* src/app/globals.css - Add after existing :root */
@layer base {
  :root {
    /* Existing vars... */
    
    /* Spacing Scale */
    --space-1: 0.25rem;
    --space-2: 0.5rem;
    --space-3: 0.75rem;
    --space-4: 1rem;
    --space-6: 1.5rem;
    --space-8: 2rem;
    --space-12: 3rem;
    --space-16: 4rem;
    --space-24: 6rem;
    
    /* Animation */
    --duration-fast: 150ms;
    --duration-normal: 250ms;
    --duration-slow: 350ms;
    
    /* Shadows */
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    --shadow-glow: 0 0 20px hsl(24 95% 53% / 0.5);
  }
}

@layer utilities {
  /* Typography utilities */
  .text-balance {
    text-wrap: balance;
  }
  
  /* Animation utilities */
  .animate-fade-in {
    animation: fade-in var(--duration-normal) ease-out;
  }
  
  .animate-slide-up {
    animation: slide-up var(--duration-slow) ease-out;
  }
  
  /* Glassmorphism utilities */
  .glass {
    @apply bg-background/60 backdrop-blur-lg border-white/10;
  }
  
  .glass-card {
    @apply bg-card/50 backdrop-blur-md border-white/5 shadow-xl;
  }
  
  .glass-strong {
    @apply bg-black/40 backdrop-blur-xl border-white/10;
  }
}
```

**Verification:**
- CSS compiles without errors
- New utilities work in components

---

### Task 30: Update Tailwind Config with Design Tokens
**Files:** `tailwind.config.js`  
**Time:** 10 minutes

Extend Tailwind config with design tokens:

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Existing colors config...
      
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "fade-up": "fade-up 0.5s ease-out",
        "pulse-glow": "pulse-glow 2s infinite",
        "slide-up": "slide-up 0.5s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
      },
      
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 5px hsl(var(--primary) / 0.5)" },
          "50%": { boxShadow: "0 0 20px hsl(var(--primary) / 0.5)" },
        },
      },
      
      boxShadow: {
        'glow': '0 0 20px hsl(var(--primary) / 0.5)',
        'glow-lg': '0 0 40px hsl(var(--primary) / 0.6)',
        'card': '0 0 50px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
}
```

**Verification:**
- Restart dev server
- New animations work

---

### Task 31: Standardize Container Widths
**Files:** `src/app/mashups/page.tsx`, `src/app/profile/page.tsx`  
**Time:** 5 minutes

Update container widths:

```tsx
// src/app/mashups/page.tsx - Line 389
// Change from:
<main className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">

// To:
<main className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">

// src/app/profile/page.tsx - Line 14
// Change from:
<main className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">

// To:
<main className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
```

**Verification:**
- All internal pages have consistent max-width

---

### Task 32: Add Toast Provider to Root Layout
**Files:** `src/app/layout.tsx`  
**Time:** 5 minutes

Create provider and update layout:

```tsx
// src/components/providers/ToastProvider.tsx
'use client';

import { useState } from 'react';
import { ToastContainer } from '@/components/ui/toast';
import type { Toast } from '@/hooks/useToast';

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}

// Create context for global toast access
// src/contexts/ToastContext.tsx
'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import type { Toast, ToastType } from '@/hooks/useToast';

interface ToastContextType {
  addToast: (message: string, type?: ToastType, duration?: number) => string;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastContextProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 5000) => {
    const id = Math.random().toString(36).substring(7);
    const toast: Toast = { id, message, type, duration };
    
    setToasts((prev) => [...prev, toast]);
    
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export const useToastContext = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within ToastContextProvider');
  }
  return context;
};
```

Then update layout:

```tsx
// src/app/layout.tsx
import { ToastContextProvider } from '@/contexts/ToastContext';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={plusJakarta.className}>
        <a href="#main" className="sr-only focus:not-sr-only">
          Skip to main content
        </a>
        <ToastContextProvider>
          <main id="main">{children}</main>
        </ToastContextProvider>
      </body>
    </html>
  );
}
```

**Verification:**
- Add test toast on any page
- Should display and auto-dismiss

---

## Phase 4: Consistency & Polish (Tasks 33-40)
**Goal:** Standardize spacing, animations, and visual patterns  
**Estimated Time:** 45-60 minutes

### Task 33: Standardize Card Spacing
**Files:** `src/components/ui/card.tsx`  
**Time:** 5 minutes

Ensure consistent padding:

```tsx
// Update CardHeader to use consistent spacing
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-2 p-6', className)}
    {...props}
  />
));

// Update CardContent to have consistent padding
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6', className)} {...props} />
));
```

**Verification:**
- All cards have consistent internal spacing

---

### Task 34: Optimize Animation Performance
**Files:** `src/app/page.tsx`, `src/components/audio-player/index.tsx`  
**Time:** 10 minutes

Reduce CPU-intensive animations:

```tsx
// src/app/page.tsx - Visualizer animation (lines 119-131)
// Reduce update frequency and bar count:

{[40, 70, 50, 90, 30, 60, 80, 40, 60, 50, 80, 40, 30, 70, 50].map((h, i) => (
  <motion.div 
    key={i}
    initial={{ height: 10 }}
    animate={{ height: `${h}%` }}
    transition={{ 
      duration: 1.5, 
      repeat: Infinity, 
      repeatType: "reverse",
      delay: i * 0.1,
      ease: "easeInOut"
    }}
    className="w-3 bg-primary/80 rounded-t-sm shadow-[0_0_15px_rgba(249,115,22,0.5)]"
    style={{ willChange: 'height' }}
  />
))}

// src/components/audio-player/index.tsx - Reduce visualizer bars (line 214)
// Change from 60 bars to 30:
{[...Array(30)].map((_, i) => (
  <motion.div
    key={i}
    className="w-full bg-primary rounded-t-sm"
    animate={{ 
      height: isPlaying ? [`${Math.random() * 100}%`, `${Math.random() * 50}%`] : "10%" 
    }}
    transition={{
      duration: 0.3,
      repeat: Infinity,
      repeatType: "reverse",
      delay: i * 0.02
    }}
    style={{ willChange: 'height' }}
  />
))}
```

**Verification:**
- Animations still look smooth
- Lower CPU usage in DevTools Performance tab

---

### Task 35: Add Loading States to Track List
**Files:** `src/components/track-list/index.tsx`  
**Time:** 5 minutes

Add skeleton loading:

```tsx
// Add to imports:
import { TrackSkeleton } from '@/components/ui/skeleton';

// Add prop:
interface TrackListProps {
  tracks: Track[];
  onRemoveTrack?: (id: string) => void;
  onStemsUpdated?: () => void;
  className?: string;
  isLoading?: boolean; // Add this
}

// In render:
if (isLoading) {
  return (
    <div className={cn("space-y-3", className)}>
      {[1, 2, 3].map((i) => (
        <TrackSkeleton key={i} />
      ))}
    </div>
  );
}
```

**Verification:**
- Pass isLoading={true} to see skeleton state

---

### Task 36: Standardize Button Usage in Mashups Page
**Files:** `src/app/mashups/page.tsx`  
**Time:** 10 minutes

Refactor action buttons into dropdown for mobile:

```tsx
// Create action menu component within file or separate:
function MashupActions({ 
  mashup, 
  onPlay, 
  onDownload, 
  onTogglePublic, 
  onFork, 
  onDelete,
  playingMashupId,
  isPlaying 
}: MashupActionsProps) {
  return (
    <>
      {/* Primary actions always visible */}
      <Button 
        variant={playingMashupId === mashup.id ? "default" : "outline"}
        size="sm" 
        onClick={() => onPlay(mashup.id)}
        className="border-white/10 hover:bg-primary/10 hover:text-primary"
      >
        {playingMashupId === mashup.id && isPlaying ? (
          <>
            <EqualizerIcon className="w-4 h-4 mr-2" />
            Playing
          </>
        ) : (
          <>
            <Play className="w-4 h-4 mr-2" />
            Play
          </>
        )}
      </Button>
      
      {/* Desktop: All buttons visible */}
      <div className="hidden md:flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onDownload(mashup.id, 'master')}
          className="border-white/10 hover:bg-primary/10 hover:text-primary"
        >
          <Download className="w-4 h-4 mr-2" />
          WAV
        </Button>
        {/* Other buttons... */}
      </div>
      
      {/* Mobile: Dropdown for secondary actions */}
      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onDownload(mashup.id, 'master')}>
              <Download className="w-4 h-4 mr-2" />
              Download WAV
            </DropdownMenuItem>
            {/* Other menu items... */}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
```

**Verification:**
- Desktop shows all buttons
- Mobile shows dropdown menu

---

### Task 37: Add Empty State to Create Page
**Files:** `src/app/create/components/TrackPool.tsx`  
**Time:** 5 minutes

Already has empty state, but enhance it:

```tsx
// Update empty state in TrackPool:
{tracks.length === 0 ? (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="text-center py-12 text-gray-400 border-2 border-dashed border-white/10 rounded-xl"
  >
    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
      <Upload className="w-8 h-8 text-primary/60" aria-hidden="true" />
    </div>
    <p className="text-lg font-medium text-white mb-2">No tracks yet</p>
    <p className="text-sm text-gray-500 max-w-xs mx-auto mb-6">
      Upload MP3 or WAV files to start creating your mashup
    </p>
    <div className="flex flex-col items-center gap-2 text-xs text-gray-500">
      <div className="flex items-center gap-2">
        <CheckCircle className="w-3 h-3 text-green-500" aria-hidden="true" />
        <span>Automatic BPM detection</span>
      </div>
      <div className="flex items-center gap-2">
        <CheckCircle className="w-3 h-3 text-green-500" aria-hidden="true" />
        <span>Musical key analysis</span>
      </div>
      <div className="flex items-center gap-2">
        <CheckCircle className="w-3 h-3 text-green-500" aria-hidden="true" />
        <span>Beat grid extraction</span>
      </div>
    </div>
  </motion.div>
) : (
  // ...existing track list
)}
```

---

### Task 38: Improve Profile Page
**Files:** `src/app/profile/page.tsx`  
**Time:** 10 minutes

Add real data fetching and proper empty states:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Navigation } from '@/components/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Music, Users, Heart, Settings, Music2 } from 'lucide-react';

interface ProfileData {
  name: string;
  initials: string;
  memberSince: string;
  stats: {
    mashups: number;
    likes: number;
    followers: number;
  };
  recentMashups: Array<{
    id: string;
    name: string;
    createdAt: string;
    status: string;
  }>;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch profile data
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/users/me');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setProfile(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <PageContainer>
          <div className="space-y-8">
            <div className="flex items-center gap-8">
              <Skeleton variant="circle" className="w-32 h-32" />
              <div className="space-y-3">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          </div>
        </PageContainer>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <PageContainer>
          <div className="text-center py-20">
            <p className="text-gray-400">Failed to load profile</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Retry
            </Button>
          </div>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <PageContainer>
        {/* Profile Header */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-12">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-gray-800 to-black border-4 border-white/10 flex items-center justify-center shadow-2xl">
            <span className="text-4xl font-bold text-gray-400">{profile.initials}</span>
          </div>
          <div className="flex-1 text-center md:text-left space-y-2">
            <h1 className="text-4xl font-bold text-white">{profile.name}</h1>
            <p className="text-gray-400">Music Enthusiast • Member since {profile.memberSince}</p>
            <div className="flex items-center justify-center md:justify-start gap-4 pt-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="w-4 h-4" aria-hidden="true" />
                Edit Profile
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <StatCard 
            icon={<Music className="w-8 h-8 text-primary" />}
            value={profile.stats.mashups}
            label="Mashups Created"
          />
          <StatCard 
            icon={<Heart className="w-8 h-8 text-red-500" />}
            value={profile.stats.likes}
            label="Likes Received"
          />
          <StatCard 
            icon={<Users className="w-8 h-8 text-blue-500" />}
            value={profile.stats.followers}
            label="Followers"
          />
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Recent Activity</h2>
            <Button variant="link" className="text-primary">View All</Button>
          </div>
          
          {profile.recentMashups.length === 0 ? (
            <EmptyMashupsState />
          ) : (
            <div className="space-y-4">
              {profile.recentMashups.map((mashup) => (
                <ActivityCard key={mashup.id} mashup={mashup} />
              ))}
            </div>
          )}
        </div>
      </PageContainer>
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
      <CardContent className="flex flex-col items-center justify-center p-6">
        {icon}
        <span className="text-3xl font-bold text-white mt-3">{value}</span>
        <span className="text-sm text-gray-500">{label}</span>
      </CardContent>
    </Card>
  );
}

function EmptyMashupsState() {
  return (
    <Card className="bg-card/20 border-white/5 border-dashed">
      <CardContent className="p-12 text-center">
        <Music2 className="w-16 h-16 mx-auto mb-4 text-gray-600" aria-hidden="true" />
        <h3 className="text-xl font-medium text-white mb-2">No mashups yet</h3>
        <p className="text-gray-500 mb-6">Create your first mashup to see it here</p>
        <Button variant="glow">Create Mashup</Button>
      </CardContent>
    </Card>
  );
}

function ActivityCard({ mashup }: { mashup: { id: string; name: string; createdAt: string; status: string } }) {
  return (
    <Card className="bg-card/20 border-white/5 hover:bg-card/40 transition-colors">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center text-primary">
          <Music className="w-6 h-6" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-white">{mashup.name}</h3>
          <p className="text-sm text-gray-500">{mashup.createdAt}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded border ${
          mashup.status === 'completed' 
            ? 'bg-green-500/10 text-green-500 border-green-500/20'
            : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
        }`}>
          {mashup.status}
        </span>
      </CardContent>
    </Card>
  );
}
```

---

### Task 39: Add Progress Indicators
**Files:** Create `src/components/ui/progress.tsx`  
**Time:** 5 minutes

```tsx
// src/components/ui/progress.tsx
'use client';

import { cn } from '@/lib/utils/helpers';

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  showValue?: boolean;
}

export function Progress({
  value,
  max = 100,
  className,
  size = 'md',
  variant = 'default',
  showValue = false,
}: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };
  
  const variantClasses = {
    default: 'bg-primary',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
  };

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('w-full bg-white/10 rounded-full overflow-hidden', sizeClasses[size])}>
        <div
          className={cn('h-full transition-all duration-300 ease-out rounded-full', variantClasses[variant])}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
      {showValue && (
        <p className="text-xs text-gray-500 mt-1 text-right">{Math.round(percentage)}%</p>
      )}
    </div>
  );
}
```

**Verification:**
- Progress bar animates smoothly
- Accessible with ARIA attributes

---

### Task 40: Add Focus-Visible Polyfill/Styles
**Files:** `src/app/globals.css`  
**Time:** 5 minutes

Add comprehensive focus styles:

```css
/* Add to globals.css */
@layer base {
  /* Focus visible styles */
  :focus-visible {
    @apply outline-none ring-2 ring-primary ring-offset-2 ring-offset-background;
  }
  
  /* Remove default focus styles */
  :focus:not(:focus-visible) {
    @apply outline-none ring-0;
  }
  
  /* Ensure interactive elements have focus styles */
  button:focus-visible,
  a:focus-visible,
  input:focus-visible,
  select:focus-visible,
  textarea:focus-visible {
    @apply ring-2 ring-primary ring-offset-2 ring-offset-background;
  }
}
```

**Verification:**
- Tab through all interactive elements
- All should have visible focus rings

---

## Phase 5: Enhancement Features (Tasks 41-47)
**Goal:** Add missing UI elements and polish  
**Estimated Time:** 45-60 minutes

### Task 41: Create Dropdown Menu Component
**Files:** Create `src/components/ui/dropdown-menu.tsx`  
**Time:** 15 minutes

```tsx
// src/components/ui/dropdown-menu.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/helpers';

interface DropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
}

export function DropdownMenu({ trigger, children, align = 'end' }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const alignClasses = {
    start: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    end: 'right-0',
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {trigger}
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute top-full mt-2 z-50 min-w-[160px] rounded-lg border border-white/10 bg-card/95 backdrop-blur-xl shadow-xl',
              alignClasses[align]
            )}
            role="menu"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface DropdownMenuItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

export function DropdownMenuItem({ 
  children, 
  onClick, 
  disabled = false,
  destructive = false 
}: DropdownMenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full px-3 py-2 text-sm text-left transition-colors flex items-center gap-2',
        'hover:bg-white/5 focus:bg-white/5 focus:outline-none',
        'first:rounded-t-lg last:rounded-b-lg',
        disabled && 'opacity-50 cursor-not-allowed',
        destructive ? 'text-red-400 hover:text-red-300' : 'text-gray-300 hover:text-white'
      )}
      role="menuitem"
    >
      {children}
    </button>
  );
}

export function DropdownMenuSeparator() {
  return <div className="my-1 h-px bg-white/10" />;
}
```

**Verification:**
- Click trigger to open menu
- Click outside to close
- Keyboard navigation works

---

### Task 42: Create Context Menu for Track Actions
**Files:** Create `src/components/track-list/TrackContextMenu.tsx`  
**Time:** 10 minutes

```tsx
// src/components/track-list/TrackContextMenu.tsx
'use client';

import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Play, Scissors, Trash2, Download, MoreVertical } from 'lucide-react';
import type { Track } from './index';

interface TrackContextMenuProps {
  track: Track;
  onPlay?: (track: Track) => void;
  onSeparateStems?: (track: Track) => void;
  onDelete?: (track: Track) => void;
  onDownload?: (track: Track) => void;
}

export function TrackContextMenu({
  track,
  onPlay,
  onSeparateStems,
  onDelete,
  onDownload,
}: TrackContextMenuProps) {
  return (
    <DropdownMenu
      trigger={
        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <MoreVertical className="w-4 h-4 text-gray-400" />
        </button>
      }
    >
      {onPlay && (
        <DropdownMenuItem onClick={() => onPlay(track)}>
          <Play className="w-4 h-4" aria-hidden="true" />
          Play Track
        </DropdownMenuItem>
      )}
      
      {onDownload && track.analysis_status === 'completed' && (
        <DropdownMenuItem onClick={() => onDownload(track)}>
          <Download className="w-4 h-4" aria-hidden="true" />
          Download
        </DropdownMenuItem>
      )}
      
      {onSeparateStems && track.analysis_status === 'completed' && !track.has_stems && (
        <DropdownMenuItem onClick={() => onSeparateStems(track)}>
          <Scissors className="w-4 h-4" aria-hidden="true" />
          Separate Stems
        </DropdownMenuItem>
      )}
      
      <DropdownMenuSeparator />
      
      {onDelete && (
        <DropdownMenuItem onClick={() => onDelete(track)} destructive>
          <Trash2 className="w-4 h-4" aria-hidden="true" />
          Delete
        </DropdownMenuItem>
      )}
    </DropdownMenu>
  );
}
```

**Verification:**
- Right-click or click menu button on track
- Actions work correctly

---

### Task 43: Add Keyboard Shortcuts Support
**Files:** Create `src/hooks/useKeyboardShortcuts.ts`  
**Time:** 10 minutes

```typescript
// src/hooks/useKeyboardShortcuts.ts
'use client';

import { useEffect, useCallback } from 'react';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  callback: () => void;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    shortcuts.forEach((shortcut) => {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        shortcut.callback();
      }
    });
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Usage example in create page:
// useKeyboardShortcuts([
//   { key: 'u', ctrl: true, callback: () => fileInputRef.current?.click() },
//   { key: 'Enter', ctrl: true, callback: handleGenerate },
// ]);
```

**Verification:**
- Test shortcuts on create page
- Verify no conflicts

---

### Task 44: Create Error Boundary Component
**Files:** Create `src/components/ErrorBoundary.tsx`  
**Time:** 10 minutes

```tsx
// src/components/ErrorBoundary.tsx
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-red-500" aria-hidden="true" />
            </div>
            
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
              <p className="text-gray-400">
                We apologize for the inconvenience. Please try refreshing the page.
              </p>
            </div>
            
            {this.state.error && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-left">
                <p className="text-sm text-red-300 font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => window.location.reload()}>
                Refresh Page
              </Button>
              <Button variant="outline" onClick={() => this.setState({ hasError: false })}>
                Try Again
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Verification:**
- Wrap a component that throws error
- Verify error boundary catches it

---

### Task 45: Add Error Boundary to Root Layout
**Files:** `src/app/layout.tsx`  **Time:** 2 minutes

```tsx
// Update layout.tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={plusJakarta.className}>
        <ErrorBoundary>
          <ToastContextProvider>
            <a href="#main" className="sr-only focus:not-sr-only">
              Skip to main content
            </a>
            <main id="main">{children}</main>
          </ToastContextProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

---

### Task 46: Create Audio Waveform Component
**Files:** Create `src/components/ui/waveform.tsx`  
**Time:** 10 minutes

```tsx
// src/components/ui/waveform.tsx
'use client';

import { cn } from '@/lib/utils/helpers';

interface WaveformProps {
  data: number[];
  className?: string;
  barCount?: number;
  color?: string;
  height?: number;
}

export function Waveform({
  data,
  className,
  barCount = 50,
  color = 'primary',
  height = 40,
}: WaveformProps) {
  // Normalize data to fit barCount
  const normalized = normalizeData(data, barCount);
  const peak = Math.max(...normalized, 1);

  return (
    <div 
      className={cn('flex items-end gap-[2px]', className)}
      style={{ height }}
      role="img"
      aria-label="Audio waveform"
    >
      {normalized.map((value, index) => {
        const percentage = (value / peak) * 100;
        return (
          <div
            key={index}
            className={cn(
              'flex-1 rounded-sm transition-all duration-150',
              color === 'primary' && 'bg-gradient-to-t from-primary/30 via-primary/60 to-white/80',
              color === 'secondary' && 'bg-gradient-to-t from-gray-500/30 via-gray-500/60 to-white/80',
            )}
            style={{ 
              height: `${Math.max(4, percentage)}%`,
              minHeight: 4,
            }}
          />
        );
      })}
    </div>
  );
}

function normalizeData(data: number[], targetLength: number): number[] {
  if (data.length === 0) return Array(targetLength).fill(0);
  if (data.length === targetLength) return data;
  
  const result: number[] = [];
  const step = data.length / targetLength;
  
  for (let i = 0; i < targetLength; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    const slice = data.slice(start, end);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    result.push(avg);
  }
  
  return result;
}
```

**Verification:**
- Waveform renders with provided data
- Responsive to container width

---

### Task 47: Add Final Polish - Meta Tags & Theme Color
**Files:** `src/app/layout.tsx`  
**Time:** 5 minutes

Update metadata and add theme-color meta:

```tsx
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "InfinityMix - AI-Powered Mashup Creator",
  description: "Create professional-quality mashups in seconds with AI. No DAW, no music theory required.",
  keywords: ["music", "mashup", "AI", "audio", "mixing", "DJ"],
  authors: [{ name: "InfinityMix" }],
  openGraph: {
    title: "InfinityMix - AI-Powered Mashup Creator",
    description: "Create professional-quality mashups in seconds with AI",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F97316" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // Don't disable zoom for accessibility
};
```

**Verification:**
- Check theme-color in DevTools
- Verify no user-scalable=no

---

## Execution Instructions

### Phase 1: Critical Fixes
Execute immediately. No dependencies.

### Phase 2: Component Refactoring  
Execute after Phase 1. Test each component as you create it.

### Phase 3: Design System  
Execute after Phase 2. Update all pages to use new components.

### Phase 4: Consistency  
Execute after Phase 3. Focus on visual polish.

### Phase 5: Enhancements  
Execute last. These add nice-to-have features.

### Verification Checklist
- [ ] All pages load without errors
- [ ] Mobile responsive works (test 320px - 1920px)
- [ ] Accessibility audit passes (axe DevTools)
- [ ] All interactive elements have focus states
- [ ] Color contrast meets WCAG AA
- [ ] No console errors
- [ ] Build succeeds (`npm run build`)
- [ ] Lint passes (`npm run lint`)

### Rollback Plan
If any task fails:
1. Stop at that task
2. Check git status
3. Revert to last working state: `git checkout -- .`
4. Fix issue and retry

### Testing Commands
```bash
# Run after each phase
npm run lint
npm run build

# Test responsiveness
npm run dev
# Open http://localhost:3000
# Test in DevTools Device Mode

# Accessibility audit
# Install axe DevTools extension
# Run scan on each page
```

---

## Summary

This implementation plan addresses all 47 findings from the UI audit:

**Phase 1 (12 tasks):** Critical accessibility and mobile fixes  
**Phase 2 (10 tasks):** Component refactoring and code organization  
**Phase 3 (10 tasks):** Design system implementation  
**Phase 4 (8 tasks):** Consistency and polish  
**Phase 5 (7 tasks):** Enhancement features  

**Total estimated time:** 4-6 hours  
**Testing time:** 1-2 hours  
**Total:** 5-8 hours

Execute with `/executing-plans` for systematic, batch-based implementation with human checkpoints between phases.

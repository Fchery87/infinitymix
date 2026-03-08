/**
 * Phase 6 Design: Product Surface Alignment
 * 
 * This design document outlines the alignment of UI/UX with the
 * automation-first product capabilities built in Phases 0-5.
 */

## Current State Analysis

### What's Been Built (Phases 0-5):
✅ Unified runtime with durable execution
✅ Comprehensive analysis contract with confidence/provenance
✅ Evaluation harness with fixture-based testing
✅ Sequence planner with asymmetric compatibility
✅ Transition execution contract (preview/render parity)
✅ Render QA with automatic retry/correction

### Current UI Issues:
❌ Create flow has too many controls for non-DJs
❌ 16 transition styles exposed (overwhelming)
❌ No clear automation-first flow
❌ Stems UI is incomplete/promises unimplemented features
❌ Recommendation rationale is too technical
❌ No clear expert vs. simple mode

## Goals

1. **Automation-First Flow**: Guide users through upload → analysis → planning → preview → export
2. **Simplified Controls**: Only high-value controls for non-DJs (event type, duration, energy)
3. **Expert Mode**: Hide advanced controls (transition styles, stem settings, etc.)
4. **Clear Expectations**: UI should reflect actual engine capabilities
5. **Recommendation Explanations**: Plain language, not technical metrics

## Design Principles

1. **Progressive Disclosure**: Show simple options first, advanced on demand
2. **Smart Defaults**: Pre-select options based on best practices
3. **Visual Feedback**: Show what's happening during automation steps
4. **Undo/Flexibility**: Allow users to adjust after seeing results
5. **No Dead Ends**: Guide users to success at each step

## New Create Flow Architecture

```
Step 1: Upload
├── Drag & drop area
├── Progress indicator
└── Analysis status (real-time)

Step 2: Configure (Simple Mode)
├── Event Type: [Party | Chill | Workout | etc.]
├── Duration: [15min | 30min | 45min | 60min]
├── Energy: [Low → High slider]
└── [Advanced Mode Toggle]

Step 3: Review Plan
├── Suggested sequence (visual timeline)
├── Track compatibility indicators
├── "Explain this mix" button
└── Regenerate / Adjust buttons

Step 4: Preview & Export
├── Audio preview
├── Timeline visualization
├── Export button
└── Quality indicators

Advanced Mode (Expandable):
├── Stem preferences
├── Transition styles
├── Manual track ordering
├── Expert timing controls
```

## UI Components Needed

### 1. Simplified Create Flow
**File**: `src/components/create/automation-workflow.tsx`
- Multi-step wizard component
- Progress indicators
- Step validation
- Navigation (back/next)

### 2. Event Type Selector
**File**: `src/components/create/event-type-selector.tsx`
- Visual cards for each event type
- Icons and descriptions
- Hover previews of energy curves
- Examples: "Party Peak", "Warmup Journey", "Chill Vibe"

### 3. Energy Slider
**File**: `src/components/create/energy-slider.tsx`
- Single slider (0-100)
- Visual indicators (Low/Medium/High)
- Shows estimated energy curve

### 4. Plan Review Timeline
**File**: `src/components/create/plan-review-timeline.tsx`
- Visual track sequence
- Drag handles for reordering
- Track compatibility badges
- Transition indicators
- "Why this track?" tooltips

### 5. Recommendation Rationale
**File**: `src/components/create/recommendation-rationale.tsx`
- Plain language explanations
- Visual compatibility indicators
- "Sounds good because..." format

### 6. Expert Mode Toggle
**File**: `src/components/create/expert-mode-toggle.tsx`
- Switch to show/hide advanced controls
- Warning: "Advanced controls may result in lower quality mixes"

## Component Specifications

### EventTypeSelector
```typescript
interface EventTypeOption {
  id: EventArchetype;
  name: string;
  description: string;
  icon: LucideIcon;
  energyCurve: 'steady' | 'build' | 'wave' | 'peak';
  examples: string[];
}

const EVENT_TYPES: EventTypeOption[] = [
  {
    id: 'party-peak',
    name: 'Party Mix',
    description: 'High energy throughout, perfect for dancing',
    icon: PartyPopper,
    energyCurve: 'peak',
    examples: ['House party', 'Club night', 'Celebration'],
  },
  {
    id: 'warmup-journey',
    name: 'Journey Mix',
    description: 'Builds from chill to energetic',
    icon: TrendingUp,
    energyCurve: 'build',
    examples: ['Workout', 'Road trip', 'Getting ready'],
  },
  {
    id: 'chill-vibe',
    name: 'Chill Mix',
    description: 'Relaxed and steady',
    icon: Coffee,
    energyCurve: 'steady',
    examples: ['Study', 'Relaxing', 'Background'],
  },
  // ...
];
```

### PlanReviewTimeline
```typescript
interface PlanReviewProps {
  plan: SequencePlan;
  onReorder: (newOrder: string[]) => void;
  onRegenerate: () => void;
  onAdjust: () => void;
}

// Shows:
// - Track cards with artwork
// - BPM/key compatibility badges
// - Transition indicators
// - Energy level bars
// - "Explain" buttons per transition
```

### RecommendationRationale
```typescript
interface RationaleProps {
  transition: PlannedTransition;
  format: 'simple' | 'detailed';
}

// Simple: "These tracks work well together because they're in compatible keys"
// Detailed: Shows metrics but translated to plain language
```

## API Updates

### Enhanced Plan Endpoint
```typescript
// POST /api/mashups/plan (already exists)
// Add support for simplified parameters:

interface SimplifiedPlanInput {
  trackIds: string[];
  eventType: EventArchetype;
  durationMinutes: number;
  energyLevel: number; // 0-100
  preferStems?: boolean; // simple on/off
}

// Returns plan with:
// - Plain language explanations
// - Visual energy curve
// - Compatibility scores (translated)
```

### Plan Explanation Endpoint
```typescript
// GET /api/mashups/plan/[id]/explain?transitionIndex=0

interface PlanExplanation {
  summary: string; // "Great match! These tracks share similar energy"
  reasons: string[]; // Bullet points
  technicalDetails?: { // Only if expert mode
    tempoCompatibility: number;
    harmonicCompatibility: number;
    // ...
  };
}
```

## Implementation Plan

### Phase 6A: Core Workflow Components
1. Create `AutomationWorkflow` wizard component
2. Build `EventTypeSelector` with visual cards
3. Implement `EnergySlider` with curve preview
4. Create `PlanReviewTimeline` component

### Phase 6B: Simplification
1. Hide stem controls behind expert mode
2. Reduce transition styles to 4 presets in simple mode
3. Remove technical jargon from UI
4. Add recommendation rationale component

### Phase 6C: Polish
1. Add loading states with progress indicators
2. Implement error boundaries with helpful messages
3. Add keyboard shortcuts for power users
4. Mobile-responsive design

### Phase 6D: Documentation
1. Update README with new workflow
2. Create user guide for non-DJs
3. Document expert mode features
4. Update API documentation

## Acceptance Criteria

- [ ] Create flow has 4 clear steps (Upload, Configure, Review, Export)
- [ ] Simple mode shows only: event type, duration, energy level
- [ ] Expert mode toggle reveals all advanced controls
- [ ] Plan review shows visual timeline with reordering
- [ ] Recommendation rationale is in plain English
- [ ] No UI surfaces promise unimplemented features
- [ ] Stems UI is either complete or hidden
- [ ] Mobile-responsive design
- [ ] Keyboard accessible
- [ ] Loading states explain what's happening

## Success Metrics

- Time to first export reduced by 50%
- Non-DJ users complete mixes without support
- Expert mode usage < 20% of sessions (indicates simplicity is working)
- Support tickets about "confusing options" reduced by 80%

## Risk Mitigation

**Risk**: Power users complain about simplified interface
**Mitigation**: Expert mode preserves all functionality, just hidden

**Risk**: Users miss important controls in simple mode
**Mitigation**: Smart defaults based on event type, clear "Adjust" buttons

**Risk**: Plan review timeline is too complex
**Mitigation**: Start with read-only view, add reordering in v2

## Next Steps

1. Create design document with wireframes
2. Build core workflow components
3. Implement simple/expert mode toggle
4. Update API to support simplified parameters
5. Test with non-DJ users
6. Iterate based on feedback

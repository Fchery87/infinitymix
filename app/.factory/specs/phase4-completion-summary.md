# Phase 4 Implementation: Transition Execution Contract and Preview Truthfulness

Date: 2026-03-08

## Overview

Phase 4 establishes a shared transition execution contract between preview and render systems, ensuring that what users preview is what they export. This creates a faithful representation of the planner's intended transition semantics.

## Implementation Summary

### 1. Contract Converter Service (`src/lib/audio/execution/contract-converter.ts`)

Bridges Phase 3 planner output with Phase 4 execution:

**Key Functions:**
- `convertPlannedTransitionToContract()` - Converts single transition
- `convertPlannedTransitionsToContracts()` - Converts array of transitions
- `validateTransitionContract()` - Validates contract completeness

**Role Mapping:**
```
lead-vocal → stem-vocal
lead-instrumental → stem-instrumental
support-vocal → stem-vocal
support-instrumental → stem-instrumental
full-mix → trackA (default)
```

**EQ Intent Building:**
Automatically generates EQ/filter intents based on:
- Transition style (bass-drop, filter_sweep, vocal-handoff, etc.)
- Track roles (vocal vs instrumental)
- Standard mixing practices

### 2. Enhanced Preview API

The preview endpoint now accepts a `planId` parameter:

```typescript
POST /api/mashups/preview
{
  "planId": "plan-123",  // NEW: Fetch plan and use its contracts
  "plan": { ... },       // NEW: Inline plan with transitions
  "trackIds": [...],     // Still supported for backward compatibility
  "contract": { ... }    // Still supported for direct contracts
}
```

**Logic:**
1. If `planId` or `plan` provided → Extract contracts from plan transitions
2. If `contract` provided → Use contract directly (backward compatibility)
3. If neither → Use generic mixing (legacy mode)

### 3. Job Progress Tracking System (`src/lib/audio/execution/job-progress.ts`)

**Features:**
- Tracks job status through all phases:
  - queued → validating → analyzing → planning → rendering → mixing → finalizing → completed
- Supports both polling and Server-Sent Events (SSE)
- Stores progress in existing `automationJobs` table
- Provides time estimates and error tracking

**API Endpoints:**
- `GET /api/mashups/jobs/[id]/progress` - Polling
- `GET /api/mashups/jobs/[id]/progress?stream=true` - SSE (real-time)

**Polling Response:**
```typescript
{
  jobId: string;
  status: JobStatus;
  progressPercent: number;
  currentStep: string;
  estimatedTimeRemainingSeconds: number | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}
```

**SSE Events:**
- `event: progress` - Status update
- `event: complete` - Job finished successfully
- `event: error` - Job failed

### 4. Preview-Render Parity Documentation

Updated `src/lib/audio/preview-render-parity.ts` with:

**Contract Field Mappings:**
Documents each field in `TransitionExecutionContract`:
- Preview behavior
- Render behavior  
- Authority (preview-only, render-authoritative, or shared)
- Implementation notes

**Authority Classification:**
- **Shared**: Both preview and render use the same value (track IDs, cue points, duration)
- **Render-Authoritative**: Preview approximates, render is precise (tempo ramp, EQ)
- **Preview-Only**: Preview has additional effects not in render (playback rate ramps for backspin)

**Validation:**
- `validateContractParity()` - Ensures contract is complete and valid
- Checks critical fields, timing values, and consistency

## Key Design Decisions

### Why Plan-first Preview?
By accepting `planId` instead of just track IDs:
- ✅ Preview shows actual planned transitions
- ✅ Users preview what they'll export
- ✅ No drift between preview and render decisions
- ✅ Planner trace explains why preview sounds that way

### Why SSE + Polling?
- **SSE**: Best UX for real-time updates, but requires EventSource support
- **Polling**: Broad browser compatibility, works everywhere
- Both use same data source, user can choose based on capabilities

### Why Reuse automationJobs Table?
- ✅ Consistent with Phase 0 durable execution architecture
- ✅ Already has retry, recovery, and status tracking
- ✅ No new table to maintain
- ✅ Fits existing observability infrastructure

## Files Created/Modified

### New Files:
- `src/lib/audio/execution/contract-converter.ts` - Contract conversion logic
- `src/lib/audio/execution/job-progress.ts` - Job tracking implementation
- `src/lib/audio/execution/index.ts` - Module exports
- `src/app/api/mashups/jobs/[id]/progress/route.ts` - Job progress API

### Modified Files:
- `src/app/api/mashups/preview/route.ts` - Enhanced with planId support
- `src/lib/audio/preview-render-parity.ts` - Added contract field mappings

## Usage Example

### Using Plan ID (Recommended):
```typescript
// 1. Create a plan
const { plan } = await planSequence({
  trackIds: ['track-1', 'track-2'],
  constraints: { targetDurationSeconds: 900 }
});

// 2. Preview using plan
const response = await fetch('/api/mashups/preview', {
  method: 'POST',
  body: JSON.stringify({
    planId: plan.planId  // Uses plan's transition contracts
  })
});

// 3. Monitor progress
const eventSource = new EventSource(
  `/api/mashups/jobs/${jobId}/progress?stream=true`
);
eventSource.onmessage = (e) => {
  const progress = JSON.parse(e.data);
  updateProgressBar(progress.progressPercent);
};
```

### Using Direct Contract (Backward Compatible):
```typescript
const response = await fetch('/api/mashups/preview', {
  method: 'POST',
  body: JSON.stringify({
    trackIds: ['track-1', 'track-2'],
    contract: {
      trackAId: 'track-1',
      trackBId: 'track-2',
      mixOutCueSeconds: 120,
      mixInCueSeconds: 0,
      overlapDurationSeconds: 4,
      transitionStyle: 'smooth'
    }
  })
});
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        PHASE 4 FLOW                              │
└─────────────────────────────────────────────────────────────────┘

User Request
     │
     ▼
┌─────────────────────────────────────┐
│   POST /api/mashups/plan            │
│   (Phase 3 Planner)                 │
│                                     │
│   Creates SequencePlan with         │
│   PlannedTransitions                │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│   Contract Converter                │
│                                     │
│   PlannedTransition →               │
│   TransitionExecutionContract       │
└─────────────────────────────────────┘
     │
     ├──┬─────────────────────────────┐
     │  │                             │
     ▼  ▼                             ▼
┌──────────────┐              ┌──────────────┐
│   PREVIEW    │              │   RENDER     │
│              │              │              │
│ Tone.js      │              │ FFmpeg       │
│ Browser      │              │ Backend      │
│              │              │              │
│ Same contract│              │ Same contract│
└──────────────┘              └──────────────┘
     │                             │
     ▼                             ▼
┌──────────────┐              ┌──────────────┐
│   Browser    │              │   Export     │
│   Playback   │              │   File       │
└──────────────┘              └──────────────┘
```

## Testing Strategy

### Unit Tests:
- Contract conversion accuracy
- Field mapping validation
- Job status transitions

### Integration Tests:
- Preview API with planId
- Job progress endpoint (polling + SSE)
- Contract parity validation

### End-to-End:
- Full flow: plan → preview → render
- Verify preview matches export
- Test job progress tracking

## Acceptance Criteria

✅ Preview API accepts planId and derives contract
✅ Contract conversion maps all planner fields correctly
✅ Job progress endpoint provides real-time updates (SSE + polling)
✅ Preview uses same contract as render
✅ Documentation updated with contract authority
✅ Backward compatibility maintained (contract parameter still works)

## Next Steps

Phase 4 is **COMPLETE**. The transition execution contract is now:
- Generated from Phase 3 planner output
- Used by both preview and render systems
- Tracked with comprehensive job progress
- Documented with clear authority boundaries

**Ready for Phase 5: Render Quality Enforcement and Corrective Loop**

/**
 * Phase 4 Design: Transition Execution Contract and Preview Truthfulness
 * 
 * This design document outlines how to align preview and render around a shared
 * transition contract, ensuring preview is a faithful representation of the
 * planner's intended transition semantics.
 */

## Current State Analysis

✅ TransitionExecutionContract type exists
✅ Preview API accepts contract parameter
✅ Preview-render parity documentation exists
✅ Planner outputs PlannedTransition with compatible fields

## Goals

1. **Shared Contract**: Both preview and render consume the same transition contract
2. **Planner Integration**: Preview derives from planner output, not generic mixing
3. **Clear Authority**: Document what's preview-only vs render-authoritative
4. **Progress Delivery**: Add durable progress/status for long-running jobs

## Architecture

### Data Flow

```
User selects tracks → Sequence Planner → SequencePlan
                                     ↓
                           TransitionExecutionContract[]
                                     ↓
              ┌──────────────────────┼──────────────────────┐
              ↓                      ↓                      ↓
         Preview API            Render API           Progress API
              ↓                      ↓                      ↓
      Browser Playback        Final Export         Status Updates
```

### Key Components

1. **Contract Conversion Service**: Convert PlannedTransition → TransitionExecutionContract
2. **Enhanced Preview API**: Accept planId and derive contract from stored plan
3. **Progress Tracking**: Job status updates via SSE or polling
4. **Contract Validation**: Ensure preview and render use identical contracts

## Implementation Plan

### 1. Contract Conversion (contract-converter.ts)
- Map PlannedTransition → TransitionExecutionContract
- Handle role mapping (lead-vocal → stem-vocal)
- Include cue points, overlap duration, tempo strategy

### 2. Enhanced Preview API
- Accept planId parameter
- Fetch plan from database
- Convert to contract
- Mix using contract (already partially implemented)

### 3. Job Progress System
- Add job status tracking table
- Implement SSE endpoint for real-time updates
- Fallback polling endpoint
- Integrate with existing automationJobs table

### 4. Contract Storage
- Store contract with mashup/plan
- Ensure contract survives between preview and render
- Version contracts for future compatibility

### 5. Documentation
- Update preview-render-parity.ts with contract mappings
- Document preview-only vs render-authoritative behaviors
- Create troubleshooting guide

## Design Decisions

### Why Plan-first Preview?
Instead of accepting raw trackIds, the preview API should accept a planId. This ensures:
- Preview shows actual planned transitions
- Users preview what they'll export
- No drift between preview and render decisions

### Why SSE + Polling?
- SSE for real-time updates (best UX)
- Polling as fallback (broad compatibility)
- Both use same status data source

### Why Contract Storage?
- Survives page refreshes
- Enables replay/debugging
- Audit trail for QA

## Files to Create/Modify

### New Files:
- src/lib/audio/execution/contract-converter.ts
- src/lib/audio/execution/job-progress.ts
- src/app/api/mashups/jobs/[id]/progress/route.ts
- src/app/api/mashups/jobs/[id]/status/route.ts

### Modified Files:
- src/app/api/mashups/preview/route.ts (enhance with planId)
- src/lib/db/schema.ts (add job progress table)
- src/lib/audio/preview-render-parity.ts (add contract mappings)

## Acceptance Criteria

- [ ] Preview API can accept planId and derive contract
- [ ] Contract conversion maps all planner fields correctly
- [ ] Job progress endpoint provides real-time updates
- [ ] Preview uses same contract as render
- [ ] Documentation updated with contract authority
- [ ] Tests verify contract parity

## Risks

**Risk**: Breaking existing preview functionality
**Mitigation**: Keep contract parameter optional, maintain backward compatibility

**Risk**: SSE complexity
**Mitigation**: Implement polling first, add SSE as enhancement

**Risk**: Performance impact of plan storage
**Mitigation**: Store plans efficiently, clean up old plans periodically

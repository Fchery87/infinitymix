# Phase 3 Implementation: Sequence Planner and Compatibility Engine

Date: 2026-03-08

## Overview

Phase 3 implements a whole-set sequence planning system that replaces the previous anchor-based pairwise recommendation logic. The new planner makes explicit decisions about track order, role assignment, transition style, and stem usage.

## Implementation Summary

### 1. Type Definitions (`src/lib/audio/types/planner.ts`)

Comprehensive type system defining:
- **Track Roles**: `lead-vocal`, `lead-instrumental`, `full-mix`, etc.
- **Transition Styles**: `cut`, `fade`, `echo-reverb`, `bass-drop`, etc.
- **Event Archetypes**: `party-peak`, `warmup-journey`, `peak-valley`, etc.
- **Planning Graph**: Complete representation of tracks and their relationships
- **Asymmetric Compatibility**: Directional scoring (A→B ≠ B→A)
- **Sequence Plan**: Complete output with timing, roles, and transitions
- **Planner Trace**: Detailed observability for debugging

### 2. Core Services

#### Planning Graph Builder (`src/lib/audio/planner/planning-graph-builder.ts`)
- Builds planning graph from track IDs
- Fetches track data and stem information
- Calculates energy profiles and vocal dominance
- Creates bidirectional compatibility matrices

#### Asymmetric Compatibility Scorer (`src/lib/audio/planner/compatibility-scorer.ts`)
Implements directional compatibility scoring:
- **Tempo Compatibility**: BPM matching with stretch penalties
- **Harmonic Compatibility**: Camelot wheel compatibility
- **Energy Flow Score**: Transition quality between tracks
- **Role-Aware Scores**:
  - `vocalOverInstrumentalScore`: Source vocal over target instrumental
  - `instrumentalOverVocalScore`: Source instrumental under target vocal
  - `fullTrackTransitionScore`: Both tracks as full mix
- **Quality Penalties**: Tempo stretch, stem quality, harmonic clash, vocal collision
- **Transition Style Suggestions**: Based on track characteristics

#### Sequence Planner (`src/lib/audio/planner/sequence-planner.ts`)
Main planning algorithm:
1. **Build Planning Graph**: Construct compatibility matrix
2. **Select Sequence Order**: Greedy TSP-like approach with safety rules
3. **Assign Roles**: Vocal/instrumental/full-mix based on track characteristics and policy
4. **Plan Transitions**: Determine overlap, cue points, and transition styles
5. **Validate**: Check energy arc and safety constraints

#### Track Analyzer (`src/lib/audio/planner/track-analyzer.ts`)
- Energy profile calculation from waveform and structure
- Vocal dominance scoring
- Cue point selection utilities

#### Policy Rules (`src/lib/audio/planner/policy-rules.ts`)
Configurable policies for:
- **Energy Arc Policies**: Per-event-archetype energy checkpoints
- **Stem Usage Policy**: When to use stems, quality thresholds
- **Transition Policy**: Default styles, phrase alignment
- **Safety Rules**: Vocal collision rejection, tempo stretch limits, harmonic compatibility

### 3. API Integration

#### New Endpoint: `POST /api/mashups/plan`
Full-featured sequence planning API:
```typescript
Request:
{
  trackIds: string[],
  constraints: {
    targetDurationSeconds: number,
    eventArchetype?: EventArchetype,
    preferStems?: boolean,
    maxTempoStretchPercent?: number,
  },
  policyOverrides?: Partial<PlanningPolicy>
}

Response:
{
  plan: SequencePlan,
  trace: PlannerTrace
}
```

### 4. Database Schema

#### New Table: `planner_traces`
```sql
- trace_id (unique identifier)
- plan_id (links to plan)
- user_id (ownership)
- track_ids (input tracks)
- timing metrics (graph build, compatibility scoring, optimization)
- decisions (planning decisions with rationale)
- rejected_candidates (options that were rejected)
- warnings (validation warnings)
- constraints and policy (used for planning)
- quality_score (overall plan quality)
```

### 5. Trace Persistence (`src/lib/audio/planner/trace-persistence.ts`)
- Persist traces for observability
- Update quality scores post-render
- Query traces by user
- Aggregated statistics for monitoring

## Key Features

### Asymmetric Compatibility
The planner treats compatibility as directional:
- Track A (vocal) → Track B (instrumental) = High score
- Track B (instrumental) → Track A (vocal) = Different score
- This enables proper role-based mashup planning

### Event-Aware Planning
Five event archetypes with different energy curves:
- **party-peak**: High energy throughout
- **warmup-journey**: Build from low to high (default)
- **peak-valley**: Alternating energy
- **chill-vibe**: Consistent low-mid energy
- **sunrise-set**: Gradual increase then plateau

### Safety Rules
Hard constraints that reject unsafe transitions:
- Vocal collision rejection (when enabled)
- Max tempo stretch limits
- Minimum harmonic compatibility
- Minimum cue point confidence

### Planner Traces
Every planning decision is recorded:
- Why each track was selected/rejected
- Role assignment rationale
- Transition style choices
- Performance metrics
- Validation warnings

## Architecture Decisions

### Why Service-Based?
The planner is implemented as a service module (`lib/audio/planner/`) rather than inline API code:
- ✅ Testable (can unit test planning logic)
- ✅ Reusable (can be called from workers, scripts, etc.)
- ✅ Consistent with existing patterns (auto-dj-service, mixing-service)
- ✅ Separates planning from transport layer

### Greedy vs Optimal Sequence Selection
Uses greedy algorithm for sequence selection:
- ✅ Fast (O(n²) instead of O(n!))
- ✅ Deterministic
- ✅ Good enough for most cases
- ⚠️ May miss globally optimal sequences (acceptable trade-off)

### Role Assignment Strategy
Simple heuristic-based role assignment:
- Vocal dominance > 0.6 → lead-vocal
- Vocal dominance < 0.4 → lead-instrumental
- Stems available → consider stem roles
- ⚠️ Future enhancement: More sophisticated role optimization

## Usage Example

```typescript
import { planSequence } from '@/lib/audio/planner';

const result = await planSequence({
  trackIds: ['track-1', 'track-2', 'track-3', 'track-4'],
  constraints: {
    targetDurationSeconds: 900, // 15 minutes
    eventArchetype: 'warmup-journey',
    preferStems: true,
    maxTempoStretchPercent: 8,
  },
  userId: 'user-123',
});

console.log('Plan ID:', result.plan.planId);
console.log('Sequence:', result.plan.sequence);
console.log('Transitions:', result.plan.transitions);
console.log('Quality Score:', result.plan.qualityScores.overallScore);
console.log('Planning Trace:', result.trace);
```

## Testing

The planner is designed to be tested against the Phase 2 fixture corpus:

```bash
# Generate a plan for fixture tracks
npm run phase2:review:template -- --build phase3-planner

# Compare against baseline
node scripts/evaluate-phase2-review.mjs \
  --before tests/fixtures/audio-regression/baselines/baseline.json \
  --after tests/fixtures/audio-regression/phase3-planner.json
```

## Future Enhancements

1. **Advanced Role Optimization**: Try multiple role assignments and pick best
2. **Multi-Objective Optimization**: Balance energy flow, harmonic compatibility, vocal collision
3. **ML-Based Scoring**: Train compatibility models on user feedback
4. **Real-Time Replanning**: Adjust sequence during playback
5. **Transition Parameter Optimization**: Fine-tune overlap duration, EQ, FX per transition

## Migration from Old Recommendations

The old `/api/mashups/recommendations` endpoint still works but is now deprecated. It will be replaced by `/api/mashups/plan` for new features.

To migrate:
1. Call `/api/mashups/plan` with your track IDs
2. Use the returned `plan.sequence` for track order
3. Use `plan.transitions` for transition details
4. Store `plan.planId` for reference

## Completion Status

✅ Planning graph builder
✅ Asymmetric compatibility scorer
✅ Sequence planning algorithm
✅ Role assignment logic
✅ Transition planner
✅ Policy rules engine
✅ API endpoint
✅ Database schema
✅ Trace persistence
✅ Module exports

**Phase 3 is COMPLETE and ready for testing against Phase 2 benchmarks.**

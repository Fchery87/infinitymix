/**
 * Phase 7 Design: Controlled Rollout and Learning Loop
 * 
 * This design document outlines the experimentation infrastructure
 * for safely rolling out planner/analysis changes and learning from usage.
 */

## Overview

Phase 7 provides the infrastructure for safe, measured rollouts of quality-sensitive
changes. It connects planner decisions to user outcomes and enables data-driven
decisions about which variants to promote or rollback.

## Goals

1. **Safe Rollout**: Gradually expose new features to subsets of users
2. **Real Variants**: Ensure experiment variants represent actual code path differences
3. **Outcome Tracking**: Connect planner decisions to user feedback
4. **Dashboard Visibility**: Real-time metrics for variant comparison
5. **Rollback Capability**: Quick reversion when variants underperform

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                  EXPERIMENT SYSTEM                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Assign     │───▶│   Execute    │───▶│   Capture    │  │
│  │   Variant    │    │   Code Path  │    │   Telemetry  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                   │           │
│         ▼                   ▼                   ▼           │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  experiment  │    │  planner/    │    │   feedback   │  │
│  │ _assignments │    │  analysis    │    │   telemetry  │  │
│  │    table     │    │   service    │    │    table     │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  ANALYTICS & DASHBOARD                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Variant    │    │    User      │    │   Rollback   │  │
│  │ Comparison   │    │  Satisfaction│    │   Controls   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Experiment Domains

### 1. Analysis Strategy
- **control**: Current analysis pipeline
- **candidate**: New analysis model or heuristics
- **Metrics**: Browser hint acceptance rate, analysis confidence

### 2. Cue-Point Strategy
- **control**: Rule-based cue detection
- **candidate**: ML-based cue detection
- **Metrics**: Transition quality scores, user adjustments

### 3. Planner Strategy
- **control**: Greedy sequence selection
- **candidate**: Optimization-based selection
- **Metrics**: Plan quality scores, user regeneration rate

### 4. Transition Policy
- **control**: Conservative transitions
- **candidate**: Aggressive/creative transitions
- **Metrics**: QA pass rate, user export rate

## Key Design Decisions

### Stable Assignment
Users must consistently get the same variant:
- Hash user ID + experiment name + salt
- Deterministic assignment (no random per-request)
- Survives cache clears, new sessions

### Real Behavior Branches
Variants must actually change behavior:
- Not just telemetry labels
- Different code paths
- Measurable differences in outcomes

### Comprehensive Telemetry
Capture the full story:
- Variant assignment
- Planner decisions
- User interactions
- Final outcomes

## Implementation Plan

### 1. Experiment Types & Assignment
- `src/lib/experiments/types.ts` - Experiment domain definitions
- `src/lib/experiments/assignment.ts` - Stable variant assignment
- `src/lib/experiments/config.ts` - Experiment configurations

### 2. Telemetry Capture
- `src/lib/experiments/telemetry.ts` - Event capture
- `src/lib/experiments/feedback.ts` - User feedback integration
- Database schema for telemetry storage

### 3. Analytics Dashboard
- `src/app/api/admin/experiments/route.ts` - Experiment listing
- `src/app/api/admin/experiments/[id]/metrics/route.ts` - Variant metrics
- `src/app/api/admin/experiments/[id]/rollback/route.ts` - Rollback control

### 4. Rollback Mechanism
- Automatic rollback on failure thresholds
- Manual rollback controls
- Gradual traffic shifting

## Database Schema

### experiment_definitions
```sql
- id: uuid
- name: string (unique)
- domain: enum ('analysis', 'cue_point', 'planner', 'transition')
- description: text
- hypothesis: text
- start_date: timestamp
- end_date: timestamp (nullable)
- status: enum ('draft', 'running', 'paused', 'completed', 'rolled_back')
- traffic_allocation: integer (0-100)
- created_at: timestamp
```

### experiment_variants
```sql
- id: uuid
- experiment_id: uuid -> experiment_definitions
- name: string
- code_path: string (identifier for code branch)
- traffic_percentage: integer
- config_overrides: jsonb
- is_control: boolean
- created_at: timestamp
```

### experiment_assignments
```sql
- id: uuid
- experiment_id: uuid
- user_id: text
- variant_id: uuid
- assigned_at: timestamp
- context: jsonb (user agent, session info)
```

### experiment_telemetry
```sql
- id: uuid
- experiment_id: uuid
- variant_id: uuid
- user_id: text
- event_type: string
- event_data: jsonb
- created_at: timestamp
```

## API Endpoints

### Admin Endpoints

**List Experiments**
```
GET /api/admin/experiments
Response: {
  experiments: Array<{
    id: string;
    name: string;
    domain: string;
    status: string;
    variants: Array<{ name: string; trafficPercentage: number }>;
  }>;
}
```

**Get Experiment Metrics**
```
GET /api/admin/experiments/:id/metrics
Response: {
  experiment: { ... };
  variantMetrics: Array<{
    variantId: string;
    variantName: string;
    sampleSize: number;
    keyMetrics: Record<string, number>;
    confidenceIntervals: Record<string, [number, number]>;
  }>;
  comparison: {
    isSignificant: boolean;
    winnerVariantId?: string;
    improvement?: number;
  };
}
```

**Rollback Experiment**
```
POST /api/admin/experiments/:id/rollback
Body: {
  reason: string;
  gradual?: boolean; // default true
  durationMinutes?: number; // default 30
}
```

## Rollback Rules

### Automatic Rollback Triggers:
1. **Failure Rate**: Variant has 2x the error rate of control
2. **Performance**: Variant is 50% slower than control
3. **User Satisfaction**: Significant drop in satisfaction scores
4. **QA Metrics**: QA failure rate > 30%

### Gradual Rollback:
- Shift traffic from variant to control over N minutes
- Monitor metrics during transition
- Abort rollback if metrics improve

### Immediate Rollback:
- Critical errors (data loss, security)
- Sudden metric drops (>80% change)
- Manual admin trigger

## Success Metrics

### Phase 7 Success:
- ✅ Variants represent real code path differences
- ✅ Assignment is stable (user gets same variant consistently)
- ✅ All user feedback linked to variant
- ✅ Dashboard shows real-time comparison
- ✅ Rollback completes in < 5 minutes
- ✅ No user-visible impact during rollback

## Implementation Phases

### Phase 7A: Core Infrastructure
1. Database schema for experiments
2. Variant assignment logic
3. Basic telemetry capture

### Phase 7B: Integration
1. Integrate into analysis service
2. Integrate into planner service
3. Add variant-aware logging

### Phase 7C: Dashboard
1. Admin experiment listing
2. Variant comparison metrics
3. Rollback controls

### Phase 7D: Automation
1. Automatic rollback detection
2. Alerting for metric anomalies
3. Gradual traffic shifting

## Risks & Mitigations

**Risk**: Users experience inconsistent behavior
**Mitigation**: Stable assignment, consistent variant per user

**Risk**: Experiments slow down the system
**Mitigation**: Async telemetry capture, minimal overhead

**Risk**: Hard to interpret results
**Mitigation**: Clear metrics, confidence intervals, automated analysis

**Risk**: Rollback causes disruption
**Mitigation**: Gradual rollback, monitoring, abort capability

export type PlannerTrackType = 'backbone' | 'vocal' | 'bridge' | 'outro'

export type PlannerPhase = 'intro' | 'main' | 'outro'

export type RulePredicateOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'includes'
  | 'truthy'
  | 'falsy'

export interface RuleCondition {
  fact: string
  op: RulePredicateOperator
  value?: unknown
}

export interface PlannerRuleAction {
  type: 'set' | 'push'
  field: string
  value: unknown
}

export interface PlannerRule {
  id: string
  description: string
  when: RuleCondition[]
  actions: PlannerRuleAction[]
}

export interface PlannerRulePack {
  id: string
  version: string
  rules: PlannerRule[]
}

export interface PlannerDecisionTrace {
  step: string
  selectedSegment?: {
    trackId: string
    type: string
    startTime: number
    duration: number
  }
  rulesFired: string[]
  rejectedAlternatives?: Array<{
    trackId: string
    reason: string
  }>
  metadata?: Record<string, unknown>
}

export interface RuleEvaluationTrace {
  rulesFired: string[]
  fieldMutations: string[]
}

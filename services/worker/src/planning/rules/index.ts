import { DEFAULT_PLANNER_RULE_PACK } from './default-rule-pack'
import { ENERGY_ARC_RULES } from './energy-arc-rules'
import { PHRASE_SAFETY_RULES } from './phrase-safety-rules'
import { GENRE_COMPATIBILITY_RULES } from './genre-compatibility-rules'
import type { PlannerRulePack } from '../types'

const RULE_PACK_REGISTRY: Record<string, PlannerRulePack> = {
  [DEFAULT_PLANNER_RULE_PACK.id]: DEFAULT_PLANNER_RULE_PACK,
  [ENERGY_ARC_RULES.id]: ENERGY_ARC_RULES,
  [PHRASE_SAFETY_RULES.id]: PHRASE_SAFETY_RULES,
  [GENRE_COMPATIBILITY_RULES.id]: GENRE_COMPATIBILITY_RULES
}

export function getPlannerRulePack(rulePackId?: string): PlannerRulePack | null {
  if (!rulePackId) return DEFAULT_PLANNER_RULE_PACK
  return RULE_PACK_REGISTRY[rulePackId] ?? null
}

export function listPlannerRulePacks(): string[] {
  return Object.keys(RULE_PACK_REGISTRY)
}


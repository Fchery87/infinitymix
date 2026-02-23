import { Engine } from 'json-rules-engine'
import type { PlannerRulePack, RuleCondition, RuleEvaluationTrace } from './types'

function flattenFacts(
  input: Record<string, unknown>,
  prefix = '',
  output: Record<string, unknown> = {}
): Record<string, unknown> {
  for (const [key, value] of Object.entries(input)) {
    const path = prefix ? `${prefix}.${key}` : key
    output[path] = value

    if (
      value != null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      flattenFacts(value as Record<string, unknown>, path, output)
    }
  }

  return output
}

function normalizeOperator(op: RuleCondition['op']): string {
  switch (op) {
    case 'eq':
      return 'equal'
    case 'neq':
      return 'notEqual'
    case 'gt':
      return 'greaterThan'
    case 'gte':
      return 'greaterThanInclusive'
    case 'lt':
      return 'lessThan'
    case 'lte':
      return 'lessThanInclusive'
    case 'in':
      return 'in'
    case 'includes':
      return 'contains'
    case 'truthy':
      return 'truthy'
    case 'falsy':
      return 'falsy'
    default:
      return 'equal'
  }
}

function createRuleEngine(rulePack: PlannerRulePack): Engine {
  const engine = new Engine([], { allowUndefinedFacts: true })

  engine.addOperator('truthy', (factValue: unknown) => Boolean(factValue))
  engine.addOperator('falsy', (factValue: unknown) => !factValue)

  for (const rule of rulePack.rules) {
    engine.addRule({
      name: rule.id,
      conditions: {
        all: rule.when.map((condition) => ({
          fact: condition.fact,
          operator: normalizeOperator(condition.op),
          value: condition.value
        }))
      },
      event: {
        type: rule.id,
        params: {
          actions: rule.actions
        }
      }
    } as any)
  }

  return engine
}

function cloneState<T extends Record<string, unknown>>(state: T): T {
  return JSON.parse(JSON.stringify(state)) as T
}

const engineCache = new Map<string, Engine>()

function getEngine(rulePack: PlannerRulePack): Engine {
  const cacheKey = `${rulePack.id}:${rulePack.version}`
  const existing = engineCache.get(cacheKey)
  if (existing) return existing
  const engine = createRuleEngine(rulePack)
  engineCache.set(cacheKey, engine)
  return engine
}

export async function evaluatePlannerRules<TState extends Record<string, unknown>>(
  rulePack: PlannerRulePack,
  facts: Record<string, unknown>,
  initialState: TState
): Promise<{ state: TState; trace: RuleEvaluationTrace }> {
  const state = cloneState(initialState)
  const trace: RuleEvaluationTrace = {
    rulesFired: [],
    fieldMutations: []
  }

  const engine = getEngine(rulePack)
  const runFacts = flattenFacts(facts)
  const result = await engine.run(runFacts)
  const events = (result.events ?? []) as Array<{ type?: string; params?: { actions?: Array<{ type: string; field: string; value: unknown }> } }>

  for (const event of events) {
    if (!event.type) continue
    trace.rulesFired.push(event.type)
    for (const action of event.params?.actions ?? []) {
      if (action.type === 'set') {
        ;(state as Record<string, unknown>)[action.field] = action.value
        trace.fieldMutations.push(`${action.field}=set`)
      } else if (action.type === 'push') {
        const current = (state as Record<string, unknown>)[action.field]
        const next = Array.isArray(current) ? [...current, action.value] : [action.value]
        ;(state as Record<string, unknown>)[action.field] = next
        trace.fieldMutations.push(`${action.field}=push`)
      }
    }
  }

  return { state, trace }
}

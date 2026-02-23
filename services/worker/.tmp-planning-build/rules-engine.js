"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluatePlannerRules = evaluatePlannerRules;
const json_rules_engine_1 = require("json-rules-engine");
function flattenFacts(input, prefix = '', output = {}) {
    for (const [key, value] of Object.entries(input)) {
        const path = prefix ? `${prefix}.${key}` : key;
        output[path] = value;
        if (value != null &&
            typeof value === 'object' &&
            !Array.isArray(value)) {
            flattenFacts(value, path, output);
        }
    }
    return output;
}
function normalizeOperator(op) {
    switch (op) {
        case 'eq':
            return 'equal';
        case 'neq':
            return 'notEqual';
        case 'gt':
            return 'greaterThan';
        case 'gte':
            return 'greaterThanInclusive';
        case 'lt':
            return 'lessThan';
        case 'lte':
            return 'lessThanInclusive';
        case 'in':
            return 'in';
        case 'includes':
            return 'contains';
        case 'truthy':
            return 'truthy';
        case 'falsy':
            return 'falsy';
        default:
            return 'equal';
    }
}
function createRuleEngine(rulePack) {
    const engine = new json_rules_engine_1.Engine([], { allowUndefinedFacts: true });
    engine.addOperator('truthy', (factValue) => Boolean(factValue));
    engine.addOperator('falsy', (factValue) => !factValue);
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
        });
    }
    return engine;
}
function cloneState(state) {
    return JSON.parse(JSON.stringify(state));
}
const engineCache = new Map();
function getEngine(rulePack) {
    const cacheKey = `${rulePack.id}:${rulePack.version}`;
    const existing = engineCache.get(cacheKey);
    if (existing)
        return existing;
    const engine = createRuleEngine(rulePack);
    engineCache.set(cacheKey, engine);
    return engine;
}
async function evaluatePlannerRules(rulePack, facts, initialState) {
    const state = cloneState(initialState);
    const trace = {
        rulesFired: [],
        fieldMutations: []
    };
    const engine = getEngine(rulePack);
    const runFacts = flattenFacts(facts);
    const result = await engine.run(runFacts);
    const events = (result.events ?? []);
    for (const event of events) {
        if (!event.type)
            continue;
        trace.rulesFired.push(event.type);
        for (const action of event.params?.actions ?? []) {
            if (action.type === 'set') {
                ;
                state[action.field] = action.value;
                trace.fieldMutations.push(`${action.field}=set`);
            }
            else if (action.type === 'push') {
                const current = state[action.field];
                const next = Array.isArray(current) ? [...current, action.value] : [action.value];
                state[action.field] = next;
                trace.fieldMutations.push(`${action.field}=push`);
            }
        }
    }
    return { state, trace };
}

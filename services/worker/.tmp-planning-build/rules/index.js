"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlannerRulePack = getPlannerRulePack;
exports.listPlannerRulePacks = listPlannerRulePacks;
const default_rule_pack_1 = require("./default-rule-pack");
const RULE_PACKS = {
    [default_rule_pack_1.DEFAULT_PLANNER_RULE_PACK.id]: default_rule_pack_1.DEFAULT_PLANNER_RULE_PACK
};
function getPlannerRulePack(rulePackId) {
    if (!rulePackId)
        return default_rule_pack_1.DEFAULT_PLANNER_RULE_PACK;
    return RULE_PACKS[rulePackId] ?? default_rule_pack_1.DEFAULT_PLANNER_RULE_PACK;
}
function listPlannerRulePacks() {
    return Object.values(RULE_PACKS);
}

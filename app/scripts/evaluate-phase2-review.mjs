import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = next;
    i++;
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function averageScores(entry) {
  const values = Object.values(entry.scores || {}).filter((value) => typeof value === 'number');
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function missingScoreKeys(entry) {
  return Object.entries(entry.scores || {})
    .filter(([, value]) => typeof value !== 'number')
    .map(([key]) => key);
}

function hasHardFail(entry) {
  const values = Object.values(entry.scores || {});
  return values.some((value) => typeof value === 'number' && value <= 2);
}

function formatDelta(value) {
  if (value == null) return 'n/a';
  const rounded = Math.round(value * 100) / 100;
  return `${rounded >= 0 ? '+' : ''}${rounded}`;
}

const args = parseArgs(process.argv.slice(2));
if (!args.before || !args.after) {
  console.error(
    'Usage: node scripts/evaluate-phase2-review.mjs --before <baseline-review.json> --after <candidate-review.json>'
  );
  process.exit(1);
}

const before = readJson(args.before);
const after = readJson(args.after);
const afterById = new Map((after.fixtures || []).map((entry) => [entry.fixtureId, entry]));

let overallPass = true;
console.log('Phase 2 Review Comparison');
console.log(`- Before: ${path.resolve(args.before)}`);
console.log(`- After:  ${path.resolve(args.after)}`);

for (const beforeEntry of before.fixtures || []) {
  const afterEntry = afterById.get(beforeEntry.fixtureId);
  if (!afterEntry) {
    overallPass = false;
    console.log(`- ${beforeEntry.fixtureId}: missing in candidate review`);
    continue;
  }

  const beforeAverage = averageScores(beforeEntry);
  const afterAverage = averageScores(afterEntry);
  const beforeMissing = missingScoreKeys(beforeEntry);
  const afterMissing = missingScoreKeys(afterEntry);
  const delta =
    beforeAverage != null && afterAverage != null
      ? afterAverage - beforeAverage
      : null;
  const regression = delta != null && delta <= -0.5;
  const hardFail = hasHardFail(afterEntry);
  const incomplete = beforeMissing.length > 0 || afterMissing.length > 0;
  if (regression || hardFail || incomplete || beforeAverage == null || afterAverage == null) {
    overallPass = false;
  }

  console.log(
    `- ${beforeEntry.fixtureId}: avg ${beforeAverage ?? 'n/a'} -> ${afterAverage ?? 'n/a'} (${formatDelta(delta)})`
  );
  if (beforeMissing.length > 0) {
    console.log(`  baseline incomplete: missing scores for ${beforeMissing.join(', ')}`);
  }
  if (afterMissing.length > 0) {
    console.log(`  candidate incomplete: missing scores for ${afterMissing.join(', ')}`);
  }
  if (hardFail) {
    console.log('  hard fail: one or more Phase 2 category scores are <= 2');
  }
  if (regression) {
    console.log('  review fail: average score regressed by >= 0.5 from baseline');
  }
}

console.log(`Overall result: ${overallPass ? 'PASS' : 'FAIL'}`);
process.exit(overallPass ? 0 : 1);

import fs from 'node:fs';
import path from 'node:path';

const TARGET_BROWSERS = ['Chrome', 'Edge', 'Safari'];

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

function evaluateReview(before, after) {
  const afterById = new Map((after.fixtures || []).map((entry) => [entry.fixtureId, entry]));
  const fixtures = [];
  let passed = true;

  for (const beforeEntry of before.fixtures || []) {
    const afterEntry = afterById.get(beforeEntry.fixtureId);
    if (!afterEntry) {
      passed = false;
      fixtures.push({
        fixtureId: beforeEntry.fixtureId,
        status: 'fail',
        notes: ['Missing in candidate review'],
      });
      continue;
    }

    const beforeAverage = averageScores(beforeEntry);
    const afterAverage = averageScores(afterEntry);
    const beforeMissing = missingScoreKeys(beforeEntry);
    const afterMissing = missingScoreKeys(afterEntry);
    const hardFail = Object.values(afterEntry.scores || {}).some(
      (value) => typeof value === 'number' && value <= 2
    );
    const delta =
      beforeAverage != null && afterAverage != null ? afterAverage - beforeAverage : null;
    const regression = delta != null && delta <= -0.5;
    const notes = [];

    if (beforeMissing.length > 0) notes.push(`Baseline incomplete: ${beforeMissing.join(', ')}`);
    if (afterMissing.length > 0) notes.push(`Candidate incomplete: ${afterMissing.join(', ')}`);
    if (hardFail) notes.push('One or more Phase 2 category scores are <= 2');
    if (regression) notes.push('Average score regressed by >= 0.5');

    const status = notes.length === 0 ? 'pass' : 'fail';
    if (status === 'fail') passed = false;

    fixtures.push({
      fixtureId: beforeEntry.fixtureId,
      status,
      beforeAverage,
      afterAverage,
      delta,
      notes,
    });
  }

  return { passed, fixtures };
}

function safeRate(num, den) {
  if (!den) return 0;
  return num / den;
}

function evaluatePreviewQa(store) {
  const browsers = TARGET_BROWSERS.map((browser) => {
    const record = store.browsers?.[browser] ?? {
      total: 0,
      events: {},
      reasons: {},
      lastSeenAt: 0,
    };
    const capabilitySignals =
      (record.events.capability_detected ?? 0) +
      (record.events.capability_probe ?? 0) +
      (record.events.capability_unavailable ?? 0);
    const unavailable = record.events.capability_unavailable ?? 0;
    const previewStarted = record.events.preview_started ?? 0;
    const previewFailed = record.events.preview_failed ?? 0;

    let status = 'needs_data';
    let reason = 'No target-browser QA data captured yet.';
    if (previewFailed > 0) {
      status = 'fail';
      reason = 'Preview failures were recorded for this browser.';
    } else if (previewStarted > 0) {
      status = 'pass';
      reason = 'Preview started successfully with no recorded failures.';
    } else if (capabilitySignals > 0 && unavailable > 0) {
      status = 'pass_with_fallback';
      reason = 'Fallback observed without blocking failures.';
    }

    return {
      browser,
      status,
      capabilitySignals,
      unavailable,
      previewStarted,
      previewFailed,
      unavailableRate: safeRate(unavailable, capabilitySignals),
      failureRate: safeRate(previewFailed, previewStarted + previewFailed),
      reason,
    };
  });

  return {
    passed: browsers.every((browser) => browser.status === 'pass' || browser.status === 'pass_with_fallback'),
    browsers,
  };
}

function toMarkdown(report) {
  const lines = [];
  lines.push('# Phase 2 Signoff Report');
  lines.push('');
  lines.push(`Generated at: ${report.generatedAt}`);
  lines.push('');
  lines.push(`Overall result: ${report.overallPassed ? 'PASS' : 'FAIL'}`);
  lines.push('');
  lines.push('## Section Tagging Review');
  lines.push('');
  for (const fixture of report.review.fixtures) {
    lines.push(`- ${fixture.fixtureId}: ${fixture.status.toUpperCase()}`);
    if (fixture.beforeAverage != null || fixture.afterAverage != null) {
      lines.push(
        `  averages: ${fixture.beforeAverage ?? 'n/a'} -> ${fixture.afterAverage ?? 'n/a'}`
      );
    }
    for (const note of fixture.notes || []) {
      lines.push(`  note: ${note}`);
    }
  }
  lines.push('');
  lines.push('## Browser Preview QA');
  lines.push('');
  for (const browser of report.previewQa.browsers) {
    lines.push(`- ${browser.browser}: ${browser.status}`);
    lines.push(`  started=${browser.previewStarted} failed=${browser.previewFailed} unavailable=${browser.unavailable}`);
    lines.push(`  note: ${browser.reason}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

const args = parseArgs(process.argv.slice(2));
if (!args.reviewBefore || !args.reviewAfter || !args.previewQa) {
  console.error(
    'Usage: node scripts/generate-phase2-signoff-report.mjs --reviewBefore <baseline.json> --reviewAfter <candidate.json> --previewQa <preview-qa.json> [--out <report.json>] [--outMd <report.md>]'
  );
  process.exit(1);
}

const reviewBefore = readJson(args.reviewBefore);
const reviewAfter = readJson(args.reviewAfter);
const previewQa = readJson(args.previewQa);

const review = evaluateReview(reviewBefore, reviewAfter);
const previewQaSummary = evaluatePreviewQa(previewQa);
const report = {
  version: 1,
  phase: 'phase-2',
  generatedAt: new Date().toISOString(),
  overallPassed: review.passed && previewQaSummary.passed,
  review,
  previewQa: previewQaSummary,
};

const outPath = path.resolve(args.out || path.join('tests', 'fixtures', 'audio-regression', 'phase2-signoff-report.json'));
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

if (args.outMd) {
  fs.writeFileSync(path.resolve(args.outMd), toMarkdown(report));
}

console.log(`Saved Phase 2 signoff report: ${outPath}`);
console.log(`Overall result: ${report.overallPassed ? 'PASS' : 'FAIL'}`);

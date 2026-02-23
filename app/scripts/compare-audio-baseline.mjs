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
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function pct(v) {
  return v == null ? 'N/A' : `${Math.round(v * 10000) / 100}%`;
}

function delta(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') return null;
  return Number((b - a).toFixed(4));
}

function mergeKeys(a = {}, b = {}) {
  return Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
}

function printCountsDiff(title, before = {}, after = {}) {
  console.log(`\n${title}`);
  for (const key of mergeKeys(before, after)) {
    const a = Number(before[key] ?? 0);
    const b = Number(after[key] ?? 0);
    const d = b - a;
    console.log(`- ${key}: ${a} -> ${b} (${d >= 0 ? '+' : ''}${d})`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.before || !args.after) {
    console.error(
      'Usage: node scripts/compare-audio-baseline.mjs --before <snapshot.json> --after <snapshot.json>'
    );
    process.exit(1);
  }

  const beforePath = path.resolve(args.before);
  const afterPath = path.resolve(args.after);
  const before = readJson(beforePath);
  const after = readJson(afterPath);

  const beforeSummary = before.summary ?? {};
  const afterSummary = after.summary ?? {};

  console.log('Audio Baseline Comparison');
  console.log(`- Before: ${beforePath}`);
  console.log(`- After:  ${afterPath}`);
  console.log(
    `- Fixture manifest hash: ${before.fixtureManifest?.sha256 || 'n/a'} -> ${after.fixtureManifest?.sha256 || 'n/a'}`
  );
  console.log(
    `- Acceptance rate: ${pct(beforeSummary.browserHintAcceptanceRate)} -> ${pct(afterSummary.browserHintAcceptanceRate)}`
  );
  const acceptanceDelta = delta(
    beforeSummary.browserHintAcceptanceRate,
    afterSummary.browserHintAcceptanceRate
  );
  if (acceptanceDelta != null) {
    console.log(`- Acceptance delta: ${acceptanceDelta >= 0 ? '+' : ''}${Math.round(acceptanceDelta * 10000) / 100}%`);
  }
  console.log(
    `- Completed tracks: ${beforeSummary.completedTracks ?? 0} -> ${afterSummary.completedTracks ?? 0}`
  );
  console.log(
    `- Browser-hint tracks: ${beforeSummary.browserHintTracks ?? 0} -> ${afterSummary.browserHintTracks ?? 0}`
  );

  printCountsDiff(
    'Quality Counts',
    beforeSummary.qualityCounts ?? {},
    afterSummary.qualityCounts ?? {}
  );
  printCountsDiff(
    'Decision Reason Counts',
    beforeSummary.browserHintDecisionReasonCounts ?? {},
    afterSummary.browserHintDecisionReasonCounts ?? {}
  );
}

main();


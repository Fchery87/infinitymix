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

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function buildTemplate(manifest, buildLabel) {
  return {
    version: 1,
    phase: 'phase-2',
    buildLabel,
    generatedAt: new Date().toISOString(),
    fixtures: (manifest.fixtures || []).map((fixture) => ({
      fixtureId: fixture.id,
      filename: fixture.filename,
      useCases: fixture.useCases || [],
      browserPathUsed: null,
      analyzerFallback: null,
      browserHintDecisionReason: null,
      scores: {
        phraseAlignment: null,
        sectionChoiceQuality: null,
        transitionMusicality: null,
      },
      notes: '',
    })),
  };
}

const args = parseArgs(process.argv.slice(2));
const manifestPath = path.resolve(
  args.manifest || path.join('tests', 'fixtures', 'audio-regression', 'manifest.json')
);
const buildLabel = args.build || 'phase-2-candidate';
const outputPath = path.resolve(
  args.out ||
    path.join('tests', 'fixtures', 'audio-regression', `phase2-review-template-${buildLabel}.json`)
);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
ensureDir(path.dirname(outputPath));
fs.writeFileSync(outputPath, JSON.stringify(buildTemplate(manifest, buildLabel), null, 2));

console.log(`Saved Phase 2 review template: ${outputPath}`);

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Request failed ${res.status} for ${url}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function buildSnapshotSummary(metrics, browserTracks) {
  const analysis = metrics?.metrics?.audioPipeline?.analysis ?? null;
  return {
    browserHintAcceptanceRate: analysis?.browserHintAcceptanceRate ?? null,
    completedTracks: analysis?.completedTracks ?? 0,
    browserHintTracks: analysis?.browserHintTracks ?? 0,
    qualityCounts: analysis?.qualityCounts ?? {},
    browserHintDecisionReasonCounts: analysis?.browserHintDecisionReasonCounts ?? {},
    visibleBrowserHintTrackCount: Array.isArray(browserTracks?.tracks) ? browserTracks.tracks.length : 0,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args.baseUrl || process.env.IMX_BASELINE_BASE_URL || 'http://localhost:3000';
  const cookie = args.cookie || process.env.IMX_ADMIN_COOKIE || '';
  const outputDir =
    args.outputDir || path.join('tests', 'fixtures', 'audio-regression', 'baselines');
  const fixtureManifestPath = path.join('tests', 'fixtures', 'audio-regression', 'manifest.json');
  const fixtureManifestRaw = fs.readFileSync(fixtureManifestPath, 'utf8');
  const fixtureManifest = JSON.parse(fixtureManifestRaw);
  const fixtureManifestHash = crypto.createHash('sha256').update(fixtureManifestRaw).digest('hex');

  ensureDir(outputDir);

  const headers = {};
  if (cookie) headers.Cookie = cookie;

  const metricsUrl = `${baseUrl}/api/observability/metrics`;
  const browserTracksUrl = `${baseUrl}/api/admin/audio/tracks?analysisQuality=browser_hint&limit=50`;
  const allTracksUrl = `${baseUrl}/api/admin/audio/tracks?limit=50`;

  const [metrics, browserTracks, allTracks] = await Promise.all([
    fetchJson(metricsUrl, headers),
    fetchJson(browserTracksUrl, headers),
    fetchJson(allTracksUrl, headers),
  ]);

  const snapshot = {
    capturedAt: new Date().toISOString(),
    baseUrl,
    fixtureManifest: {
      path: fixtureManifestPath,
      version: fixtureManifest.version ?? null,
      updatedAt: fixtureManifest.updatedAt ?? null,
      fixtureCount: Array.isArray(fixtureManifest.fixtures) ? fixtureManifest.fixtures.length : 0,
      sha256: fixtureManifestHash,
    },
    endpoints: {
      observabilityMetrics: metricsUrl,
      adminTracksBrowserHint: browserTracksUrl,
      adminTracksAll: allTracksUrl,
    },
    summary: buildSnapshotSummary(metrics, browserTracks),
    metrics,
    adminTracks: {
      browserHint: browserTracks,
      all: allTracks,
    },
  };

  const outPath =
    args.out ||
    path.join(outputDir, `audio-baseline-${nowStamp()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));

  console.log(`Saved audio baseline snapshot: ${outPath}`);
  console.log(
    `Acceptance rate: ${
      snapshot.summary.browserHintAcceptanceRate == null
        ? 'N/A'
        : `${Math.round(snapshot.summary.browserHintAcceptanceRate * 100)}%`
    }`
  );
  console.log(`Fixture manifest hash: ${fixtureManifestHash}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});


// Lightweight load test helper using built-in fetch (Node 18+)
// Usage: BASE_URL=http://localhost:3000 CONCURRENCY=10 REQUESTS=50 node scripts/load-test.mjs

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const concurrency = Number(process.env.CONCURRENCY || 5);
const totalRequests = Number(process.env.REQUESTS || 25);

const targets = [
  '/api/health',
  '/api/mashups',
];

async function hit(url) {
  const start = Date.now();
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const ms = Date.now() - start;
    return { status: res.status, ms };
  } catch (error) {
    return { status: 0, ms: Date.now() - start, error: error instanceof Error ? error.message : 'unknown' };
  }
}

async function worker(id, work) {
  const results = [];
  for await (const url of work) {
    const result = await hit(url);
    results.push(result);
    console.log(`[worker ${id}] ${url} -> ${result.status} in ${result.ms}ms${result.error ? ` (${result.error})` : ''}`);
  }
  return results;
}

async function main() {
  const urls = Array.from({ length: totalRequests }, (_, i) => `${baseUrl}${targets[i % targets.length]}`);
  const perWorker = Math.ceil(urls.length / concurrency);
  const slices = Array.from({ length: concurrency }, (_, i) => urls.slice(i * perWorker, (i + 1) * perWorker)).filter(Boolean);

  const results = await Promise.all(slices.map((slice, i) => worker(i + 1, slice)));
  const flat = results.flat();
  const successes = flat.filter((r) => r.status >= 200 && r.status < 400).length;
  const failures = flat.length - successes;
  const avg = flat.reduce((sum, r) => sum + r.ms, 0) / flat.length;
  const p95 = [...flat.map((r) => r.ms)].sort((a, b) => a - b)[Math.floor(flat.length * 0.95)] || 0;

  console.log(`\nSummary`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Requests: ${flat.length}, Concurrency: ${concurrency}`);
  console.log(`Successes: ${successes}, Failures: ${failures}`);
  console.log(`Avg latency: ${avg.toFixed(1)}ms, P95: ${p95}ms`);
}

void main();

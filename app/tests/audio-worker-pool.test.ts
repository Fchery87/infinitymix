import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('worker_threads', () => ({
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    postMessage: vi.fn(),
    terminate: vi.fn(),
  })),
  isMainThread: true,
  parentPort: null,
  workerData: { workerId: 0 },
}));

vi.mock('@/lib/logger', () => ({
  log: vi.fn(),
}));

describe('audio-worker-pool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('module imports', () => {
    it('exports required functions', async () => {
      const module = await import('@/lib/audio/worker/audio-worker-pool');
      expect(typeof module.submitAudioJob).toBe('function');
      expect(typeof module.getQueueStats).toBe('function');
      expect(typeof module.shutdownWorkers).toBe('function');
    });
  });

  describe('getQueueStats', () => {
    it('returns queue statistics', async () => {
      const { getQueueStats } = await import('@/lib/audio/worker/audio-worker-pool');
      const stats = getQueueStats();
      expect(stats).toHaveProperty('pendingJobs');
      expect(stats).toHaveProperty('activeWorkers');
      expect(stats).toHaveProperty('totalWorkers');
    });
  });
});

describe('audio-worker-convenience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('module imports', () => {
    it('exports convenience functions', async () => {
      const module = await import('@/lib/audio/audio-worker-convenience');
      expect(typeof module.renderAutoDjMixWithWorker).toBe('function');
      expect(typeof module.analyzeTrackWithWorker).toBe('function');
      expect(typeof module.separateStemsWithWorker).toBe('function');
    });
  });
});

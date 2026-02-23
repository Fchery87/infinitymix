import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  getStorage: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  uploadedTracks: {},
}));

vi.mock('@/lib/queue', () => ({
  enqueueAnalysis: vi.fn(),
}));

vi.mock('@/lib/utils/rate-limiting', () => ({
  uploadRateLimit: vi.fn(),
  withRateLimit: () => (handler: (...args: unknown[]) => unknown) => {
    return (...args: unknown[]) => handler(...args);
  },
}));

vi.mock('@/lib/audio/upload-service', () => ({
  formatTrackResponse: (track: { id: string; originalFilename: string }) => ({
    id: track.id,
    original_filename: track.originalFilename,
  }),
}));

import { getSessionUser } from '@/lib/auth/session';
import { getStorage } from '@/lib/storage';
import { db } from '@/lib/db';
import { enqueueAnalysis } from '@/lib/queue';
import { POST } from '@/app/api/audio/upload/complete/route';

describe('upload complete route browser hint queue propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes browserAnalysisHint through to enqueueAnalysis payload', async () => {
    const sessionUserMock = getSessionUser as unknown as Mock;
    sessionUserMock.mockResolvedValue({ id: 'user-1' });

    const storageMock = getStorage as unknown as Mock;
    storageMock.mockResolvedValue({
      getFile: vi.fn().mockResolvedValue({
        buffer: Buffer.from('audio-bytes'),
        mimeType: 'audio/mpeg',
      }),
    });

    const dbInsertMock = db.insert as unknown as Mock;
    dbInsertMock.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'track-1',
            userId: 'user-1',
            originalFilename: 'file.mp3',
            storageUrl: 'r2://user-1/file.mp3',
            fileSizeBytes: 1024,
            mimeType: 'audio/mpeg',
            uploadStatus: 'uploaded',
            analysisStatus: 'pending',
            createdAt: new Date('2026-02-23T00:00:00.000Z'),
          },
        ]),
      }),
    });

    const browserAnalysisHint = {
      source: 'browser-worker',
      version: 'browser-v1',
      fileName: 'file.mp3',
      fileSizeBytes: 1024,
      mimeType: 'audio/mpeg',
      generatedAt: '2026-02-23T00:00:00.000Z',
      durationSeconds: 180,
      bpm: 124,
      bpmConfidence: 0.91,
      keySignature: 'Cmaj',
      keyConfidence: 0.8,
      phraseConfidence: 0.7,
      sectionConfidence: 0.65,
      confidence: {
        overall: 0.84,
        tempo: 0.91,
        key: 0.8,
        phrase: 0.7,
        section: 0.65,
      },
    };

    const req = new NextRequest('http://localhost/api/audio/upload/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        key: 'user-1/file.mp3',
        filename: 'file.mp3',
        contentType: 'audio/mpeg',
        size: 1024,
        browserAnalysisHint,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const enqueueAnalysisMock = enqueueAnalysis as unknown as Mock;
    expect(enqueueAnalysisMock).toHaveBeenCalledTimes(1);
    expect(enqueueAnalysisMock.mock.calls[0][0]).toMatchObject({
      type: 'analysis',
      trackId: 'track-1',
      storageUrl: 'r2://user-1/file.mp3',
      mimeType: 'audio/mpeg',
      fileName: 'file.mp3',
      browserAnalysisHint,
    });
    expect(Buffer.isBuffer(enqueueAnalysisMock.mock.calls[0][0].buffer)).toBe(true);
  });
});

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('@/lib/auth/config', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock('@/lib/storage', () => ({
  getStorage: vi.fn(),
}));

vi.mock('@/lib/utils/rate-limiting', () => ({
  uploadRateLimit: vi.fn(),
  generalRateLimit: vi.fn(),
  withRateLimit: (handler: (...args: unknown[]) => unknown) => {
    return (...args: unknown[]) => handler(...args);
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  uploadedTracks: {},
}));

vi.mock('@/lib/audio/analysis-service', () => ({
  startTrackAnalysis: vi.fn(),
}));

import { auth } from '@/lib/auth/config';
import { getStorage } from '@/lib/storage';
import { db } from '@/lib/db';
import { presignHandler } from '@/app/api/audio/upload/presign/route';
import { completeHandler } from '@/app/api/audio/upload/complete/route';

describe('upload presign/complete routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates presigned URL when authenticated', async () => {
    const sessionMock = auth.api.getSession as unknown as Mock;
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    const storageMock = getStorage as unknown as Mock;
    storageMock.mockResolvedValue({
      createPresignedUpload: vi.fn().mockResolvedValue({
        uploadUrl: 'https://r2/upload',
        headers: { 'Content-Type': 'audio/mpeg' },
        key: 'user-1/file.mp3',
        storageLocator: 'r2://user-1/file.mp3',
      }),
    });

    const req = new NextRequest('http://localhost/api/audio/upload/presign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename: 'file.mp3', contentType: 'audio/mpeg', size: 1024 }),
    });

    const res = await presignHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.upload_url).toBe('https://r2/upload');
    expect(json.key).toBe('user-1/file.mp3');
  });

  it('rejects presign without auth', async () => {
    const sessionMock = auth.api.getSession as unknown as Mock;
    sessionMock.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/audio/upload/presign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename: 'file.mp3', contentType: 'audio/mpeg', size: 1024 }),
    });
    const res = await presignHandler(req);
    expect(res.status).toBe(401);
  });

  it('completes upload and registers track', async () => {
    const sessionMock = auth.api.getSession as unknown as Mock;
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    const storageMock = getStorage as unknown as Mock;
    storageMock.mockResolvedValue({
      getFile: vi.fn().mockResolvedValue({ buffer: Buffer.from('data'), mimeType: 'audio/mpeg' }),
    });

    const dbInsertMock = db.insert as unknown as Mock;
    dbInsertMock.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: 'track-1',
          userId: 'user-1',
          originalFilename: 'file.mp3',
          storageUrl: 'r2://user-1/file.mp3',
          fileSizeBytes: 1024,
          mimeType: 'audio/mpeg',
          uploadStatus: 'uploaded',
          analysisStatus: 'pending',
          createdAt: new Date(),
          keySignature: null,
          bpm: null,
          durationSeconds: null,
          hasStems: false,
        }]),
      }),
    });

    const req = new NextRequest('http://localhost/api/audio/upload/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'user-1/file.mp3', filename: 'file.mp3', contentType: 'audio/mpeg', size: 1024 }),
    });

    const res = await completeHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.track.id).toBe('track-1');
    expect(json.track.original_filename).toBe('file.mp3');
  });
});

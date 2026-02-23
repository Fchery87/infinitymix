import { describe, it, expect } from 'vitest';
import { buildTusMetadata } from '../src/lib/audio/resumable-upload';

describe('buildTusMetadata', () => {
  it('encodes filename and content type', () => {
    const meta = buildTusMetadata('my-song.mp3', 'audio/mpeg', 'user-123');
    expect(meta).toEqual({
      filename: 'my-song.mp3',
      contentType: 'audio/mpeg',
      userId: 'user-123',
    });
  });

  it('includes projectId when provided', () => {
    const meta = buildTusMetadata('song.wav', 'audio/wav', 'user-1', 'proj-1');
    expect(meta.projectId).toBe('proj-1');
  });
});

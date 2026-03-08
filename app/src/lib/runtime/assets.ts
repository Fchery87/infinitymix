import path from 'node:path';

function sanitizeSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function splitFilename(filename: string) {
  const parsed = path.parse(filename);
  const base = sanitizeSegment(parsed.name || 'asset') || 'asset';
  const ext = sanitizeSegment(parsed.ext.replace(/^\./, '')) || 'bin';
  return { base, ext };
}

export function buildTrackUploadStorageKey(userId: string, filename: string) {
  const { base, ext } = splitFilename(filename);
  return `users/${sanitizeSegment(userId)}/tracks/${Date.now()}-${base}.${ext}`;
}

export function buildStemStorageKey(args: {
  trackId: string;
  stemType: string;
  extension: 'mp3' | 'wav';
}) {
  return `tracks/${sanitizeSegment(args.trackId)}/stems/${sanitizeSegment(args.stemType)}.${args.extension}`;
}

export function buildMashupStorageKey(args: {
  mashupId: string;
  variant: 'master' | 'playback';
  extension: 'wav' | 'mp3';
}) {
  return `mashups/${sanitizeSegment(args.mashupId)}/${args.variant}.${args.extension}`;
}

export function buildPreviewStorageKey(args: {
  previewIdempotencyKey: string;
  extension: 'mp3';
}) {
  return `previews/${sanitizeSegment(args.previewIdempotencyKey)}.${args.extension}`;
}

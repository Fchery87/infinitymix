import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

export interface TusUploadMetadata {
  filename: string;
  contentType: string;
  userId?: string;
  projectId?: string;
}

export interface TusUploadSession {
  id: string;
  userId: string;
  uploadLength: number;
  bytesReceived: number;
  metadata: TusUploadMetadata;
  tempFilePath: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  trackId?: string;
}

const TUS_DIR = path.join(os.tmpdir(), 'infinitymix-tus');

function getSessionPaths(id: string) {
  return {
    json: path.join(TUS_DIR, `${id}.json`),
    bin: path.join(TUS_DIR, `${id}.bin`),
  };
}

async function ensureTusDir() {
  await fs.mkdir(TUS_DIR, { recursive: true });
}

export function parseTusMetadata(header: string | null): TusUploadMetadata {
  if (!header) {
    return { filename: 'upload.bin', contentType: 'application/octet-stream' };
  }

  const entries = header
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [key, value] = part.split(' ');
      return [key, value] as const;
    });

  const data: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (!key || !value) continue;
    try {
      data[key] = Buffer.from(value, 'base64').toString('utf8');
    } catch {
      // ignore malformed metadata entries
    }
  }

  return {
    filename: data.filename || 'upload.bin',
    contentType: data.contentType || 'application/octet-stream',
    userId: data.userId || undefined,
    projectId: data.projectId || undefined,
  };
}

export async function createTusSession(input: {
  id: string;
  userId: string;
  uploadLength: number;
  metadata: TusUploadMetadata;
}): Promise<TusUploadSession> {
  await ensureTusDir();
  const paths = getSessionPaths(input.id);
  const now = new Date().toISOString();
  const session: TusUploadSession = {
    id: input.id,
    userId: input.userId,
    uploadLength: input.uploadLength,
    bytesReceived: 0,
    metadata: input.metadata,
    tempFilePath: paths.bin,
    createdAt: now,
    updatedAt: now,
  };

  await fs.writeFile(paths.json, JSON.stringify(session, null, 2), 'utf8');
  await fs.writeFile(paths.bin, Buffer.alloc(0));
  return session;
}

export async function readTusSession(id: string): Promise<TusUploadSession | null> {
  try {
    await ensureTusDir();
    const paths = getSessionPaths(id);
    const raw = await fs.readFile(paths.json, 'utf8');
    return JSON.parse(raw) as TusUploadSession;
  } catch {
    return null;
  }
}

export async function writeTusSession(session: TusUploadSession): Promise<void> {
  await ensureTusDir();
  const paths = getSessionPaths(session.id);
  session.updatedAt = new Date().toISOString();
  await fs.writeFile(paths.json, JSON.stringify(session, null, 2), 'utf8');
}

export async function appendTusChunk(session: TusUploadSession, chunk: Buffer): Promise<TusUploadSession> {
  await fs.appendFile(session.tempFilePath, chunk);
  session.bytesReceived += chunk.length;
  await writeTusSession(session);
  return session;
}

export async function readTusUploadBuffer(session: TusUploadSession): Promise<Buffer> {
  return fs.readFile(session.tempFilePath);
}

export async function cleanupTusSession(id: string): Promise<void> {
  const paths = getSessionPaths(id);
  await Promise.allSettled([fs.rm(paths.json, { force: true }), fs.rm(paths.bin, { force: true })]);
}

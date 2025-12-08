import { db } from '@/lib/db';
import { uploadedTracks } from '@/lib/db/schema';
import { getStorage } from '@/lib/storage';
import { ValidationError } from '@/lib/utils/error-handling';
import { enqueueAnalysis } from '@/lib/queue';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/wave'];

export type UploadedTrackResponse = {
  id: string;
  original_filename: string;
  analysis_status: string;
  bpm: number | null;
  musical_key: string | null;
  camelot_key: string | null;
  bpm_confidence: number | null;
  key_confidence: number | null;
  beat_grid: number[];
  phrases: Array<{ start: number; end: number; energy: number }>;
  structure: Array<{ label: string; start: number; end: number; confidence: number }>;
  drop_moments: number[];
  waveform_lite: number[];
  analysis_version: string | null;
  duration_seconds: number | null;
  has_stems: boolean;
  file_size_bytes: number;
  mime_type: string;
  created_at: string;
};

export async function processSingleUpload(userId: string, file: File): Promise<UploadedTrackResponse> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new ValidationError(`Unsupported file type: ${file.type}`);
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError(`File ${file.name} exceeds 50MB limit`);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const storage = await getStorage();
  const storageUrl = await storage.uploadFile(buffer, `${userId}/${Date.now()}-${file.name}`, file.type);

  const [track] = await db
    .insert(uploadedTracks)
    .values({
      userId,
      originalFilename: file.name,
      storageUrl,
      fileSizeBytes: file.size,
      mimeType: file.type,
      uploadStatus: 'uploaded',
      analysisStatus: 'pending',
    })
    .returning();

  // Enqueue analysis (in-memory queue by default)
  void enqueueAnalysis({ type: 'analysis', trackId: track.id, buffer, storageUrl, mimeType: file.type, fileName: file.name });

  return formatTrackResponse(track);
}

export function formatTrackResponse(track: typeof uploadedTracks.$inferSelect): UploadedTrackResponse {
  return {
    id: track.id,
    original_filename: track.originalFilename,
    analysis_status: track.analysisStatus,
    bpm: track.bpm ? Number(track.bpm) : null,
    musical_key: track.keySignature ?? null,
    camelot_key: track.camelotKey ?? null,
    bpm_confidence: track.bpmConfidence ? Number(track.bpmConfidence) : null,
    key_confidence: track.keyConfidence ? Number(track.keyConfidence) : null,
    beat_grid: track.beatGrid ?? [],
    phrases: track.phrases ?? [],
    structure: track.structure ?? [],
    drop_moments: track.dropMoments ?? [],
    waveform_lite: track.waveformLite ?? [],
    analysis_version: track.analysisVersion ?? null,
    duration_seconds: track.durationSeconds ? Number(track.durationSeconds) : null,
    has_stems: Boolean(track.hasStems),
    file_size_bytes: track.fileSizeBytes,
    mime_type: track.mimeType,
    created_at: track.createdAt.toISOString(),
  };
}

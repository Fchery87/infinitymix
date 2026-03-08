import type { UploadOptions } from 'tus-js-client';
import { getAudioPipelineFeatureFlags } from './feature-flags';
import { emitAudioPipelineTelemetry } from './telemetry';

export interface TusMetadata {
  filename: string;
  contentType: string;
  userId: string;
  projectId?: string;
}

export function buildTusMetadata(
  filename: string,
  contentType: string,
  userId: string,
  projectId?: string
): TusMetadata {
  const meta: TusMetadata = {
    filename,
    contentType,
    userId,
  };
  if (projectId) {
    meta.projectId = projectId;
  }
  return meta;
}

export interface ResumableUploadOptions {
  file: File;
  endpoint: string;
  metadata: TusMetadata;
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
  onSuccess?: (uploadUrl: string) => void;
  onError?: (error: Error) => void;
  previousUploadUrl?: string;
}

export interface ResumableUploadResult {
  uploadUrl: string;
  bytesUploaded: number;
}

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;
const RETRY_DELAYS = [0, 1000, 3000, 5000];

export async function startResumableUpload(
  options: ResumableUploadOptions
): Promise<ResumableUploadResult> {
  const flags = getAudioPipelineFeatureFlags();

  if (!flags.resumableUploads) {
    throw new Error('Resumable uploads feature is disabled');
  }

  let tus: typeof import('tus-js-client') | null = null;
  try {
    tus = await import('tus-js-client');
  } catch {
    emitAudioPipelineTelemetry('resumable_upload_import_failed', {
      area: 'upload',
      status: 'error',
    });
    throw new Error('tus-js-client is not available');
  }

  return new Promise((resolve, reject) => {
    const uploadOptions: UploadOptions = {
      endpoint: options.endpoint,
      chunkSize: DEFAULT_CHUNK_SIZE,
      retryDelays: RETRY_DELAYS,
      metadata: {
        filename: options.metadata.filename,
        contentType: options.metadata.contentType,
        userId: options.metadata.userId,
        ...(options.metadata.projectId ? { projectId: options.metadata.projectId } : {}),
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        emitAudioPipelineTelemetry('resumable_upload_progress', {
          area: 'upload',
          status: 'start',
          bytesUploaded,
          bytesTotal,
          filename: options.metadata.filename,
        });
        options.onProgress?.(bytesUploaded, bytesTotal);
      },
      onSuccess: () => {
        const uploadUrl = upload.url ?? '';
        emitAudioPipelineTelemetry('resumable_upload_success', {
          area: 'upload',
          status: 'success',
          filename: options.metadata.filename,
          uploadUrl,
        });
        options.onSuccess?.(uploadUrl);
        resolve({
          uploadUrl,
          bytesUploaded: options.file.size,
        });
      },
      onError: (error) => {
        emitAudioPipelineTelemetry('resumable_upload_error', {
          area: 'upload',
          status: 'error',
          filename: options.metadata.filename,
          errorMessage: error.message,
        });
        options.onError?.(error);
        reject(error);
      },
    };

    if (options.previousUploadUrl) {
      uploadOptions.uploadUrl = options.previousUploadUrl;
    }

    emitAudioPipelineTelemetry('resumable_upload_start', {
      area: 'upload',
      status: 'start',
      filename: options.metadata.filename,
      fileSize: options.file.size,
      resuming: !!options.previousUploadUrl,
    });

    const upload = new tus.Upload(options.file, uploadOptions);

    const start = async () => {
      if (!options.previousUploadUrl && typeof upload.findPreviousUploads === 'function') {
        try {
          const previousUploads = await upload.findPreviousUploads();
          if (previousUploads.length > 0 && typeof upload.resumeFromPreviousUpload === 'function') {
            upload.resumeFromPreviousUpload(previousUploads[0]);
          }
        } catch {
          // best-effort resume discovery only
        }
      }

      upload.start();
    };

    void start();
  });
}

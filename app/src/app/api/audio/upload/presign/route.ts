import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { presignUploadSchema } from '@/lib/utils/validation';
import { ValidationError, AuthenticationError } from '@/lib/utils/error-handling';
import { getStorage } from '@/lib/storage';
import { uploadRateLimit, withRateLimit } from '@/lib/utils/rate-limiting';

const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/wave'];
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

async function presignHandler(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) throw new AuthenticationError('Authentication required');

    if (request.headers.get('content-type')?.includes('application/json') !== true) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
    }

    const body = await request.json();
    const { filename, contentType, size } = presignUploadSchema.parse(body);

    if (!ALLOWED_TYPES.includes(contentType)) {
      throw new ValidationError(`Unsupported file type: ${contentType}`);
    }
    if (size > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError(`File ${filename} exceeds 50MB limit`);
    }

    const storage = await getStorage();
    if (!storage.createPresignedUpload) {
      return NextResponse.json({ error: 'Presigned uploads are not supported' }, { status: 501 });
    }

    const key = `${user.id}/${Date.now()}-${filename}`;
    const presigned = await storage.createPresignedUpload({ key, contentType, contentLength: size });

    return NextResponse.json({
      upload_url: presigned.uploadUrl,
      headers: presigned.headers,
      key: presigned.key,
      storage_locator: presigned.storageLocator,
      max_size: MAX_FILE_SIZE_BYTES,
    });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Presign error:', error);
    return NextResponse.json({ error: 'Failed to create presigned URL' }, { status: 500 });
  }
}

export const POST = withRateLimit(uploadRateLimit)(presignHandler);

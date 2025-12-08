// Storage service with R2 (S3-compatible) primary and mock fallback
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Mock Storage Service for development/testing
class MockStorageService {
  private static storage: Map<string, { buffer: Buffer; mimeType: string }> = new Map();

  static async uploadFile(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    const key = `mock-uploads/${Date.now()}-${filename}`;
    const url = `https://mock-storage.infinitymix.local/${key}`;
    this.storage.set(url, { buffer, mimeType });
    return url;
  }

  static getDownloadUrl(key: string): string {
    return `https://mock-storage.infinitymix.local/${key}`;
  }

  static async getFile(url: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    return this.storage.get(url) ?? null;
  }

  static async deleteFile(key: string): Promise<void> {
    this.storage.delete(key);
  }

  static async testConnection(): Promise<boolean> {
    return true;
  }
}

const mockStorage: StorageService = {
  uploadFile: (buffer, filename, mimeType) => MockStorageService.uploadFile(buffer, filename, mimeType),
  getDownloadUrl: async (key) => MockStorageService.getDownloadUrl(key),
  deleteFile: (key) => MockStorageService.deleteFile(key),
  testConnection: () => MockStorageService.testConnection(),
  getFile: (url) => MockStorageService.getFile(url),
  createPresignedUpload: async () => {
    throw new Error('Presigned uploads are not available in mock storage');
  },
};

// Dynamic import for AWS S3 service
type StorageService = {
  uploadFile: (buffer: Buffer, filename: string, mimeType: string) => Promise<string>;
  getDownloadUrl: (key: string) => Promise<string>;
  deleteFile: (key: string) => Promise<void>;
  testConnection: () => Promise<boolean>;
  getFile?: (url: string) => Promise<{ buffer: Buffer; mimeType: string } | null>;
  createPresignedUpload?: (params: { key: string; contentType: string; contentLength?: number }) => Promise<{
    uploadUrl: string;
    headers: Record<string, string>;
    key: string;
    storageLocator: string;
  }>;
};

let Storage: StorageService;

// Initialize storage service based on environment
async function initializeStorage(): Promise<void> {
  const hasR2 =
    Boolean(process.env.R2_ENDPOINT) &&
    Boolean(process.env.R2_ACCESS_KEY_ID) &&
    Boolean(process.env.R2_SECRET_ACCESS_KEY) &&
    Boolean(process.env.R2_BUCKET);

  if (hasR2) {
    try {
      const client = new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
        },
      });

      const bucket = process.env.R2_BUCKET as string;
      const publicBase = process.env.R2_PUBLIC_BASE?.replace(/\/$/, '');

      const extractKey = (value: string) => {
        let key = value;
        if (publicBase && key.startsWith(publicBase)) {
          key = key.slice(publicBase.length);
        }
        // Handle r2:// URLs - just strip the protocol
        if (key.startsWith('r2://')) {
          key = key.replace(/^r2:\/\//, '');
        } 
        // Handle https:// URLs - strip protocol AND domain
        else if (key.startsWith('http://') || key.startsWith('https://')) {
          key = key.replace(/^https?:\/\//, '').replace(/^[^/]+\//, '');
        }
        key = key.replace(/^\//, '');
        return key;
      };

      Storage = {
        uploadFile: async (buffer, filename, mimeType) => {
          const key = filename;
          await client.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: key,
              Body: buffer,
              ContentType: mimeType,
            })
          );
          return publicBase ? `${publicBase}/${key}` : `r2://${key}`;
        },
        getDownloadUrl: async (key) => {
          if (publicBase) return `${publicBase}/${key}`;
          const objectKey = extractKey(key);
          return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: objectKey }), { expiresIn: 900 });
        },
        createPresignedUpload: async ({ key, contentType }) => {
          const uploadUrl = await getSignedUrl(
            client,
            new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
            { expiresIn: 900 }
          );
          const storageLocator = publicBase ? `${publicBase}/${key}` : `r2://${key}`;
          return {
            uploadUrl,
            headers: { 'Content-Type': contentType },
            key,
            storageLocator,
          };
        },
        deleteFile: async (key) => {
          const objectKey = extractKey(key);
          await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
        },
        testConnection: async () => {
          try {
            await client.send(
              new PutObjectCommand({
                Bucket: bucket,
                Key: `healthcheck-${Date.now()}.tmp`,
                Body: Buffer.from('ok'),
                ContentType: 'text/plain',
              })
            );
            return true;
          } catch (error) {
            console.error('R2 testConnection failed', error);
            return false;
          }
        },
        getFile: async (url) => {
          const objectKey = extractKey(url);
          try {
            console.log(`📥 R2 getFile: url=${url} -> key=${objectKey}`);
            const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
            // @ts-expect-error: sdk stream typing
            const arrayBuffer = await res.Body.transformToByteArray();
            console.log(`✅ R2 getFile success: ${objectKey} (${arrayBuffer.byteLength} bytes)`);
            return { buffer: Buffer.from(arrayBuffer), mimeType: res.ContentType || 'application/octet-stream' };
          } catch (error) {
            console.error(`❌ R2 getFile failed for key=${objectKey}:`, error);
            return null;
          }
        },
      };
      console.log('🗄️  Using Cloudflare R2 storage');
      return;
    } catch (error) {
      console.warn('⚠️  R2 setup failed, falling back to mock storage', error);
    }
  }

  Storage = mockStorage;
  console.log('🪄 Using mock storage for development');
}

// Export storage singleton
export const getStorage = async (): Promise<StorageService> => {
  if (!Storage) {
    await initializeStorage();
  }
  return Storage;
};

// For immediate use in route handlers
export { Storage as MockStorage };

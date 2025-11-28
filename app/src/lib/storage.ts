// Production storage configuration for AWS S3
// This replaces mock storage with real cloud storage

// Mock Storage Service for development/testing
class MockStorageService {
  private static storage: Map<string, { buffer: Buffer; mimeType: string }> = new Map();

  static async uploadFile(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    const key = `mock-uploads/${Date.now()}-${filename}`;
    this.storage.set(key, { buffer, mimeType });
    return `https://mock-storage.infinitymix.local/${key}`;
  }

  static getDownloadUrl(key: string): string {
    return `https://mock-storage.infinitymix.local/${key}`;
  }

  static async deleteFile(key: string): Promise<void> {
    this.storage.delete(key);
  }

  static async testConnection(): Promise<boolean> {
    return true;
  }
}

// Dynamic import for AWS S3 service
type StorageService = typeof MockStorageService;

let Storage: StorageService;

// Initialize storage service based on environment
async function initializeStorage(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && process.env.AWS_ACCESS_KEY_ID) {
    try {
      // Dynamically import AWS S3 service only when needed in production
      const { StorageService: S3Service } = await import('./storage-service');
      Storage = S3Service;
      console.log('🗄️  Using AWS S3 for production storage');
    } catch (error) {
      console.warn('⚠️  AWS SDK not available, falling back to mock storage');
      Storage = MockStorageService;
    }
  } else {
    Storage = MockStorageService;
    console.log('🪄 Using mock storage for development');
  }
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

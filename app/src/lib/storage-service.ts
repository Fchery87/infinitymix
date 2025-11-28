// AWS S3 Storage Service for production
// This file only loads when AWS SDK is available in production

// Stub service that will be replaced when AWS SDK is available
export class StorageService {
  static async uploadFile(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    throw new Error('AWS SDK not installed. Install with: npm install aws-sdk');
  }

  static getDownloadUrl(key: string): string {
    throw new Error('AWS SDK not installed. Install with: npm install aws-sdk');
  }

  static async deleteFile(key: string): Promise<void> {
    throw new Error('AWS SDK not installed. Install with: npm install aws-sdk');
  }

  static async testConnection(): Promise<boolean> {
    return false;
  }
}

// In production, this will be overridden with actual AWS S3 implementation
// The real AWS service should be included in production deployment

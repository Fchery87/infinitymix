// AWS S3 Storage Service for production
// This file only loads when AWS SDK is available in production

// Stub service that will be replaced when AWS SDK is available
export class StorageService {
  static async uploadFile(_buffer: Buffer, _filename: string, _mimeType: string): Promise<string> {
    void _buffer;
    void _filename;
    void _mimeType;
    throw new Error('AWS SDK not installed. Install with: npm install aws-sdk');
  }

  static getDownloadUrl(_key: string): string {
    void _key;
    throw new Error('AWS SDK not installed. Install with: npm install aws-sdk');
  }

  static async deleteFile(_key: string): Promise<void> {
    void _key;
    throw new Error('AWS SDK not installed. Install with: npm install aws-sdk');
  }

  static async getFile(_url: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    void _url;
    throw new Error('AWS SDK not installed. Install with: npm install aws-sdk');
  }

  static async testConnection(): Promise<boolean> {
    return false;
  }
}

// In production, this will be overridden with actual AWS S3 implementation
// The real AWS service should be included in production deployment

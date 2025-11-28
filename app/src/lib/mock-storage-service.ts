// Mock Storage Service for development/testing
export class MockStorageService {
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

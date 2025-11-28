import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function generateMashupName(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `InfinityMix_${timestamp}`;
}

export function validateAudioFile(file: File): boolean {
  const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/wave'];
  const maxSize = 50 * 1024 * 1024; // 50MB
  return validTypes.includes(file.type) && file.size <= maxSize;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'text-green-600';
    case 'pending':
    case 'queued':
      return 'text-yellow-600';
    case 'processing':
    case 'analyzing':
    case 'generating':
      return 'text-blue-600';
    case 'failed':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

export function getStatusText(status: string): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'uploaded':
      return 'Uploaded';
    case 'analyzing':
      return 'Analyzing...';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'queued':
      return 'Queued';
    case 'generating':
      return 'Generating...';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

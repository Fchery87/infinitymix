'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils/helpers';

interface FileUploadProps {
  onUpload: (files: FileList) => void;
  isUploading: boolean;
  accept?: string;
  className?: string;
}

export function FileUpload({ onUpload, isUploading, accept = ".mp3,.wav", className }: FileUploadProps) {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onUpload(files);
      event.target.value = ''; // Reset input
    }
  };

  return (
    <Card className={cn("h-full flex flex-col border-dashed border-2 border-white/10 bg-black/20 hover:bg-black/40 hover:border-primary/30 transition-all duration-300 group relative overflow-hidden", className)}>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <CardHeader>
        <CardTitle className="flex items-center text-2xl">
          <Upload className="w-6 h-6 mr-3 text-primary" />
          Upload Source Tracks
        </CardTitle>
        <CardDescription className="text-lg">
          Support for MP3 & WAV (Max 50MB)
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center justify-center min-h-[300px] p-10">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse-glow" />
          <div className="w-24 h-24 bg-gradient-to-tr from-gray-800 to-gray-900 rounded-full flex items-center justify-center border border-white/10 relative z-10 group-hover:scale-110 transition-transform duration-300">
            <Upload className="w-10 h-10 text-gray-400 group-hover:text-white transition-colors" />
          </div>
        </div>
        <p className="text-xl font-medium text-gray-300 mb-2">
          Drag & drop files here
        </p>
        <p className="text-gray-500 mb-8">
          or click below to browse
        </p>
        <input
          type="file"
          multiple
          accept={accept}
          onChange={handleFileChange}
          disabled={isUploading}
          className="hidden"
          id="file-upload-component"
        />
        <Button asChild disabled={isUploading} size="lg" variant="glow" className="px-10">
          <label htmlFor="file-upload-component" className="cursor-pointer font-bold">
            {isUploading ? 'Uploading...' : 'Select Audio Files'}
          </label>
        </Button>
      </CardContent>
    </Card>
  );
}

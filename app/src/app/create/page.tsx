'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { FileUpload } from '@/components/file-upload';
import { TrackList, Track } from '@/components/track-list';
import { DurationPicker, DurationPreset } from '@/components/duration-picker';

export default function CreatePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(true); // Auto-logged in for development
  const [uploadedTracks, setUploadedTracks] = useState<Track[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('2_minutes');

  const handleFileUpload = (files: FileList) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    // Create mock tracks for development
    const mockTracks: Track[] = Array.from(files).map((file, index) => ({
      id: `mock-track-${Date.now()}-${index}`,
      original_filename: file.name,
      analysis_status: Math.random() > 0.5 ? 'completed' : 'analyzing' as const,
      bpm: Math.random() > 0.5 ? Math.floor(Math.random() * (140 - 80) + 80) : null,
      musical_key: Math.random() > 0.5 ? ['C', 'D', 'E', 'F', 'G', 'A', 'B'][Math.floor(Math.random() * 7)] + ['maj', 'min'][Math.floor(Math.random() * 2)] : null,
      created_at: new Date().toISOString(),
    }));

    setTimeout(() => {
      setUploadedTracks(prev => [...prev, ...mockTracks]);
      setIsUploading(false);
    }, 2000); // Simulate upload time
  };

  const handleRemoveTrack = (id: string) => {
    setUploadedTracks(prev => prev.filter(t => t.id !== id));
  };

  const handleGenerateMashup = async () => {
    const completedTracks = uploadedTracks.filter(t => t.analysis_status === 'completed');
    if (completedTracks.length < 2) {
      alert('Please wait for at least 2 tracks to finish analysis');
      return;
    }

    setIsGenerating(true);

    // Simulate mashup generation
    setTimeout(() => {
      setIsGenerating(false);
      alert('✅ Mashup generated successfully! Check the "My Mashups" page to see your creation.');
    }, 3000); // Simulate 3-second generation time
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans text-foreground relative">
      {/* Navbar */}
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-background/60 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link href="/create">
              <div className="flex items-center group cursor-pointer">
                <div className="w-10 h-10 bg-gradient-to-tr from-primary to-orange-600 rounded-xl flex items-center justify-center mr-3 shadow-lg group-hover:shadow-primary/50 transition-all duration-300">
                  <Zap className="w-6 h-6 text-white fill-white" />
                </div>
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 group-hover:to-white transition-all">InfinityMix</h1>
              </div>
            </Link>
            <nav className="flex items-center space-x-6">
              <Link href="/mashups">
                <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/5">My Mashups</Button>
              </Link>
              <Link href="/profile">
                <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/5">Profile</Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="border-white/10 hover:bg-white/5 hover:text-white">Sign Out</Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4">
            Unleash Your <span className="text-primary glow-text">Sonic Creativity</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Drag, drop, and let our AI engine fuse your tracks into a masterpiece.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* Upload Zone (Left/Top) */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-7 space-y-6"
          >
            <FileUpload 
                onUpload={handleFileUpload} 
                isUploading={isUploading} 
            />
          </motion.div>

          {/* Controls & Generation (Right/Bottom) */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-5 space-y-6"
          >
            {/* Settings using reusable DurationPicker */}
            <DurationPicker 
                value={durationPreset} 
                onChange={setDurationPreset} 
            />
            
            {/* Generation Action */}
            <Card className="bg-card/60 backdrop-blur-xl">
                <CardContent className="pt-6">
                    <Button 
                        className="w-full h-14 text-lg font-bold relative overflow-hidden group" 
                        variant="default"
                        onClick={handleGenerateMashup}
                        disabled={isGenerating || uploadedTracks.filter(t => t.analysis_status === 'completed').length < 2}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-primary via-orange-400 to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <span className="relative z-10 flex items-center justify-center">
                        {isGenerating ? (
                            <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3" />
                            Processing...
                            </>
                        ) : (
                            <>
                            <Zap className="w-5 h-5 mr-2 fill-white" />
                            Generate Mashup
                            </>
                        )}
                        </span>
                    </Button>
                    {uploadedTracks.filter(t => t.analysis_status === 'completed').length < 2 && (
                        <p className="text-xs text-center mt-3 text-gray-500">
                        * Requires at least 2 analyzed tracks
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Mini Status */}
            <Card className="bg-black/20 border-white/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="text-sm text-gray-400">Engine Status</div>
                <div className="flex items-center text-sm text-green-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                  Online & Ready
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Track List using reusable component */}
        <TrackList 
            tracks={uploadedTracks} 
            onRemoveTrack={handleRemoveTrack} 
        />
        
      </main>
    </div>
  );
}

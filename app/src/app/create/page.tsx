'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Music, Play, Download, Clock, CheckCircle, AlertCircle, Zap, FileAudio, Trash2 } from 'lucide-react';
import { formatFileSize, getStatusColor, getStatusText } from '@/lib/utils/helpers';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface Track {
  id: string;
  original_filename: string;
  analysis_status: 'pending' | 'analyzing' | 'completed' | 'failed';
  bpm: number | null;
  musical_key: string | null;
  created_at: string;
}

export default function CreatePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(true); // Auto-logged in for development
  const [uploadedTracks, setUploadedTracks] = useState<Track[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [durationPreset, setDurationPreset] = useState<'1_minute' | '2_minutes' | '3_minutes'>('2_minutes');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    // Create mock tracks for development (since we don't have real backend running)
    const mockTracks = Array.from(files).map((file, index) => ({
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

    // Clear the input
    event.target.value = '';
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
    // Redirect to home login if not authenticated (simulated)
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
              <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/5">Profile</Button>
              <Button variant="outline" className="border-white/10 hover:bg-white/5 hover:text-white">Sign Out</Button>
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
            <Card className="h-full flex flex-col border-dashed border-2 border-white/10 bg-black/20 hover:bg-black/40 hover:border-primary/30 transition-all duration-300 group relative overflow-hidden">
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
                  accept=".mp3,.wav"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                  id="file-upload"
                />
                <Button asChild disabled={isUploading} size="lg" variant="glow" className="px-10">
                  <label htmlFor="file-upload" className="cursor-pointer font-bold">
                    {isUploading ? 'Uploading...' : 'Select Audio Files'}
                  </label>
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Controls & Generation (Right/Bottom) */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-5 space-y-6"
          >
            {/* Settings Card */}
            <Card className="bg-card/60 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <Clock className="w-5 h-5 mr-3 text-primary" />
                  Mashup Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-3 text-gray-400">Target Duration</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['1_minute', '2_minutes', '3_minutes'] as const).map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setDurationPreset(preset)}
                        className={`py-3 px-2 rounded-lg text-sm font-medium transition-all duration-200 border ${
                          durationPreset === preset 
                            ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_15px_rgba(249,115,22,0.4)]' 
                            : 'bg-black/40 text-gray-400 border-white/5 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        {preset.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="pt-4 border-t border-white/5">
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
                </div>
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

        {/* Track List */}
        <AnimatePresence>
          {uploadedTracks.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-12"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Track Pool</h3>
                <span className="text-sm text-gray-500">{uploadedTracks.length} tracks loaded</span>
              </div>
              
              <div className="grid gap-3">
                {uploadedTracks.map((track, index) => (
                  <motion.div
                    key={track.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="group flex items-center justify-between p-4 bg-card/40 hover:bg-card/60 border border-white/5 hover:border-primary/20 rounded-xl backdrop-blur-sm transition-all duration-200"
                  >
                    <div className="flex items-center space-x-4 flex-1">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-black/40 border border-white/5 ${
                        track.analysis_status === 'completed' ? 'text-primary' : 'text-gray-500'
                      }`}>
                        <FileAudio className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-white group-hover:text-primary transition-colors">
                          {track.original_filename}
                        </p>
                        <div className="flex items-center space-x-3 text-sm text-gray-500 mt-1">
                          <span className="flex items-center">
                             {track.analysis_status === 'completed' ? (
                               <>
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2" />
                                {track.bpm} BPM
                               </>
                             ) : (
                               <span className="text-xs">Analyzing...</span>
                             )}
                          </span>
                          {track.musical_key && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-gray-700" />
                              <span>{track.musical_key}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      {track.analysis_status === 'completed' ? (
                        <div className="px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-medium border border-green-500/20">
                          Ready
                        </div>
                      ) : track.analysis_status === 'failed' ? (
                        <div className="px-3 py-1 rounded-full bg-red-500/10 text-red-500 text-xs font-medium border border-red-500/20">
                          Failed
                        </div>
                      ) : (
                        <div className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20 flex items-center">
                          <div className="w-2 h-2 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2" />
                          Processing
                        </div>
                      )}
                      <Button variant="ghost" size="icon" className="text-gray-600 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

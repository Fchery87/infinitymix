'use client';

import { useState } from 'react';
import { AudioPlayer } from '@/components/audio-player';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Plus, FolderKanban, Music, User } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/helpers';

export default function PlayerPage() {
  // Mock state for demonstration
  const [isPlaying, setIsPlaying] = useState(false);
  
  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden">
       {/* Visualizer Background Mock */}
       <div className="absolute inset-0 flex items-end justify-center opacity-20 pointer-events-none">
          {[...Array(20)].map((_, i) => (
              <div 
                key={i} 
                className="w-full mx-1 bg-primary animate-pulse" 
                style={{ 
                    height: `${Math.random() * 60 + 20}%`, 
                    animationDuration: `${Math.random() * 1 + 0.5}s` 
                }} 
              />
          ))}
       </div>

       <div className="relative z-10 p-8">
         <Link href="/mashups">
            <Button variant="ghost" className="text-gray-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Library
            </Button>
         </Link>
       </div>

       <div className="flex-1 flex flex-col items-center justify-center relative z-10">
          <div className="w-64 h-64 md:w-96 md:h-96 rounded-2xl bg-gradient-to-br from-gray-800 to-black border border-white/10 shadow-2xl flex items-center justify-center mb-12 relative overflow-hidden group">
             <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)] opacity-10 group-hover:opacity-20 transition-opacity animate-[spin_4s_linear_infinite]" />
             <div className="w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                <div className="w-16 h-16 rounded-full bg-primary blur-xl" />
             </div>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-2">Neon Nights Mix</h1>
          <p className="text-xl text-gray-400 mb-8">InfinityMix AI • 128 BPM • Key Am</p>
       </div>

       {/* Player Component */}
       <div className="relative z-50">
           <AudioPlayer 
              trackName="Neon Nights Mix"
              duration={185}
              isPlaying={isPlaying}
              onClose={() => {}} // Cannot close main player page
              onTogglePlay={() => setIsPlaying(!isPlaying)}
           />
       </div>

       {/* Bottom Navigation */}
       <PlayerNavigation />
    </div>
  );
}

function PlayerNavigation() {
  const pathname = usePathname();
  
  const navItems = [
    { href: '/create', label: 'Create', icon: Plus },
    { href: '/projects', label: 'Projects', icon: FolderKanban },
    { href: '/mashups', label: 'Mashups', icon: Music },
    { href: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-white/5 z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href === '/mashups' && pathname === '/player');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-all duration-200',
                isActive
                  ? 'text-primary'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
              {isActive && (
                <span className="absolute bottom-1 w-1 h-1 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

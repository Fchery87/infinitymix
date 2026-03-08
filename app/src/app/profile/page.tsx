'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Music, Users, Heart, Settings } from 'lucide-react';
import { Navigation } from '@/components/navigation';

export default function ProfilePage() {
  return (
    <div className="min-h-screen font-sans text-foreground bg-background">
        {/* Navbar */}
        <Navigation />

        <main className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
            {/* Profile Header */}
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-12">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-gray-800 to-black border-4 border-white/10 flex items-center justify-center shadow-2xl">
                    <span className="text-4xl font-bold text-gray-400">JD</span>
                </div>
                <div className="flex-1 text-center md:text-left space-y-2">
                    <h1 className="text-4xl font-bold text-white">John Doe</h1>
                    <p className="text-gray-400">Music Enthusiast • Member since Nov 2024</p>
                    <div className="flex items-center justify-center md:justify-start gap-4 pt-2">
                        <Button variant="outline" size="sm" className="gap-2">
                            <Settings className="w-4 h-4" />
                            Edit Profile
                        </Button>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                    <CardContent className="flex flex-col items-center justify-center p-6">
                        <Music className="w-8 h-8 text-primary mb-3" />
                        <span className="text-3xl font-bold text-white">12</span>
                        <span className="text-sm text-gray-500">Mashups Created</span>
                    </CardContent>
                </Card>
                <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                    <CardContent className="flex flex-col items-center justify-center p-6">
                        <Heart className="w-8 h-8 text-red-500 mb-3" />
                        <span className="text-3xl font-bold text-white">45</span>
                        <span className="text-sm text-gray-500">Likes Received</span>
                    </CardContent>
                </Card>
                <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                    <CardContent className="flex flex-col items-center justify-center p-6">
                        <Users className="w-8 h-8 text-blue-500 mb-3" />
                        <span className="text-3xl font-bold text-white">8</span>
                        <span className="text-sm text-gray-500">Followers</span>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity / Mashups */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white">Recent Activity</h2>
                    <Button variant="link" className="text-primary">View All</Button>
                </div>
                <div className="space-y-4">
                    {/* Mock Items */}
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="bg-card/20 border-white/5 hover:bg-card/40 transition-colors">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center text-primary">
                                    <Music className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-medium text-white">Midnight City x Levels</h3>
                                    <p className="text-sm text-gray-500">Created 2 days ago</p>
                                </div>
                                <div className="flex items-center gap-2">
                                     <span className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded border border-green-500/20">Completed</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </main>
    </div>
  );
}

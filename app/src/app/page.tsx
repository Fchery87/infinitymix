'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ArrowRight, Music, Zap, Layers, Wand2, PlayCircle, Radio, Check, Upload, Sliders, Download } from 'lucide-react';

export default function LandingPage() {
  const stagger = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="min-h-screen font-sans text-foreground flex flex-col">
      {/* Navbar */}
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-background/60 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-tr from-primary to-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                <Zap className="w-5 h-5 text-white fill-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                InfinityMix
              </span>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <Link href="#features" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Features</Link>
              <Link href="#how-it-works" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">How it Works</Link>
              <Link href="#pricing" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Pricing</Link>
            </nav>
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <Button variant="ghost" className="text-gray-300 hover:text-white">Sign In</Button>
              </Link>
              <Link href="/register">
                <Button variant="glow" className="font-bold">
                  Get Started <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-primary/20 rounded-full blur-[120px] opacity-30 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-blue-600/10 rounded-full blur-[100px] opacity-20 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="inline-flex items-center px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary text-sm font-medium mb-8 backdrop-blur-sm"
          >
            <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
            AI Music Engine v2.0 is Live
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight"
          >
            Create Professional <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-400 to-amber-400 glow-text">
              Mashups in Seconds
            </span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-xl text-gray-400 max-w-2xl mx-auto mb-10"
          >
            No DAW required. Upload your favorite tracks and let our advanced AI engine handle beatmatching, key alignment, and stem separation automatically.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4"
          >
            <Link href="/register">
              <Button size="lg" variant="glow" className="h-14 px-8 text-lg w-full sm:w-auto">
                Start Creating Now
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-white/10 hover:bg-white/5 w-full sm:w-auto">
              <PlayCircle className="mr-2 w-5 h-5" /> Listen to Demos
            </Button>
          </motion.div>

          {/* UI Mockup */}
          <motion.div 
            initial={{ opacity: 0, y: 40, rotateX: 20 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="mt-20 relative mx-auto max-w-5xl perspective-1000"
          >
            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl p-2 overflow-hidden">
              <div className="rounded-lg bg-black/60 aspect-video w-full flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=2574&auto=format&fit=crop')] bg-cover bg-center opacity-20" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                
                {/* Mock Interface Elements */}
                <div className="relative z-10 w-full h-full p-8 flex flex-col justify-end">
                  <div className="flex items-end space-x-2 mb-8 justify-center">
                    {[40, 70, 50, 90, 30, 60, 80, 40, 60, 50, 80, 40, 30, 70, 50].map((h, i) => (
                      <motion.div 
                        key={i}
                        initial={{ height: 10 }}
                        animate={{ height: `${h}%` }}
                        transition={{ 
                          duration: 1.5, 
                          repeat: Infinity, 
                          repeatType: "reverse",
                          delay: i * 0.1 
                        }}
                        className="w-3 bg-primary/80 rounded-t-sm shadow-[0_0_15px_rgba(249,115,22,0.5)]"
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-white/10 pt-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center text-primary">
                        <Music className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="h-4 w-32 bg-white/10 rounded mb-2" />
                        <div className="h-3 w-20 bg-white/5 rounded" />
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <div className="w-10 h-10 rounded-full border border-white/10" />
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                        <PlayCircle className="fill-white w-5 h-5" />
                      </div>
                      <div className="w-10 h-10 rounded-full border border-white/10" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Glow underneath */}
            <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[90%] h-[100px] bg-primary/20 blur-[80px] rounded-full -z-10" />
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 relative bg-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Beyond Simple Crossfading</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Our AI engine deconstructs music to its core elements to create structurally perfect mashups.
            </p>
          </div>

          <motion.div 
            variants={stagger}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-8"
          >
            <FeatureCard 
              icon={<Layers className="w-8 h-8 text-primary" />}
              title="Stem Separation"
              description="Isolate vocals, drums, bass, and instruments from any track with studio-quality precision using our proprietary neural networks."
            />
            <FeatureCard 
              icon={<Radio className="w-8 h-8 text-blue-400" />}
              title="Smart Sync"
              description="Automatic BPM detection and elastic time-stretching ensures your tracks are always locked in perfect time, preserving transient punch."
            />
            <FeatureCard 
              icon={<Wand2 className="w-8 h-8 text-purple-400" />}
              title="Harmonic Mixing"
              description="AI analyzes musical keys and suggests compatible tracks, pitch-shifting when necessary for dissonant-free mixes aligned by circle of fifths."
            />
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">From Upload to Viral Hit</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Three simple steps to create your next masterpiece.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <StepCard 
              number="01"
              icon={<Upload className="w-6 h-6 text-white" />}
              title="Upload Tracks"
              description="Drag and drop any MP3 or WAV files. We support up to 5 tracks per mashup project."
            />
            <StepCard 
              number="02"
              icon={<Sliders className="w-6 h-6 text-white" />}
              title="Configure AI"
              description="Select your target duration and style intensity. Our AI analyzes structure, drops, and choruses."
            />
            <StepCard 
              number="03"
              icon={<Download className="w-6 h-6 text-white" />}
              title="Export & Share"
              description="Get a high-quality 320kbps MP3 or WAV file instantly. Ready for SoundCloud, TikTok, or your DJ set."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 relative bg-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Start for free, upgrade when you&apos;re ready to go pro.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <PricingCard 
              title="Bedroom Producer"
              price="$0"
              description="Perfect for experimenting and making quick mashups."
              features={[
                "3 Mashups per day",
                "MP3 Quality Export",
                "Standard Processing Speed",
                "Basic Stem Separation"
              ]}
              ctaText="Start for Free"
              ctaLink="/create"
            />
            
            {/* Pro Plan */}
            <PricingCard 
              title="Touring DJ"
              price="$19"
              period="/month"
              description="For serious creators who need studio quality."
              isPopular={true}
              features={[
                "Unlimited Mashups",
                "Lossless WAV Export",
                "Priority GPU Processing",
                "Advanced Stem Separation",
                "Commercial License"
              ]}
              ctaText="Go Pro"
              ctaLink="/create"
            />

            {/* Enterprise Plan */}
            <PricingCard 
              title="Studio"
              price="$49"
              period="/month"
              description="Power features for production teams."
              features={[
                "Everything in Pro",
                "API Access",
                "Collaboration Tools",
                "Custom Branding",
                "Dedicated Support"
              ]}
              ctaText="Contact Sales"
              ctaLink="#"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5" />
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold mb-6">Ready to drop the beat?</h2>
          <p className="text-xl text-gray-400 mb-10">
            Join thousands of creators making viral mashups with InfinityMix.
          </p>
          <Link href="/create">
            <Button size="lg" variant="glow" className="h-16 px-12 text-xl rounded-full">
              Launch Studio
            </Button>
          </Link>
          <p className="mt-6 text-sm text-gray-500">
            No credit card required • Free tier available
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-black/40 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <Zap className="w-5 h-5 text-gray-400" />
              <span className="text-lg font-bold text-gray-400">InfinityMix</span>
            </div>
            <div className="flex space-x-8 text-sm text-gray-500">
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
            <div className="mt-4 md:mt-0 text-sm text-gray-600">
              © 2024 InfinityMix. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <motion.div 
      variants={{
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 }
      }}
      className="p-8 rounded-2xl bg-card/30 border border-white/5 hover:bg-card/50 hover:border-primary/20 transition-all duration-300 group"
    >
      <div className="mb-6 p-4 rounded-xl bg-white/5 w-fit group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 text-white">{title}</h3>
      <p className="text-gray-400 leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}

function StepCard({ number, icon, title, description }: { number: string, icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="relative p-6 flex flex-col items-center text-center group">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 text-9xl font-bold text-white/5 select-none -z-10 group-hover:text-primary/5 transition-colors duration-500">
        {number}
      </div>
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-800 to-black border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-[0_0_30px_rgba(0,0,0,0.3)]">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-gray-400">
        {description}
      </p>
    </div>
  );
}

function PricingCard({ 
  title, 
  price, 
  period = "", 
  description, 
  features, 
  ctaText, 
  ctaLink,
  isPopular = false 
}: { 
  title: string, 
  price: string, 
  period?: string, 
  description: string, 
  features: string[], 
  ctaText: string, 
  ctaLink: string,
  isPopular?: boolean 
}) {
  return (
    <div className={`relative p-8 rounded-2xl border ${isPopular ? 'border-primary bg-card/40 shadow-[0_0_50px_rgba(249,115,22,0.15)]' : 'border-white/5 bg-card/20'} flex flex-col`}>
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white text-xs font-bold uppercase tracking-wider rounded-full">
          Most Popular
        </div>
      )}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-gray-400 mb-2">{title}</h3>
        <div className="flex items-baseline">
          <span className="text-4xl font-bold text-white">{price}</span>
          <span className="text-gray-500 ml-2">{period}</span>
        </div>
        <p className="text-sm text-gray-400 mt-4">{description}</p>
      </div>
      <div className="flex-1 mb-8">
        <ul className="space-y-4">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start text-sm text-gray-300">
              <Check className="w-4 h-4 text-primary mr-3 mt-0.5 flex-shrink-0" />
              {feature}
            </li>
          ))}
        </ul>
      </div>
      <Link href={ctaLink} className="block">
        <Button 
          variant={isPopular ? "glow" : "outline"} 
          className={`w-full ${!isPopular && "border-white/10 hover:bg-white/5 hover:text-white"}`}
        >
          {ctaText}
        </Button>
      </Link>
    </div>
  );
}

import { Zap } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 bg-gradient-to-tr from-primary to-orange-600 rounded-2xl flex items-center justify-center animate-bounce shadow-lg shadow-primary/20">
            <Zap className="w-8 h-8 text-white fill-white" />
          </div>
          <h2 className="mt-8 text-xl font-bold text-white animate-pulse">Loading InfinityMix...</h2>
        </div>
      </div>
    </div>
  );
}

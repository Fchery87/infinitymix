import { Navigation } from '@/components/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      
      <main className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 min-h-screen flex items-center justify-center">
        <div className="text-center space-y-6 max-w-md">
          <div className="text-8xl font-bold text-primary/20">404</div>
          <h1 className="text-3xl font-bold text-white">Page not found</h1>
          
          <p className="text-gray-400 text-lg">
            The page you are looking for does not exist or has been moved.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/create">
              <Button size="lg" className="w-full sm:w-auto">
                Return to Dashboard
              </Button>
            </Link>
            
            <Link href="/mashups">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Go to Library
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

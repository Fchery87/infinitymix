export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-4">
        <p className="text-sm uppercase tracking-[0.2em] text-gray-500">404</p>
        <h1 className="text-3xl font-bold">Page not found</h1>
        <p className="text-gray-400">The page you are looking for does not exist.</p>
      </div>
    </div>
  );
}

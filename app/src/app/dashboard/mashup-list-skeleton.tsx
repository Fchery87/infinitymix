export function MashupListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-40 bg-gray-800 rounded animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-5 w-20 bg-gray-800 rounded animate-pulse" />
              <div className="h-5 w-16 bg-gray-800 rounded animate-pulse" />
            </div>
            <div className="h-4 w-12 bg-gray-800 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

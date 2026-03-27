import { getMashupListForUser } from '@/lib/runtime/mashup-list';

export async function MashupList({ userId }: { userId: string }) {
  const mashups = await getMashupListForUser({ userId, page: 1, limit: 20 });

  if (mashups.data.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-gray-400">No mashups yet. Create your first mashup!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">Your Mashups</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mashups.data.map((mashup) => (
          <div key={mashup.id} className="glass-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-white font-medium truncate">{mashup.id.slice(0, 8)}</span>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  mashup.status === 'completed'
                    ? 'bg-green-500/20 text-green-400'
                    : mashup.status === 'failed'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                }`}
              >
                {mashup.status}
              </span>
            </div>
            <p className="text-gray-400 text-sm">
              {mashup.duration_seconds}s
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

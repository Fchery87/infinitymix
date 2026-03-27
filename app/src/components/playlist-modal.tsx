'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListMusic, Plus, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/helpers';

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  itemCount: number;
}

interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  mashupId?: string;
  onAdded?: () => void;
}

export function PlaylistModal({ isOpen, onClose, mashupId, onAdded }: PlaylistModalProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch('/api/playlists')
      .then((r) => r.json())
      .then((data) => setPlaylists(data.playlists || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOpen]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const playlist = await res.json();
      if (res.ok) {
        setPlaylists((prev) => [{ ...playlist, itemCount: 0 }, ...prev]);
        setNewName('');
        if (mashupId) {
          await handleAddToPlaylist(playlist.id);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    if (!mashupId || addedIds.has(playlistId)) return;
    setAddingTo(playlistId);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mashupId }),
      });
      if (res.ok) {
        setAddedIds((prev) => new Set(prev).add(playlistId));
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === playlistId ? { ...p, itemCount: p.itemCount + 1 } : p
          )
        );
        onAdded?.();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setAddingTo(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-md bg-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <ListMusic className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Playlists</h3>
              <p className="text-xs text-gray-500">
                {mashupId ? 'Add this mashup to a playlist' : 'Manage your playlists'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create New */}
        <div className="p-4 border-b border-white/5">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="New playlist name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="h-9 text-sm bg-black/20 border-white/10"
            />
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="h-9 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create
            </Button>
          </div>
        </div>

        {/* Playlist List */}
        <div className="max-h-[300px] overflow-y-auto">
          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : playlists.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No playlists yet. Create one above.
            </div>
          ) : (
            <div className="p-2">
              {playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => handleAddToPlaylist(playlist.id)}
                  disabled={addedIds.has(playlist.id) || addingTo === playlist.id}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all',
                    addedIds.has(playlist.id)
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : 'hover:bg-white/5 text-gray-300 hover:text-white',
                    addingTo === playlist.id && 'opacity-60'
                  )}
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                      addedIds.has(playlist.id)
                        ? 'bg-emerald-500/20'
                        : 'bg-white/5'
                    )}
                  >
                    {addedIds.has(playlist.id) ? (
                      <Check className="w-5 h-5 text-emerald-400" />
                    ) : addingTo === playlist.id ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <ListMusic className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{playlist.name}</p>
                    <p className="text-xs text-gray-500">{playlist.itemCount} mashups</p>
                  </div>
                  {addedIds.has(playlist.id) && (
                    <span className="text-xs text-emerald-400 font-medium">Added</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

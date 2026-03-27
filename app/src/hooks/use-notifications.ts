'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface NotificationItem {
  id: string;
  userId: string;
  type: 'mashup_completed' | 'collab_invite' | 'quota_warning' | 'mashup_public';
  title: string;
  message: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
  nextCursor: string | null;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async (cursor?: string) => {
    try {
      const params = new URLSearchParams({ limit: '15' });
      if (cursor) params.set('cursor', cursor);

      const res = await fetch(`/api/notifications?${params}`);
      if (!res.ok) return;

      const data: NotificationsResponse = await res.json();

      if (cursor) {
        setNotifications((prev) => [...prev, ...data.notifications]);
      } else {
        setNotifications(data.notifications);
      }
      setUnreadCount(data.unreadCount);
      setNextCursor(data.nextCursor);
    } catch {
      // Silently fail on poll
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
      });
      if (!res.ok) return;

      const now = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, readAt: now } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // noop
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'POST',
      });
      if (!res.ok) return;

      const now = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) => (n.readAt ? n : { ...n, readAt: now }))
      );
      setUnreadCount(0);
    } catch {
      // noop
    }
  }, []);

  const loadMore = useCallback(() => {
    if (nextCursor) fetchNotifications(nextCursor);
  }, [nextCursor, fetchNotifications]);

  useEffect(() => {
    fetchNotifications();
    intervalRef.current = setInterval(() => fetchNotifications(), 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    hasMore: !!nextCursor,
    markAsRead,
    markAllAsRead,
    loadMore,
    refresh: () => fetchNotifications(),
  };
}

export type { NotificationItem };

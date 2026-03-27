'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck, Music, Users, AlertTriangle, Globe, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils/helpers';
import { useNotifications, type NotificationItem } from '@/hooks/use-notifications';

const NOTIFICATION_ICONS: Record<NotificationItem['type'], React.ReactNode> = {
  mashup_completed: <Music className="w-4 h-4 text-emerald-400" />,
  collab_invite: <Users className="w-4 h-4 text-violet-400" />,
  quota_warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  mashup_public: <Globe className="w-4 h-4 text-sky-400" />,
};

const NOTIFICATION_BG: Record<NotificationItem['type'], string> = {
  mashup_completed: 'bg-emerald-500/10 border-emerald-500/20',
  collab_invite: 'bg-violet-500/10 border-violet-500/20',
  quota_warning: 'bg-amber-500/10 border-amber-500/20',
  mashup_public: 'bg-sky-500/10 border-sky-500/20',
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    notifications,
    unreadCount,
    isLoading,
    hasMore,
    markAsRead,
    markAllAsRead,
    loadMore,
  } = useNotifications();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleNotificationClick = (notification: NotificationItem) => {
    if (!notification.readAt) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative p-2.5 rounded-xl transition-all duration-300',
          'text-gray-400 hover:text-white',
          'hover:bg-white/5',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          isOpen && 'bg-white/10 text-white'
        )}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5" />

        {/* Unread badge - pulsing glow */}
        {unreadCount > 0 && (
          <>
            <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white leading-none shadow-[0_0_8px_rgba(249,115,22,0.6)]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
            <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-primary/40 animate-ping" />
          </>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className={cn(
            'absolute right-0 top-full mt-2 z-50',
            'w-[380px] max-h-[520px]',
            'rounded-2xl border border-white/8',
            'bg-[#111114]/95 backdrop-blur-xl',
            'shadow-2xl shadow-black/40',
            'flex flex-col overflow-hidden',
            'animate-in fade-in-0 zoom-in-95 duration-200'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors duration-200 group"
              >
                <CheckCheck className="w-3.5 h-3.5 group-hover:text-primary transition-colors" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {isLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                  <Bell className="w-6 h-6 text-gray-600" />
                </div>
                <p className="text-sm text-gray-500 font-medium">No notifications yet</p>
                <p className="text-xs text-gray-600 mt-1">
                  You&apos;ll see updates about your mashups here
                </p>
              </div>
            ) : (
              <div className="py-1">
                {notifications.map((notification) => {
                  const isUnread = !notification.readAt;
                  const content = (
                    <div
                      className={cn(
                        'flex gap-3 px-4 py-3.5 transition-all duration-200 cursor-pointer group',
                        'hover:bg-white/[0.03]',
                        isUnread && 'bg-white/[0.02]'
                      )}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {/* Type icon with colored background */}
                      <div
                        className={cn(
                          'flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border',
                          NOTIFICATION_BG[notification.type]
                        )}
                      >
                        {NOTIFICATION_ICONS[notification.type]}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              'text-sm leading-snug',
                              isUnread ? 'text-white font-medium' : 'text-gray-300'
                            )}
                          >
                            {notification.title}
                          </p>
                          {isUnread && (
                            <span className="flex-shrink-0 mt-1.5 w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_rgba(249,115,22,0.5)]" />
                          )}
                        </div>
                        {notification.message && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                            {notification.message}
                          </p>
                        )}
                        <p className="text-[11px] text-gray-600 mt-1.5">
                          {timeAgo(notification.createdAt)}
                        </p>
                      </div>

                      {/* Read indicator on hover */}
                      {isUnread && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                          className="flex-shrink-0 self-center p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all duration-200"
                          aria-label="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                      )}
                    </div>
                  );

                  if (notification.link) {
                    return (
                      <Link
                        key={notification.id}
                        href={notification.link}
                        onClick={() => handleNotificationClick(notification)}
                        className="block"
                      >
                        {content}
                      </Link>
                    );
                  }

                  return <div key={notification.id}>{content}</div>;
                })}

                {/* Load more */}
                {hasMore && (
                  <button
                    onClick={loadMore}
                    className="w-full py-3 text-xs text-gray-500 hover:text-white hover:bg-white/5 transition-colors duration-200"
                  >
                    Load more
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import type { NextConfig } from 'next';

export const CACHE_TIERS = {
  static: 'public, max-age=31536000, immutable',
  semiStatic: 'public, max-age=3600, stale-while-revalidate=86400',
  dynamic: 'no-store',
  private: 'private, max-age=0',
} as const;

export function getCdnHeaders(): NonNullable<NextConfig['headers']> {
  return async () => [
    {
      source: '/_next/static/:path*',
      headers: [{ key: 'Cache-Control', value: CACHE_TIERS.static }],
    },
    {
      source: '/api/waveforms/:path*',
      headers: [{ key: 'Cache-Control', value: CACHE_TIERS.semiStatic }],
    },
    {
      source: '/api/mashups/events/:path*',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-transform' },
        { key: 'X-Accel-Buffering', value: 'no' },
      ],
    },
    {
      source: '/api/health',
      headers: [{ key: 'Cache-Control', value: CACHE_TIERS.dynamic }],
    },
  ];
}

/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');

const r2Endpoint = process.env.R2_ENDPOINT ? new URL(process.env.R2_ENDPOINT).origin : null;
const r2PublicBase = process.env.R2_PUBLIC_BASE ? new URL(process.env.R2_PUBLIC_BASE).origin : null;

const connectSources = ["'self'", 'https:'];
const mediaSources = ["'self'", 'blob:'];

if (r2Endpoint) {
  connectSources.push(r2Endpoint);
  mediaSources.push(r2Endpoint);
}
if (r2PublicBase) {
  connectSources.push(r2PublicBase);
  mediaSources.push(r2PublicBase);
}

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  `connect-src ${connectSources.join(' ')}`,
  `media-src ${mediaSources.join(' ')}`,
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Resolve lockfile warning for monorepo
  outputFileTracingRoot: path.join(__dirname, '../../'),
  
  // Production optimizations
  poweredByHeader: false,
  
  // Enable trailing slash for consistency
  trailingSlash: true,
  
  // Externalize native packages that shouldn't be bundled (Turbopack-compatible)
  serverExternalPackages: ['ffmpeg-static', 'fluent-ffmpeg', 'music-metadata', 'pitchfinder'],
  
  // Turbopack configuration (Next.js 16 - top-level, not experimental)
  turbopack: {
    resolveAlias: {
      // Use a safe stub for next/document to avoid runtime Html import errors during prerender
      'next/document': './src/lib/next-document-stub.tsx',
      'next/dist/shared/lib/document': './src/lib/next-document-stub.tsx',
    },
  },
  
  // Image optimizations for production
  images: {
    remotePatterns: [],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: csp,
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

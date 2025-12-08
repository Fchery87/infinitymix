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
  // Production optimizations
  poweredByHeader: false,
  
  // Enable trailing slash for consistency
  trailingSlash: true,
  
  // Externalize native packages that shouldn't be bundled
  serverExternalPackages: ['ffmpeg-static', 'fluent-ffmpeg', 'music-metadata', 'pitchfinder'],
  
  // Image optimizations for production
  images: {
    domains: [],
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
  
  // Environment-specific optimizations
  webpack: (config, { dev }) => {
    // Use a safe stub for next/document to avoid runtime Html import errors during prerender
    const documentStub = path.join(__dirname, 'src/lib/next-document-stub.tsx');
    config.resolve.alias['next/document'] = documentStub;
    config.resolve.alias['next/dist/shared/lib/document'] = documentStub;

    // Suppress fluent-ffmpeg's dynamic require warnings
    config.ignoreWarnings = [
      { module: /node_modules\/fluent-ffmpeg/ }
    ];

    // Production optimizations
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: false,
      };
    }
    
    return config;
  },
};

module.exports = nextConfig;

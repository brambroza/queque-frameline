import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

export default function nextConfig(phase: string): NextConfig {
  return {
    // Keep HMR artifacts isolated so `next build` cannot invalidate a running
    // development server and briefly turn valid routes into 500 responses.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',

    // Native binary packages — must not be bundled by webpack
    serverExternalPackages: ['@resvg/resvg-js'],

    // Social-card routes read the Kanit TTFs at request time; make sure the
    // serverless bundle on Vercel carries them (they are not imported, so file
    // tracing would otherwise leave them out).
    outputFileTracingIncludes: {
      '/opengraph-image': ['./public/fonts/*.ttf'],
      '/twitter-image': ['./public/fonts/*.ttf'],
    },
  };
}

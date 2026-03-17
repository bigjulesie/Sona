import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['jsdom', '@mozilla/readability'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Permissions-Policy', value: 'microphone=*' },
        ],
      },
    ]
  },
};

export default nextConfig;

import type { NextConfig } from 'next';

const date = new Date();
// 简写格式: vYY.MMDD.HHmm (例如: v26.0316.0904)
const buildVersion = `v${String(date.getFullYear()).slice(-2)}.${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}.${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_VERSION: buildVersion,
  },
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  output: 'export',
  distDir: 'dist',
  transpilePackages: ['motion'],
};

export default nextConfig;

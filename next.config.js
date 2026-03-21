/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // basePath: process.env.GITHUB_ACTIONS && 'nextjs-template',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  poweredByHeader: false,
  // github pagesの場合
  // output: 'export',
  // k8sの場合
  output: 'standalone',
  allowedDevOrigins: ['192.168.16.12']
};

module.exports = nextConfig;

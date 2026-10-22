/** @type {import('next').NextConfig} */
const internalApiOrigin = process.env.INTERNAL_API_ORIGIN || 'http://127.0.0.1:4000';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@hexa/shared', '@hexa/shields'],
  allowedDevOrigins: ['*.e2b.app', 'localhost', '127.0.0.1'],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias || {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${internalApiOrigin}/api/v1/:path*`,
      },
      {
        source: '/api/socket.io/:path*',
        destination: `${internalApiOrigin}/api/socket.io/:path*`,
      },
      {
        source: '/api/socket.io',
        destination: `${internalApiOrigin}/api/socket.io/`,
      },
      {
        source: '/api/docs/:path*',
        destination: `${internalApiOrigin}/docs/:path*`,
      },
    ];
  },
};

export default nextConfig;

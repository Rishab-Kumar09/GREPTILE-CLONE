/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['github.com', 'gitlab.com', 'avatars.githubusercontent.com'],
  },
  webpack: (config, { isServer }) => {
    // Monaco Editor support
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig 
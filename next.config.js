/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['node-stream-zip', 'isomorphic-git']
  },
  // Webpack configuration for isomorphic-git compatibility
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Configure isomorphic-git for server-side rendering
      config.resolve = config.resolve || {}
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false
      }
    }
    return config
  }
}

module.exports = nextConfig
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['node-stream-zip']
  },
  // Lambda configuration for AWS Amplify
  serverRuntimeConfig: {
    // Lambda layers for git support
    lambdaLayers: [
      // Public git layer for AWS Lambda
      'arn:aws:lambda:us-east-1:553035198032:layer:git-lambda2:8'
    ]
  },
  // Environment variables for Lambda
  env: {
    // Enable git in Lambda environment
    PATH: '/opt/bin:/usr/local/bin:/usr/bin:/bin:/opt/nodejs/bin',
    LD_LIBRARY_PATH: '/opt/lib',
    GIT_EXEC_PATH: '/opt/libexec/git-core',
    GIT_TEMPLATE_DIR: '/opt/share/git-core/templates'
  },
  // Webpack configuration for Lambda compatibility
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ensure child_process is available for git commands
      config.externals = config.externals || []
      config.externals.push('child_process')
    }
    return config
  }
}

module.exports = nextConfig
/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/tenders/:path*',
        destination: '/pursuits/:path*',
        permanent: true,
      },
      {
        source: '/appointments/:path*',
        destination: '/contracts/:path*',
        permanent: true,
      },
      {
        source: '/challenges/:path*',
        destination: '/appeals/:path*',
        permanent: true,
      },
    ]
  },
}

export default nextConfig

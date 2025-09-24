/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { appDir: true },
  output: 'standalone',
  logging: { fetches: { fullUrl: true } },
};
export default nextConfig;
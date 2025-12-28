// /next.config.mjs
/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // En producción NO ignorar errores
    ignoreDuringBuilds: !isProd ? true : false,
  },
  typescript: {
    // En producción NO ignorar errores
    ignoreBuildErrors: !isProd ? true : false,
  },
};

export default nextConfig;

// /next.config.mjs
/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // En producción NO ignorar errores
    ignoreBuildErrors: !isProd ? true : false,
  },
};

export default nextConfig;

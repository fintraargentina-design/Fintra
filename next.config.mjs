// /next.config.mjs
/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  turbopack: {},
  reactStrictMode: true,
  typescript: {
    // En producción NO ignorar errores
    ignoreBuildErrors: !isProd ? true : false,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/data/fmp-bulk/**', '**/node_modules/**'],
      };
    }
    return config;
  },
};

export default nextConfig;

// /next.config.mjs
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
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
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;

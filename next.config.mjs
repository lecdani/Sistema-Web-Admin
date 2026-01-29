/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Permitir importar desde src
  experimental: {
    // No necesitamos nada especial por ahora
  },
  // Configuración para imágenes si las hay
  images: {
    domains: [],
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["argon2", "@prisma/client"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async redirects() {
    // Les modules Démarches et Transactions ont été déplacés sous /cabinet/dossiers.
    return [
      {
        source: "/cabinet/demarches/:path*",
        destination: "/cabinet/dossiers/demarches/:path*",
        permanent: false,
      },
      {
        source: "/cabinet/transactions/:path*",
        destination: "/cabinet/dossiers/transactions/:path*",
        permanent: false,
      },
    ];
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Language", value: "fr-SN" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Désactive le cache fichier de webpack pour éviter les verrous Windows en dev
    config.cache = false;
    return config;
  },
};

export default nextConfig;

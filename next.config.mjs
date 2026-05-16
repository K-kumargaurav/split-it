import withPWA from "next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // serverComponentsExternalPackages tells Next.js not to bundle these on the
  // server — they must be resolved from node_modules at runtime. We list the
  // Prisma query engine packages that contain native binaries; the generated
  // client at src/generated/prisma is a regular TS import and doesn't need
  // externalizing. sharp is listed so it uses the platform binary instead of
  // a bundled WASM fallback.
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: [
      "@prisma/client",
      "@prisma/adapter-pg",
      "sharp",
    ],
    optimizePackageImports: ["lucide-react", "framer-motion"],
    serverActions: {
      allowedOrigins: [
        "spliteasy.info",
        "www.spliteasy.info",
        "localhost:3000",
      ],
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      // Hashed static assets are immutable — cache forever.
      urlPattern: /\/_next\/static\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "next-static",
        expiration: { maxEntries: 200, maxAgeSeconds: 365 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "supabase-cache",
        expiration: { maxEntries: 50, maxAgeSeconds: 3600 },
      },
    },
    {
      // Group detail — show stale instantly, revalidate in background.
      urlPattern: /\/api\/v1\/groups\/[^/]+$/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "api-group-detail",
        expiration: { maxEntries: 30, maxAgeSeconds: 300 },
      },
    },
    {
      urlPattern: /\/api\/v1\/groups$/,
      handler: "StaleWhileRevalidate",
      options: { cacheName: "api-groups" },
    },
    {
      // Expenses list — prefer network but fall back to cache after 3s.
      urlPattern: /\/api\/v1\/groups\/[^/]+\/expenses/,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-expenses",
        networkTimeoutSeconds: 3,
        expiration: { maxEntries: 50, maxAgeSeconds: 300 },
      },
    },
  ],
});

export default pwaConfig(nextConfig);

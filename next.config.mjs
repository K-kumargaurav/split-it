import withPWA from "next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // serverComponentsExternalPackages tells Next.js not to bundle these on the
  // server — they must be resolved from node_modules at runtime. We list the
  // Prisma query engine packages that contain native binaries; the generated
  // client at src/generated/prisma is a regular TS import and doesn't need
  // externalizing. sharp is listed so it uses the platform binary instead of
  // a bundled WASM fallback.
  experimental: {
    serverComponentsExternalPackages: [
      "@prisma/client",
      "@prisma/adapter-pg",
      "sharp",
    ],
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
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "supabase-cache",
        expiration: { maxEntries: 50, maxAgeSeconds: 3600 },
      },
    },
    {
      urlPattern: /\/api\/v1\/groups$/,
      handler: "StaleWhileRevalidate",
      options: { cacheName: "api-groups" },
    },
  ],
});

export default pwaConfig(nextConfig);

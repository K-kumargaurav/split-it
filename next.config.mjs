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

export default nextConfig;

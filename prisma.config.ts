import { defineConfig } from "prisma/config";

export default defineConfig({
  datasources: {
    db: {
      url: process.env.DATABASE_URL!,
      directUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
    },
  },
});

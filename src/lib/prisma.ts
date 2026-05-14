import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

let instance: PrismaClient | undefined = globalForPrisma.prisma;

function getClient(): PrismaClient {
  if (!instance) {
    instance = createPrismaClient();
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = instance;
    }
  }
  return instance;
}

// Proxy defers client creation (and the DATABASE_URL check) until the first
// property access. Importing this module — which happens during `next build`
// page-data collection — no longer touches env or opens a connection.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

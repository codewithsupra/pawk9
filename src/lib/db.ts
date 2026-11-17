import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// A client keeps the data model it was generated from, so a client created before a
// schema change rejects the new fields ("Unknown argument ...") until the process
// restarts. Caching it on globalThis (to survive hot reloads) used to hide a
// regenerated client behind that old one. Keying the cache on every model's fields
// (new models included) means `prisma generate` followed by a reload gives a fresh client.
const modelShape = JSON.stringify(
  Object.entries(Prisma)
    .filter(([name]) => name.endsWith("ScalarFieldEnum"))
    .map(([name, fields]) => [name, Object.keys(fields as object)]),
);

type CachedClient = { shape: string; client: PrismaClient };
const globalForPrisma = globalThis as unknown as { prismaCache?: CachedClient };

function getPrismaClient() {
  const cached = globalForPrisma.prismaCache;
  if (cached?.shape === modelShape) return cached.client;

  void cached?.client.$disconnect();
  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prismaCache = { shape: modelShape, client };
  }
  return client;
}

export const prisma = getPrismaClient();

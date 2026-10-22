import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalDatabase = globalThis as typeof globalThis & { surveyDatabase?: PrismaClient };

export function database() {
  if (globalDatabase.surveyDatabase) return globalDatabase.surveyDatabase;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 10_000 });
  globalDatabase.surveyDatabase = new PrismaClient({ adapter });
  return globalDatabase.surveyDatabase;
}

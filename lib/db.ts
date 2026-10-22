import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveDatabaseUrl } from "./database-url.ts";

const globalDatabase = globalThis as typeof globalThis & { surveyDatabase?: PrismaClient };

export function database() {
  if (globalDatabase.surveyDatabase) return globalDatabase.surveyDatabase;
  const connectionString = resolveDatabaseUrl(process.env, "runtime");
  if (!connectionString) throw new Error("Configure DATABASE_URL, POSTGRES_URL or PRISMA_DATABASE_URL with a PostgreSQL connection URL.");
  const adapter = new PrismaPg({ connectionString, max: 3, connectionTimeoutMillis: 10_000 });
  globalDatabase.surveyDatabase = new PrismaClient({ adapter });
  return globalDatabase.surveyDatabase;
}

export async function disconnectDatabase() {
  if (globalDatabase.surveyDatabase) await globalDatabase.surveyDatabase.$disconnect();
}

type DatabaseEnvironment = {
  [name: string]: string | undefined;
  DIRECT_URL?: string;
  DATABASE_URL?: string;
  POSTGRES_URL?: string;
  PRISMA_DATABASE_URL?: string;
};

export function resolveDatabaseUrl(
  environment: DatabaseEnvironment,
  purpose: "migration" | "runtime",
): string | undefined {
  const names = purpose === "migration"
    ? ["DIRECT_URL", "DATABASE_URL", "POSTGRES_URL", "PRISMA_DATABASE_URL"] as const
    : ["DATABASE_URL", "POSTGRES_URL", "PRISMA_DATABASE_URL", "DIRECT_URL"] as const;
  let proxyConfigured = false;
  for (const name of names) {
    const value = environment[name]?.trim();
    if (!value) continue;
    let url: URL;
    try { url = new URL(value); }
    catch { throw new Error(`${name} must be a valid PostgreSQL connection URL.`); }
    if (url.protocol === "prisma:" || url.protocol === "prisma+postgres:") {
      proxyConfigured = true;
      continue;
    }
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
      throw new Error(`${name} must use postgres:// or postgresql://.`);
    }
    return value;
  }
  if (proxyConfigured) {
    throw new Error("A Prisma proxy URL cannot be used with the PostgreSQL driver. Configure a PostgreSQL connection URL in DATABASE_URL, POSTGRES_URL or PRISMA_DATABASE_URL (or DIRECT_URL for migrations). Copy it from your database provider; do not edit a proxy URL to construct it.");
  }
  return undefined;
}

import { createHash } from "node:crypto";
import { database } from "./db.ts";

export function sameOrigin(request: Request) {
  const origin = process.env.SITE_ORIGIN;
  if (!origin) throw new Error("SITE_ORIGIN is required.");
  return request.headers.get("origin") === origin && request.headers.get("sec-fetch-site") !== "cross-site";
}

export async function consumeQuota(scope: string, limit: number, windowSeconds: number) {
  const window = Math.floor(Date.now() / (windowSeconds * 1000));
  const bucket = await database().requestBucket.upsert({
    where: { key: `${scope}:${window}` },
    create: { key: `${scope}:${window}`, count: 1, expiresAt: new Date((window + 1) * windowSeconds * 1000) },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  return bucket.count <= limit;
}

export function deletionHash(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function logFailure(operation: string, error: unknown) {
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "INTERNAL_ERROR";
  console.error(`[${operation}] Operation failed`, { code });
}

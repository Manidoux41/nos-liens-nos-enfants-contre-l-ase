import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { database } from "./db.ts";

export function validCredentials(email: string, password: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && password.length >= 16 && password.length <= 128;
}

export async function createAdmin(email: string, password: string, actorId: string | null, bootstrap = false) {
  if (!validCredentials(email, password)) throw new Error("Invalid administrator credentials.");
  const passwordHash = await hashPassword(password);
  return database().$transaction(async (transaction) => {
    // A transaction-scoped lock prevents two initial administrators bypassing the bootstrap guard.
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(81370641)`;
    if (bootstrap && await transaction.user.count()) throw new Error("Bootstrap is only allowed for an empty user table.");
    const id = randomUUID();
    await transaction.user.create({
      data: {
        id, name: email, email, role: "admin", active: true,
        accounts: { create: { id: randomUUID(), providerId: "credential", accountId: id, password: passwordHash } },
      },
    });
    await transaction.auditLog.create({ data: { actorId, action: bootstrap ? "ADMIN_BOOTSTRAP" : "ADMIN_CREATE", targetId: id } });
    return id;
  });
}

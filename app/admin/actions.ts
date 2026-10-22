"use server";

import { hashPassword } from "better-auth/crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdmin, validCredentials } from "@/lib/admin-accounts";
import { verifyPassword } from "better-auth/crypto";
import { database } from "@/lib/db";
import { logFailure } from "@/lib/request-security";
import { UUID_PATTERN } from "@/lib/survey";
import { validPetitionUrl } from "@/lib/statistics";

function field(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function mutate(action: string, operation: () => Promise<unknown>) {
  try { await operation(); }
  catch (error) {
    logFailure(`admin-${action}`, error);
    redirect("/admin?error=operation");
  }
  revalidatePath("/admin");
  revalidatePath("/statistiques");
  redirect("/admin?success=1");
}

export async function moderate(data: FormData) {
  const actor = await requireAdmin();
  const id = field(data, "id");
  const decision = field(data, "decision");
  const jurisdictionId = field(data, "jurisdictionId");
  if (!UUID_PATTERN.test(id) || !["APPROVED", "REJECTED", "PENDING", "DELETE"].includes(decision) || (jurisdictionId && !UUID_PATTERN.test(jurisdictionId))) redirect("/admin?error=input");
  await mutate("moderation", () => database().$transaction(async (transaction) => {
    if (decision === "DELETE") await transaction.surveyResponse.delete({ where: { id } });
    else await transaction.surveyResponse.update({
      where: { id },
      data: { status: decision as "APPROVED" | "REJECTED" | "PENDING", jurisdictionId: jurisdictionId || null, moderatedAt: new Date(), moderatedById: actor.id },
    });
    await transaction.auditLog.create({ data: { actorId: actor.id, action: `RESPONSE_${decision}`, targetId: id } });
  }));
}

export async function addJurisdiction(data: FormData) {
  const actor = await requireAdmin();
  const name = field(data, "name").replace(/\s+/g, " ");
  if (name.length < 5 || name.length > 200 || /[<>\u0000-\u001f]/.test(name)) redirect("/admin?error=input");
  await mutate("jurisdiction", () => database().$transaction(async (transaction) => {
    const jurisdiction = await transaction.jurisdiction.create({ data: { name } });
    await transaction.auditLog.create({ data: { actorId: actor.id, action: "JURISDICTION_CREATE", targetId: jurisdiction.id } });
  }));
}

export async function updateJurisdiction(data: FormData) {
  const actor = await requireAdmin();
  const id = field(data, "id");
  const operation = field(data, "operation");
  const name = field(data, "name").replace(/\s+/g, " ");
  if (!UUID_PATTERN.test(id) || !["RENAME", "DELETE"].includes(operation)
    || (operation === "RENAME" && (name.length < 5 || name.length > 200 || /[<>\u0000-\u001f]/.test(name)))) redirect("/admin?error=input");
  await mutate("update-jurisdiction", () => database().$transaction(async (transaction) => {
    if (operation === "DELETE") await transaction.jurisdiction.delete({ where: { id } });
    else await transaction.jurisdiction.update({ where: { id }, data: { name } });
    await transaction.auditLog.create({ data: { actorId: actor.id, action: `JURISDICTION_${operation}`, targetId: id } });
  }));
}

export async function saveSettings(data: FormData) {
  const actor = await requireAdmin();
  const petitionUrl = field(data, "petitionUrl");
  const petitionTitle = field(data, "petitionTitle");
  if (!validPetitionUrl(petitionUrl) || petitionUrl.length > 1000 || petitionTitle.length < 5 || petitionTitle.length > 200) redirect("/admin?error=input");
  await mutate("settings", () => database().$transaction(async (transaction) => {
    const values = { petitionUrl: petitionUrl || null, petitionTitle, statsPublished: data.get("statsPublished") === "on" };
    await transaction.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, ...values }, update: values });
    await transaction.auditLog.create({ data: { actorId: actor.id, action: "SETTINGS_UPDATE" } });
  }));
}

export async function addAdministrator(data: FormData) {
  const actor = await requireAdmin();
  const email = field(data, "email").toLowerCase();
  const password = data.get("password");
  if (typeof password !== "string" || !validCredentials(email, password)) redirect("/admin?error=input");
  await mutate("create-account", () => createAdmin(email, password, actor.id));
}

export async function updateAdministrator(data: FormData) {
  const actor = await requireAdmin();
  const id = field(data, "id");
  const operation = field(data, "operation");
  const password = data.get("password");
  if (!id || id === actor.id || !["DISABLE", "ENABLE", "PASSWORD"].includes(operation)) redirect("/admin?error=input");
  if (operation === "PASSWORD" && (typeof password !== "string" || password.length < 16 || password.length > 128)) redirect("/admin?error=input");
  const passwordHash = operation === "PASSWORD" && typeof password === "string" ? await hashPassword(password) : null;
  await mutate("update-account", () => database().$transaction(async (transaction) => {
    if (passwordHash) await transaction.account.updateMany({ where: { userId: id, providerId: "credential" }, data: { password: passwordHash } });
    else await transaction.user.update({ where: { id }, data: { active: operation === "ENABLE" } });
    await transaction.session.deleteMany({ where: { userId: id } });
    await transaction.auditLog.create({ data: { actorId: actor.id, action: `ADMIN_${operation}`, targetId: id } });
  }));
}

export async function changeOwnPassword(data: FormData) {
  const actor = await requireAdmin();
  const currentPassword = data.get("currentPassword");
  const password = data.get("password");
  if (typeof currentPassword !== "string" || currentPassword.length > 128 || typeof password !== "string"
    || !validCredentials(actor.email, password)) redirect("/admin?error=input");
  const { consumeQuota } = await import("@/lib/request-security");
  if (!(await consumeQuota(`password-change:${actor.id}`, 5, 900))) redirect("/admin?error=operation");
  const account = await database().account.findFirst({ where: { userId: actor.id, providerId: "credential" }, select: { password: true } });
  if (!account?.password || !(await verifyPassword({ hash: account.password, password: currentPassword }))) redirect("/admin?error=input");
  const passwordHash = await hashPassword(password);
  try {
    await database().$transaction([
      database().account.updateMany({ where: { userId: actor.id, providerId: "credential" }, data: { password: passwordHash } }),
      database().session.deleteMany({ where: { userId: actor.id } }),
      database().auditLog.create({ data: { actorId: actor.id, action: "ADMIN_OWN_PASSWORD", targetId: actor.id } }),
    ]);
  } catch (error) {
    logFailure("admin-own-password", error);
    redirect("/admin?error=operation");
  }
  redirect("/admin/connexion");
}

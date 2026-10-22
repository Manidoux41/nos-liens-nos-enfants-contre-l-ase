import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authentication } from "./auth";
import { database } from "./db";

export async function currentAdmin(requestHeaders: Headers) {
  const session = await authentication().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const user = await database().user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, role: true, active: true } });
  return user?.active && user.role === "admin" ? user : null;
}

export async function requireAdmin() {
  const user = await currentAdmin(await headers());
  if (!user) redirect("/admin/connexion");
  return user;
}

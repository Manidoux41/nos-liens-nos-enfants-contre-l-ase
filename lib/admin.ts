import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authentication } from "./auth";
import { database } from "./db";

export async function requireAdmin() {
  const session = await authentication().api.getSession({ headers: await headers() });
  if (!session) redirect("/admin/connexion");
  const user = await database().user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, role: true, active: true } });
  if (!user?.active || user.role !== "admin") redirect("/admin/connexion");
  return user;
}

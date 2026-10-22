"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { database } from "@/lib/db";
import { validSlug, validText } from "@/lib/editorial";
import { UUID_PATTERN } from "@/lib/survey";
import { logFailure } from "@/lib/request-security";

function field(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
}

export async function savePoll(data: FormData) {
  const actor = await requireAdmin();
  const id = field(data, "id");
  const title = field(data, "title");
  const slug = field(data, "slug");
  const description = field(data, "description");
  const status = field(data, "status");
  const version = Number(field(data, "version"));
  if ((id && (!UUID_PATTERN.test(id) || !Number.isSafeInteger(version) || version < 1))
    || !validText(title, 3, 180) || !validSlug(slug, 120) || !validText(description, 10, 2000)
    || !["DRAFT", "PUBLISHED", "CLOSED"].includes(status)) redirect("/admin/sondages?error=input");
  try {
    await database().$transaction(async (tx) => {
      const values = { title, slug, description, status: status as "DRAFT" | "PUBLISHED" | "CLOSED", resultsPublished: data.get("resultsPublished") === "on" };
      const poll = id
        ? await tx.poll.update({ where: { id, version }, data: { ...values, version: { increment: 1 } } })
        : await tx.poll.create({ data: values });
      if (poll.status !== "PUBLISHED") await tx.surveyEmailChallenge.deleteMany({ where: { pollId: poll.id } });
      await tx.auditLog.create({ data: { actorId: actor.id, action: `POLL_${status}`, targetId: poll.id } });
    });
  } catch (error) {
    logFailure("poll-save", error);
    redirect("/admin/sondages?error=operation");
  }
  revalidatePath("/", "layout");
  redirect("/admin/sondages?success=1");
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { requireAdmin } from "@/lib/admin";
import { database } from "@/lib/db";
import { logFailure } from "@/lib/request-security";
import { validSlug, validText } from "@/lib/editorial";
import { UUID_PATTERN } from "@/lib/survey";

function text(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
}

async function mutation(destination: string, operation: () => Promise<unknown>) {
  try { await operation(); }
  catch (error) {
    logFailure("editorial", error);
    redirect(`${destination}?error=operation`);
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/articles", "layout");
  redirect(`${destination}?success=1`);
}

export async function saveArticle(data: FormData) {
  const actor = await requireAdmin();
  const id = text(data, "id");
  const title = text(data, "title");
  const slug = text(data, "slug");
  const excerpt = text(data, "excerpt");
  const content = text(data, "content");
  const categoryId = text(data, "categoryId");
  const status = text(data, "status");
  const version = Number(text(data, "version"));
  const mediaIds = data.getAll("mediaIds");
  const destination = id && UUID_PATTERN.test(id) ? `/admin/articles/${id}` : "/admin/articles/nouveau";
  if ((id && !UUID_PATTERN.test(id)) || !validText(title, 3, 180) || !validSlug(slug, 200)
    || !validText(excerpt, 10, 500) || !validText(content, 20, 100000) || !UUID_PATTERN.test(categoryId)
    || !["DRAFT", "PUBLISHED"].includes(status) || mediaIds.length > 20
    || mediaIds.some((value) => typeof value !== "string" || !UUID_PATTERN.test(value))
    || (id && (!Number.isSafeInteger(version) || version < 1))) redirect(`${destination}?error=input`);
  const selected = [...new Set(mediaIds.filter((value): value is string => typeof value === "string"))];
  let savedId = id;
  try {
    await database().$transaction(async (transaction) => {
      const mediaCount = await transaction.media.count({ where: { id: { in: selected }, deleting: false } });
      if (mediaCount !== selected.length) throw new Error("Some selected media are no longer available.");
      const previous = id ? await transaction.article.findUniqueOrThrow({ where: { id } }) : null;
      if (previous && previous.version !== version) throw new Error("Article version conflict.");
      const values = {
        title, slug, excerpt, content, categoryId, status: status as "DRAFT" | "PUBLISHED",
        publishedAt: status === "PUBLISHED" ? previous?.publishedAt || new Date() : null,
      };
      const article = previous
        ? await transaction.article.update({ where: { id, version }, data: { ...values, version: { increment: 1 } } })
        : await transaction.article.create({ data: values });
      savedId = article.id;
      await transaction.articleMedia.deleteMany({ where: { articleId: article.id } });
      if (selected.length) await transaction.articleMedia.createMany({ data: selected.map((mediaId, position) => ({ articleId: article.id, mediaId, position })) });
      await transaction.auditLog.create({ data: { actorId: actor.id, action: `ARTICLE_${status}`, targetId: article.id } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    logFailure("save-article", error);
    redirect(`${destination}?error=operation`);
  }
  revalidatePath("/articles", "layout");
  revalidatePath("/admin", "layout");
  redirect(`/admin/articles/${savedId}?success=1`);
}

export async function deleteArticle(data: FormData) {
  const actor = await requireAdmin();
  const id = text(data, "id");
  const version = Number(text(data, "version"));
  if (!UUID_PATTERN.test(id) || !Number.isSafeInteger(version) || version < 1 || data.get("confirm") !== "on") redirect("/admin/articles?error=input");
  await mutation("/admin/articles", () => database().$transaction(async (transaction) => {
    await transaction.article.delete({ where: { id, version } });
    await transaction.auditLog.create({ data: { actorId: actor.id, action: "ARTICLE_DELETE", targetId: id } });
  }));
}

export async function saveCategory(data: FormData) {
  const actor = await requireAdmin();
  const id = text(data, "id");
  const name = text(data, "name");
  const slug = text(data, "slug");
  if ((id && !UUID_PATTERN.test(id)) || !validText(name, 2, 100) || !validSlug(slug, 120)) redirect("/admin/categories?error=input");
  await mutation("/admin/categories", () => database().$transaction(async (transaction) => {
    const category = id ? await transaction.category.update({ where: { id }, data: { name, slug } }) : await transaction.category.create({ data: { name, slug } });
    await transaction.auditLog.create({ data: { actorId: actor.id, action: "CATEGORY_SAVE", targetId: category.id } });
  }));
}

export async function deleteCategory(data: FormData) {
  const actor = await requireAdmin();
  const id = text(data, "id");
  if (!UUID_PATTERN.test(id) || data.get("confirm") !== "on") redirect("/admin/categories?error=input");
  await mutation("/admin/categories", () => database().$transaction(async (transaction) => {
    await transaction.category.delete({ where: { id } });
    await transaction.auditLog.create({ data: { actorId: actor.id, action: "CATEGORY_DELETE", targetId: id } });
  }));
}

export async function saveMedia(data: FormData) {
  const actor = await requireAdmin();
  const id = text(data, "id");
  const title = text(data, "title");
  const alt = text(data, "alt");
  const caption = text(data, "caption");
  if (!UUID_PATTERN.test(id) || !validText(title, 2, 180) || !validText(alt, 2, 300) || !validText(caption, 0, 500)) redirect("/admin/medias?error=input");
  await mutation("/admin/medias", () => database().$transaction(async (transaction) => {
    await transaction.media.update({ where: { id, deleting: false }, data: { title, alt, caption } });
    await transaction.auditLog.create({ data: { actorId: actor.id, action: "MEDIA_UPDATE", targetId: id } });
  }));
}

export async function deleteMedia(data: FormData) {
  const actor = await requireAdmin();
  const id = text(data, "id");
  if (!UUID_PATTERN.test(id) || data.get("confirm") !== "on") redirect("/admin/medias?error=input");
  await mutation("/admin/medias", async () => {
    const media = await database().$transaction(async (transaction) => {
      const record = await transaction.media.findUniqueOrThrow({ where: { id }, include: { _count: { select: { articles: true } } } });
      if (record._count.articles) throw new Error("Detach media from articles before deleting.");
      await transaction.media.update({ where: { id }, data: { deleting: true } });
      return record;
    }, { isolationLevel: "Serializable" });
    await del(media.pathname);
    await database().$transaction([
      database().media.delete({ where: { id, deleting: true } }),
      database().auditLog.create({ data: { actorId: actor.id, action: "MEDIA_DELETE", targetId: id } }),
    ]);
  });
}

import { Suspense } from "react";
import { connection } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { database } from "@/lib/db";
import { ArticleEditor } from "../article-editor";
import { Feedback, PageHeading } from "../../editorial-ui";

async function NewArticle({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await connection();
  await requireAdmin();
  const [categories, media, query] = await Promise.all([
    database().category.findMany({ orderBy: { name: "asc" } }),
    database().media.findMany({ where: { deleting: false }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, title: true, mimeType: true } }),
    searchParams,
  ]);
  return <><PageHeading eyebrow="UNE NOUVELLE PAGE À ÉCRIRE" title="Nouvel article." /><Feedback {...query} /><ArticleEditor categories={categories} media={media} selected={[]} /></>;
}

export default function NewArticlePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return <Suspense fallback={<p role="status">Ouverture de l’éditeur…</p>}><NewArticle searchParams={searchParams} /></Suspense>;
}

import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { database } from "@/lib/db";
import { UUID_PATTERN } from "@/lib/survey";
import { ArticleEditor } from "../article-editor";
import { Feedback, PageHeading } from "../../editorial-ui";
import { deleteArticle } from "../../editorial-actions";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> };

async function Editor({ params, searchParams }: Props) {
  await connection();
  await requireAdmin();
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const [article, categories, media, query] = await Promise.all([
    database().article.findUnique({ where: { id }, include: { media: true } }),
    database().category.findMany({ orderBy: { name: "asc" } }),
    database().media.findMany({ where: { deleting: false }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, title: true, mimeType: true } }),
    searchParams,
  ]);
  if (!article) notFound();
  return <><PageHeading eyebrow="VOTRE TEXTE, À VOTRE RYTHME" title="Modifier l’article." /><Feedback {...query} />{article.status === "PUBLISHED" && <Link className="text-link" href={`/articles/${article.slug}`} target="_blank">Voir la version publiée (nouvel onglet) ↗</Link>}<ArticleEditor article={article} categories={categories} media={media} selected={article.media.map((item) => item.mediaId)} /><section className="danger-zone"><h2>Supprimer cet article</h2><p>Le texte sera définitivement supprimé et retiré du journal. Ses médias resteront dans la médiathèque.</p><form action={deleteArticle}><input type="hidden" name="id" value={id} /><input type="hidden" name="version" value={article.version} /><label className="consent-label"><input type="checkbox" name="confirm" required /><span>Je confirme la suppression définitive de « {article.title} ».</span></label><button className="button button-primary">Supprimer définitivement</button></form></section></>;
}

export default function EditorPage(props: Props) {
  return <Suspense fallback={<p role="status">Chargement de l’article…</p>}><Editor {...props} /></Suspense>;
}

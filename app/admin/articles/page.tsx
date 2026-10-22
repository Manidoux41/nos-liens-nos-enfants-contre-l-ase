import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { database } from "@/lib/db";
import { Feedback, PageHeading, Pagination } from "../editorial-ui";
import { UUID_PATTERN } from "@/lib/survey";

type Query = Promise<{ q?: string; status?: string; category?: string; page?: string; error?: string; success?: string }>;

async function Articles({ searchParams }: { searchParams: Query }) {
  await connection();
  await requireAdmin();
  const query = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(query.page || "1", 10) || 1));
  const status: "PUBLISHED" | "DRAFT" | undefined = query.status === "PUBLISHED" || query.status === "DRAFT" ? query.status : undefined;
  const categoryId = query.category && UUID_PATTERN.test(query.category) ? query.category : undefined;
  const q = (query.q || "").slice(0, 180);
  const where = { status, categoryId, ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}) };
  const [articles, total, categories] = await Promise.all([
    database().article.findMany({ where, include: { category: true, _count: { select: { media: true } } }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20 }),
    database().article.count({ where }),
    database().category.findMany({ orderBy: { name: "asc" } }),
  ]);
  const params = new URLSearchParams({ q, ...(status ? { status } : {}), ...(categoryId ? { category: categoryId } : {}) });
  return <><PageHeading eyebrow="RÉDIGER, ORGANISER, PUBLIER" title="Vos articles." href="/admin/articles/nouveau" action="+ Nouvel article" /><Feedback {...query} /><form className="editorial-filters"><label>Rechercher<input name="q" maxLength={180} defaultValue={q} placeholder="Un titre…" /></label><label>Statut<select name="status" defaultValue={status || ""}><option value="">Tous les statuts</option><option value="DRAFT">Brouillons</option><option value="PUBLISHED">Publiés</option></select></label><label>Catégorie<select name="category" defaultValue={categoryId || ""}><option value="">Toutes les catégories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><button className="button button-small">Filtrer</button></form>
    <div className="dashboard-panel">{!articles.length && <div className="empty-state"><h2>Aucun article à afficher.</h2><p>Modifiez vos filtres ou commencez un nouveau brouillon.</p></div>}{articles.map((article) => <div className="article-admin-row" key={article.id}><div><Link href={`/admin/articles/${article.id}`}><strong>{article.title}</strong></Link><span>{article.category.name} · {article._count.media} média(s) · {article.updatedAt.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}</span></div><span className={`status-pill ${article.status === "PUBLISHED" ? "published" : ""}`}>{article.status === "PUBLISHED" ? "Publié" : "Brouillon"}</span><Link className="text-link" href={`/admin/articles/${article.id}`}>Modifier →</Link></div>)}</div><Pagination page={page} total={total} href={`/admin/articles?${params}&`} /></>;
}

export default function ArticlesPage({ searchParams }: { searchParams: Query }) {
  return <Suspense fallback={<p role="status">Chargement des articles…</p>}><Articles searchParams={searchParams} /></Suspense>;
}

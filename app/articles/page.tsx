import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Header } from "../components/navigation";
import { database } from "@/lib/db";
import { logFailure } from "@/lib/request-security";

export const metadata: Metadata = { title: "Le journal — Histoires & ressources" };
type Query = Promise<{ categorie?: string; page?: string }>;

async function Journal({ searchParams }: { searchParams: Query }) {
  await connection();
  const query = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(query.page || "1", 10) || 1));
  let result;
  try {
    const where = { status: "PUBLISHED" as const, ...(query.categorie ? { category: { slug: query.categorie.slice(0, 120) } } : {}) };
    const [articles, categories, total] = await Promise.all([
      database().article.findMany({ where, select: { id: true, title: true, slug: true, excerpt: true, publishedAt: true, category: { select: { name: true } } }, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], skip: (page - 1) * 12, take: 12 }),
      database().category.findMany({ where: { articles: { some: { status: "PUBLISHED" } } }, select: { name: true, slug: true }, orderBy: { name: "asc" } }),
      database().article.count({ where }),
    ]);
    result = { articles, categories, total };
  } catch (error) {
    logFailure("journal", error);
    return <p role="alert" className="form-error">Le journal est momentanément indisponible. Réessayez plus tard.</p>;
  }
  return <><nav className="category-links" aria-label="Filtrer les articles par catégorie"><Link href="/articles" aria-current={!query.categorie ? "page" : undefined}>Tout le journal</Link>{result.categories.map((category) => <Link href={`/articles?categorie=${encodeURIComponent(category.slug)}`} key={category.slug} aria-current={category.slug === query.categorie ? "page" : undefined}>{category.name}</Link>)}</nav>
    <div className="journal-grid">{result.articles.map((article) => <Link className="journal-card" href={`/articles/${article.slug}`} key={article.id}><p className="eyebrow">{article.category.name}</p><h2>{article.title}</h2><p>{article.excerpt}</p><span className="text-link">Lire l’article →</span></Link>)}</div>{!result.articles.length && <div className="empty-state"><h2>Une nouvelle page se prépare.</h2><p>Aucun article publié pour cette sélection pour le moment.</p></div>}<nav className="admin-pagination" aria-label="Pagination du journal">{page > 1 && <Link href={`/articles?categorie=${encodeURIComponent(query.categorie || "")}&page=${page - 1}`}>← Précédent</Link>}<span>Page {page}</span>{page * 12 < result.total && <Link href={`/articles?categorie=${encodeURIComponent(query.categorie || "")}&page=${page + 1}`}>Suivant →</Link>}</nav></>;
}

export default function JournalPage({ searchParams }: { searchParams: Query }) {
  return <><Header /><main id="contenu" className="section-width section-space"><p className="eyebrow">HISTOIRES, ÉCLAIRAGES & RESSOURCES</p><h1>Notre parole,<br /><em>au fil des pages.</em></h1><Suspense fallback={<p role="status">Chargement du journal…</p>}><Journal searchParams={searchParams} /></Suspense></main></>;
}

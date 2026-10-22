import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { database } from "@/lib/db";
import { Header } from "../../components/navigation";
import { logFailure } from "@/lib/request-security";

async function PublishedArticle({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  let article;
  try {
    article = await database().article.findUnique({
      where: { slug, status: "PUBLISHED" },
      select: {
        title: true, excerpt: true, content: true, publishedAt: true,
        category: { select: { name: true, slug: true } },
        media: { where: { media: { deleting: false } }, orderBy: { position: "asc" }, select: { media: { select: { id: true, title: true, alt: true, caption: true, mimeType: true } } } },
      },
    });
  } catch (error) {
    logFailure("published-article", error);
    return <p role="alert" className="form-error">Cet article est momentanément indisponible. Réessayez plus tard.</p>;
  }
  if (!article) notFound();
  return <article className="published-article"><Link className="text-link" href="/articles">← Tout le journal</Link><p className="eyebrow">{article.category.name}{article.publishedAt ? ` · ${article.publishedAt.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}` : ""}</p><h1>{article.title}</h1><p className="privacy-lead">{article.excerpt}</p><div className="article-body">{article.content.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>{article.media.length > 0 && <section className="article-attachments" aria-label="Médias de l’article">{article.media.map(({ media }) => <figure key={media.id}>{media.mimeType === "application/pdf" ? <a className="button" href={`/medias/${media.id}`} target="_blank" rel="noopener noreferrer">Télécharger : {media.title} (PDF, nouvel onglet) ↗</a> :
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={`/medias/${media.id}`} alt={media.alt} loading="lazy" />}<figcaption>{media.caption || media.title}</figcaption></figure>)}</section>}<Link className="text-link" href={`/articles?categorie=${encodeURIComponent(article.category.slug)}`}>Tous les articles : {article.category.name} →</Link></article>;
}

export default function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  return <><Header /><main id="contenu" className="section-width privacy-page"><Suspense fallback={<p role="status">Chargement de l’article…</p>}><PublishedArticle params={params} /></Suspense></main></>;
}

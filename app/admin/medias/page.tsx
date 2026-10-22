import { Suspense } from "react";
import { connection } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { database } from "@/lib/db";
import { saveMedia, deleteMedia } from "../editorial-actions";
import { Feedback, PageHeading, Pagination } from "../editorial-ui";
import { UploadForm } from "./upload-form";

type Query = Promise<{ page?: string; error?: string; success?: string }>;

async function MediaLibrary({ searchParams }: { searchParams: Query }) {
  await connection();
  await requireAdmin();
  const query = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(query.page || "1", 10) || 1));
  const [media, total] = await Promise.all([
    database().media.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20, include: { articles: { select: { article: { select: { title: true, id: true, status: true } } } } } }),
    database().media.count(),
  ]);
  return <><PageHeading eyebrow="DES IMAGES ET DES DOCUMENTS QUI DONNENT DU SENS" title="Votre médiathèque." /><Feedback {...query} /><section className="dashboard-panel"><h2>Importer un média</h2><UploadForm configured={Boolean(process.env.BLOB_READ_WRITE_TOKEN)} /></section><div className="notice">Les fichiers restent privés tant qu’aucun article publié ne les utilise. Un média partagé entre plusieurs articles reste public si au moins un de ces articles est publié. Une copie déjà téléchargée ne peut pas être rappelée.</div>
    {!media.length && <div className="empty-state"><h2>Votre bibliothèque attend ses premiers médias.</h2><p>Importez une image ou un document puis donnez-lui un titre et une description.</p></div>}
    <div className="media-grid">{media.map((medium) => <article key={medium.id} className="dashboard-panel media-card">
      <div className="media-preview">{medium.deleting ? <p>Suppression à terminer</p> : medium.mimeType === "application/pdf" ? <a href={`/medias/${medium.id}`} target="_blank" rel="noopener noreferrer">PDF · Ouvrir le document ↗</a> :
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={`/medias/${medium.id}`} alt={medium.alt} loading="lazy" />}
      </div><span className={`status-pill ${medium.articles.some((link) => link.article.status === "PUBLISHED") ? "published" : ""}`}>{medium.articles.some((link) => link.article.status === "PUBLISHED") ? "Lié à un article public" : "Privé"}</span><p className="field-help">{medium.mimeType} · {(medium.size / 1024).toFixed(0)} Ko · {medium.articles.length} article(s)</p>
      {!medium.deleting && <form action={saveMedia}><input type="hidden" name="id" value={medium.id} /><label className="field-label" htmlFor={`title-${medium.id}`}>Titre du média *</label><input id={`title-${medium.id}`} name="title" defaultValue={medium.title} minLength={2} maxLength={180} required /><label className="field-label" htmlFor={`alt-${medium.id}`}>Description accessible *</label><input id={`alt-${medium.id}`} name="alt" defaultValue={medium.alt} minLength={2} maxLength={300} required /><label className="field-label" htmlFor={`caption-${medium.id}`}>Légende / crédit</label><textarea id={`caption-${medium.id}`} name="caption" defaultValue={medium.caption} maxLength={500} rows={2} /><button className="button button-small">Enregistrer les informations</button></form>}
      {medium.articles.length ? <div className="field-help">Pour supprimer le fichier, détachez-le d’abord de tous ses articles :<ul>{medium.articles.map(({ article }) => <li key={article.id}><a href={`/admin/articles/${article.id}`}>{article.title}</a></li>)}</ul></div> : <details><summary>{medium.deleting ? "Réessayer la suppression" : "Supprimer le fichier"}</summary><form action={deleteMedia}><input type="hidden" name="id" value={medium.id} /><label className="consent-label"><input type="checkbox" name="confirm" required /><span>Supprimer définitivement ce média de la base et du stockage Blob.</span></label><button className="button button-small button-primary">Confirmer la suppression</button></form></details>}
    </article>)}</div><Pagination page={page} total={total} href="/admin/medias?" /></>;
}

export default function MediaPage({ searchParams }: { searchParams: Query }) {
  return <Suspense fallback={<p role="status">Chargement de la médiathèque…</p>}><MediaLibrary searchParams={searchParams} /></Suspense>;
}

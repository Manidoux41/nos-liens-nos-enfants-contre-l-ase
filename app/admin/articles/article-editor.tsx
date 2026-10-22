"use client";

import { useState } from "react";
import Link from "next/link";
import type { Article, Category } from "@prisma/client";
import { useFormStatus } from "react-dom";
import { slugify } from "@/lib/editorial";
import { saveArticle } from "../editorial-actions";

type Medium = { id: string; title: string; mimeType: string };

function SaveButtons() {
  const { pending } = useFormStatus();
  return <div className="editor-save-bar"><button className="button" type="submit" name="status" value="DRAFT" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer en brouillon / dépublier"}</button><button className="button button-primary" type="submit" name="status" value="PUBLISHED" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer et publier"}</button></div>;
}

export function ArticleEditor({ article, categories, media, selected }: { article?: Article; categories: Category[]; media: Medium[]; selected: string[] }) {
  const [title, setTitle] = useState(article?.title || "");
  const [slug, setSlug] = useState(article?.slug || "");
  const [customSlug, setCustomSlug] = useState(Boolean(article));
  return <form action={saveArticle} className="article-editor">
    <input type="hidden" name="id" value={article?.id || ""} /><input type="hidden" name="version" value={article?.version || ""} />
    <div className="dashboard-columns"><section className="dashboard-panel"><label className="field-label" htmlFor="article-title">Titre *</label><input id="article-title" name="title" minLength={3} maxLength={180} required value={title} onChange={(event) => { setTitle(event.target.value); if (!customSlug) setSlug(slugify(event.target.value)); }} placeholder="Une histoire à faire entendre…" /><label className="field-label" htmlFor="article-slug">Adresse de l’article *</label><div className="slug-field"><span>/articles/</span><input id="article-slug" name="slug" value={slug} onChange={(event) => { setCustomSlug(true); setSlug(event.target.value); }} pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={2} maxLength={200} required /></div><p className="field-help">Lettres minuscules sans accents, chiffres et tirets. Une modification change l’adresse publique.</p>
    <label className="field-label" htmlFor="article-excerpt">Résumé *</label><textarea id="article-excerpt" name="excerpt" defaultValue={article?.excerpt} minLength={10} maxLength={500} rows={3} required placeholder="Quelques lignes pour donner envie de lire." /><label className="field-label" htmlFor="article-content">Votre article *</label><textarea id="article-content" className="content-editor" name="content" defaultValue={article?.content} minLength={20} maxLength={100000} rows={20} required placeholder="Rédigez votre texte. Une ligne vide sépare les paragraphes." /><p className="field-help">Texte simple, sans HTML : les paragraphes sont conservés. Aucun nom d’enfant, document de procédure ou accusation non étayée ne doit être publié.</p></section>
    <aside className="dashboard-panel"><h2>Préparer la publication</h2><span className={`status-pill ${article?.status === "PUBLISHED" ? "published" : ""}`}>{article?.status === "PUBLISHED" ? "Actuellement publié" : "Brouillon privé"}</span><label className="field-label" htmlFor="article-category">Catégorie *</label><select id="article-category" name="categoryId" required defaultValue={article?.categoryId || ""}><option value="" disabled>Choisir une catégorie</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><Link href="/admin/categories" target="_blank" className="text-link">Gérer les catégories (nouvel onglet) ↗</Link>
    <h3 className="editor-media-title">Médias liés</h3><p className="field-help">Jusqu’à 20 médias, affichés dans l’ordre de cette liste (plus récents d’abord). Un média devient public dès qu’un article publié y est lié.</p><div className="media-selector">{media.map((medium) => <label key={medium.id}><input type="checkbox" name="mediaIds" value={medium.id} defaultChecked={selected.includes(medium.id)} /><span>{medium.title}<small>{medium.mimeType === "application/pdf" ? "Document PDF" : "Image"}</small></span></label>)}</div>{!media.length && <p className="field-help">Votre médiathèque est encore vide.</p>}<Link href="/admin/medias" target="_blank" className="text-link">Importer un média (nouvel onglet) ↗</Link><p className="field-help">Après un import dans l’autre onglet, enregistrez votre brouillon puis rechargez l’éditeur pour actualiser les choix.</p>
    <div className="notice">Avant de publier, vérifiez le texte, les droits sur les médias et les informations personnelles.</div></aside></div><SaveButtons />
  </form>;
}

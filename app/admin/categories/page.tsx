import { Suspense } from "react";
import { connection } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { database } from "@/lib/db";
import { saveCategory, deleteCategory } from "../editorial-actions";
import { Feedback, PageHeading } from "../editorial-ui";

async function Categories({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  await connection();
  await requireAdmin();
  const [categories, query] = await Promise.all([database().category.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { articles: true } } } }), searchParams]);
  return <><PageHeading eyebrow="DONNER DES REPÈRES À VOS LECTEURS" title="Vos catégories." /><Feedback {...query} /><div className="dashboard-columns"><section className="dashboard-panel"><h2>Catégories existantes</h2>{!categories.length && <p>Ajoutez votre première catégorie pour pouvoir rédiger un article.</p>}{categories.map((category) => <div key={category.id} className="category-editor"><form action={saveCategory}><input type="hidden" name="id" value={category.id} /><label className="field-label" htmlFor={`name-${category.id}`}>Nom</label><input id={`name-${category.id}`} name="name" defaultValue={category.name} minLength={2} maxLength={100} required /><label className="field-label" htmlFor={`slug-${category.id}`}>Identifiant de filtre</label><input id={`slug-${category.id}`} name="slug" defaultValue={category.slug} minLength={2} maxLength={120} pattern="[a-z0-9]+(-[a-z0-9]+)*" required /><p className="field-help">{category._count.articles} article(s) associé(s)</p><button className="button button-small">Enregistrer les modifications</button></form>{category._count.articles ? <p className="field-help">Pour supprimer cette catégorie, réaffectez ou supprimez d’abord ses articles.</p> : <details><summary>Supprimer cette catégorie</summary><form action={deleteCategory}><input type="hidden" name="id" value={category.id} /><label className="consent-label"><input type="checkbox" name="confirm" required /><span>Je confirme la suppression.</span></label><button className="button button-small button-primary">Supprimer</button></form></details>}</div>)}</section><aside className="dashboard-panel"><h2>Nouvelle catégorie</h2><form action={saveCategory}><label className="field-label" htmlFor="category-name">Nom *</label><input id="category-name" name="name" minLength={2} maxLength={100} required placeholder="Témoignages" /><label className="field-label" htmlFor="category-slug">Identifiant de filtre *</label><input id="category-slug" name="slug" minLength={2} maxLength={120} pattern="[a-z0-9]+(-[a-z0-9]+)*" required placeholder="temoignages" /><p className="field-help">Lettres minuscules sans accents, chiffres et tirets.</p><button className="button button-primary">Créer la catégorie</button></form></aside></div></>;
}

export default function CategoriesPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  return <Suspense fallback={<p role="status">Chargement des catégories…</p>}><Categories searchParams={searchParams} /></Suspense>;
}

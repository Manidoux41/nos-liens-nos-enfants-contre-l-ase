import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { database } from "@/lib/db";
import { LogoutButton } from "./logout-button";
async function Dashboard() {
  await connection();
  const actor = await requireAdmin();
  const db = database();
  const [drafts, published, media, pending, articles] = await Promise.all([
    db.article.count({ where: { status: "DRAFT" } }),
    db.article.count({ where: { status: "PUBLISHED" } }),
    db.media.count({ where: { deleting: false } }),
    db.surveyResponse.count({ where: { status: "PENDING", expiresAt: { gt: new Date() } } }),
    db.article.findMany({ take: 5, orderBy: { updatedAt: "desc" }, include: { category: true } }),
  ]);
  return <><div className="admin-heading"><div><p className="eyebrow">VOTRE ESPACE ÉDITORIAL</p><h1>Bonjour, <em>{actor.name.split("@")[0]}.</em></h1><p>Connecté : {actor.email}</p><p>Vos histoires, vos ressources et votre mobilisation, au même endroit.</p></div><LogoutButton /></div>
    <div className="dashboard-stats">{[
      [drafts, "Brouillons à préparer", "/admin/articles?status=DRAFT"],
      [published, "Articles en ligne", "/admin/articles?status=PUBLISHED"],
      [media, "Médias disponibles", "/admin/medias"],
      [pending, "Réponses à modérer", "/admin/sondage"],
    ].map(([count, label, url]) => <Link key={String(label)} href={String(url)}><strong>{count}</strong><span>{label} ↗</span></Link>)}</div>
    <div className="dashboard-columns"><section className="dashboard-panel"><div className="panel-heading"><h2>Vos derniers articles</h2><Link href="/admin/articles/nouveau" className="button button-primary button-small">+ Nouvel article</Link></div>{!articles.length ? <div className="empty-state"><h3>La prochaine histoire commence ici.</h3><p>Créez une catégorie, rédigez un brouillon et associez vos médias avant de publier.</p><Link className="text-link" href="/admin/categories">Créer ma première catégorie →</Link></div> : articles.map((article) => <Link className="article-admin-row" key={article.id} href={`/admin/articles/${article.id}`}><div><strong>{article.title}</strong><span>{article.category.name} · Modifié le {article.updatedAt.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}</span></div><span className={`status-pill ${article.status === "PUBLISHED" ? "published" : ""}`}>{article.status === "PUBLISHED" ? "Publié" : "Brouillon"}</span></Link>)}</section>
      <aside className="dashboard-panel"><p className="eyebrow">VOTRE FIL CONDUCTEUR</p><h2>De l’idée<br /><em>à la publication.</em></h2><ol className="editorial-steps"><li><Link href="/admin/categories">Organiser les catégories</Link><p>Des repères pour aider vos lecteurs.</p></li><li><Link href="/admin/medias">Préparer les médias</Link><p>Images et PDF privés jusqu’à leur publication.</p></li><li><Link href="/admin/articles/nouveau">Rédiger et relire</Link><p>Enregistrez un brouillon, puis publiez quand vous êtes prêt.</p></li></ol><Link className="text-link" href="/articles">Voir le journal public ↗</Link></aside></div>
  </>;
}

export default function AdminPage() {
  return <Suspense fallback={<p role="status">Chargement de votre tableau de bord…</p>}><Dashboard /></Suspense>;
}

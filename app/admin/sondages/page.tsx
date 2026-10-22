import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { database } from "@/lib/db";
import { savePoll } from "./actions";
import { Feedback, PageHeading } from "../editorial-ui";

type Query = Promise<{ error?: string; success?: string }>;

function PollFields({ poll }: { poll?: { id: string; title: string; slug: string; description: string; status: string; resultsPublished: boolean; version: number } }) {
  const prefix = poll?.id || "new";
  return <form action={savePoll}><input type="hidden" name="id" value={poll?.id || ""} /><input type="hidden" name="version" value={poll?.version || ""} />
    <label className="field-label" htmlFor={`poll-title-${prefix}`}>Titre *</label><input id={`poll-title-${prefix}`} name="title" minLength={3} maxLength={180} required defaultValue={poll?.title} />
    <label className="field-label" htmlFor={`poll-slug-${prefix}`}>Adresse : /sondages/… *</label><input id={`poll-slug-${prefix}`} name="slug" minLength={2} maxLength={120} pattern="[a-z0-9]+(-[a-z0-9]+)*" required defaultValue={poll?.slug} placeholder="enquete-familles-2027" />
    <label className="field-label" htmlFor={`poll-description-${prefix}`}>Présentation *</label><textarea id={`poll-description-${prefix}`} name="description" minLength={10} maxLength={2000} required rows={4} defaultValue={poll?.description} />
    <label className="field-label" htmlFor={`poll-status-${prefix}`}>Statut</label><select id={`poll-status-${prefix}`} name="status" defaultValue={poll?.status || "DRAFT"}><option value="DRAFT">Brouillon — non public</option><option value="PUBLISHED">Publié — réponses ouvertes</option><option value="CLOSED">Clôturé — aucune nouvelle réponse</option></select>
    <label className="consent-label"><input type="checkbox" name="resultsPublished" defaultChecked={poll?.resultsPublished || false} /><span>Autoriser les résultats publics de ce sondage (publication générale également requise ; dix réponses approuvées minimum par groupe).</span></label>
    <button className="button button-primary">{poll ? "Enregistrer le sondage" : "Créer le sondage"}</button>
  </form>;
}

async function PollManager({ searchParams }: { searchParams: Query }) {
  await connection();
  await requireAdmin();
  const [polls, query] = await Promise.all([
    database().poll.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { responses: true } } } }), searchParams,
  ]);
  const emailConfigured = !!process.env.RESEND_API_KEY && !!process.env.SURVEY_EMAIL_FROM && (process.env.SURVEY_EMAIL_SECRET?.length || 0) >= 32;
  return <><PageHeading eyebrow="DES COLLECTES DISTINCTES, UN MÊME QUESTIONNAIRE" title="Vos sondages." /><Feedback {...query} />
    {!emailConfigured && <p className="form-error" role="alert">La vérification e-mail n’est pas configurée : définissez RESEND_API_KEY, SURVEY_EMAIL_FROM (expéditeur vérifié dans Resend) et SURVEY_EMAIL_SECRET (clé dédiée stable d’au moins 32 caractères), puis redéployez. Tant que cette configuration manque, les visiteurs ne peuvent pas envoyer de réponse.</p>}
    <div className="notice"><p>Chaque nouveau sondage reprend les questions actuelles : départements, année de placement, retour au foyer et précisions privées. Seuls le titre et la présentation changent. Aucune réponse n’est copiée. Une même adresse vérifiée peut répondre une fois à chacun.</p><p>Un brouillon est invisible. La clôture invalide les codes en attente et bloque les envois, même depuis un ancien onglet. Les résultats restent séparés par sondage. Les anciennes réponses sans e-mail restent conservées ; leur dédoublonnage rétroactif est impossible.</p><Link href="/sondages" className="text-link">Voir les sondages publics →</Link></div>
    <div className="dashboard-columns"><section className="dashboard-panel"><h2>Sondages existants</h2>{polls.map((poll) => <details key={poll.id} className="category-editor" open={polls.length === 1}><summary>{poll.title} · {poll.status === "DRAFT" ? "Brouillon" : poll.status === "CLOSED" ? "Clôturé" : "Publié"} · {poll._count.responses} réponse(s)</summary><PollFields poll={poll} /><p><Link className="text-link" href={`/admin/sondage?poll=${poll.id}`}>Modérer les réponses →</Link></p>{poll.status !== "DRAFT" && <Link className="text-link" href={`/sondages/${poll.slug}`}>Ouvrir la page publique →</Link>}</details>)}</section>
      <aside className="dashboard-panel"><h2>Nouveau sondage</h2><p>Choisissez un titre et une présentation, puis conservez le brouillon jusqu’à sa publication.</p><PollFields /></aside></div>
  </>;
}

export default function PollManagerPage({ searchParams }: { searchParams: Query }) {
  return <Suspense fallback={<p role="status">Chargement des sondages…</p>}><PollManager searchParams={searchParams} /></Suspense>;
}

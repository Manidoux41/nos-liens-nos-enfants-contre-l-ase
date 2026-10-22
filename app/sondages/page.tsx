import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { database } from "@/lib/db";
import { logFailure } from "@/lib/request-security";
import { Header } from "../components/navigation";

export const metadata: Metadata = { title: "Les sondages citoyens" };

async function PollList() {
  await connection();
  let polls;
  try {
    polls = await database().poll.findMany({ where: { status: { in: ["PUBLISHED", "CLOSED"] } }, select: { id: true, slug: true, title: true, description: true, status: true }, orderBy: { createdAt: "desc" } });
  } catch (error) {
    logFailure("poll-list", error);
    return <p className="form-error" role="alert">Les sondages sont momentanément indisponibles.</p>;
  }
  return <div className="journal-grid">{!polls.length && <p>Aucun sondage publié pour le moment.</p>}{polls.map((poll) => <Link className="journal-card" href={`/sondages/${poll.slug}`} key={poll.id}><span className="eyebrow">{poll.status === "PUBLISHED" ? "PARTICIPATION OUVERTE" : "SONDAGE CLÔTURÉ"}</span><h2>{poll.title}</h2><p>{poll.description}</p><span className="text-link">{poll.status === "PUBLISHED" ? "Participer et voir les résultats" : "Consulter les résultats"} →</span></Link>)}</div>;
}

export default function PollsPage() {
  return <><Header /><main id="contenu" className="section-width section-space"><h1>Les sondages <em>citoyens.</em></h1><p>Une adresse vérifiée, une réponse par sondage. Chaque collecte et ses résultats sont distincts.</p><Suspense fallback={<p role="status">Chargement des sondages…</p>}><PollList /></Suspense></main></>;
}

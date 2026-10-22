import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { database } from "@/lib/db";
import { Header } from "../../components/navigation";
import { Survey } from "../../components/survey";
import { SurveyResults } from "../../components/survey-results";
import { logFailure } from "@/lib/request-security";

async function PollContent({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  let poll;
  try {
    poll = await database().poll.findUnique({ where: { slug, status: { in: ["PUBLISHED", "CLOSED"] } }, select: { id: true, title: true, description: true, status: true } });
  } catch (error) {
    logFailure("poll-read", error);
    return <p className="form-error" role="alert">Ce sondage est momentanément indisponible.</p>;
  }
  if (!poll) notFound();
  return <><Link className="text-link" href="/sondages">← Tous les sondages</Link><h1>{poll.title}</h1><p className="privacy-lead">{poll.description}</p>
    {poll.status === "PUBLISHED" ? <div className="standalone-survey"><Survey pollId={poll.id} /></div> : <p className="notice">Ce sondage est clôturé. Aucune nouvelle réponse n’est acceptée.</p>}
    <h2>Les résultats de ce sondage</h2><SurveyResults pollId={poll.id} />
  </>;
}

export default function PollPage({ params }: { params: Promise<{ slug: string }> }) {
  return <><Header /><main id="contenu" className="section-width section-space"><Suspense fallback={<p role="status">Chargement du sondage…</p>}><PollContent params={params} /></Suspense></main></>;
}

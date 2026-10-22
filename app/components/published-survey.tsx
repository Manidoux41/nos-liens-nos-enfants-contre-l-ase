import { connection } from "next/server";
import Link from "next/link";
import { database } from "@/lib/db";
import { DEFAULT_POLL_ID } from "@/lib/polls";
import { logFailure } from "@/lib/request-security";
import { Survey } from "./survey";

export async function PublishedSurvey() {
  await connection();
  let poll;
  try {
    poll = await database().poll.findUnique({ where: { id: DEFAULT_POLL_ID }, select: { id: true, title: true, description: true, status: true } });
  } catch (error) {
    logFailure("default-poll", error);
    return <p role="alert" className="form-error">Le sondage est momentanément indisponible. Aucun envoi n’est possible pour le moment.</p>;
  }
  if (!poll || poll.status !== "PUBLISHED") return <div className="notice"><p>Ce sondage n’accepte pas de nouvelles réponses.</p><Link href="/sondages" className="text-link">Consulter les sondages →</Link></div>;
  return <div><h3>{poll.title}</h3><p>{poll.description}</p><Survey pollId={poll.id} /></div>;
}

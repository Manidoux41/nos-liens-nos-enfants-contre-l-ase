import { createHmac, randomInt, randomUUID } from "node:crypto";
import { database } from "./db.ts";
import { consumeQuota, logFailure } from "./request-security.ts";
import { normalizeSurveyEmail, SurveyError } from "./polls.ts";

export function surveyDigest(value: string) {
  const secret = process.env.SURVEY_EMAIL_SECRET;
  if (!secret || secret.length < 32) throw new Error("SURVEY_EMAIL_SECRET must contain at least 32 characters.");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function surveyEmailHash(email: string, pollId: string) {
  const normalized = normalizeSurveyEmail(email);
  if (!normalized) throw new SurveyError(400, "Indiquez une adresse e-mail valide.");
  return surveyDigest(`email:${pollId}:${normalized}`);
}

export async function sendSurveyCode(email: string, code: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.SURVEY_EMAIL_FROM;
  if (!key || !from) throw new SurveyError(503, "La vérification par e-mail n’est pas configurée. Réessayez lorsque le service d’envoi sera disponible.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to: [email], subject: "Votre code de participation au sondage",
      text: `Votre code de vérification : ${code}\n\nIl expire dans 10 minutes et permet d’envoyer une seule réponse au sondage demandé. Ne le partagez pas.\nSi vous n’avez rien demandé, ignorez ce message. Votre adresse ne sera pas utilisée pour une newsletter.`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new SurveyError(503, "Le service d’e-mail n’a pas accepté l’envoi. Réessayez plus tard.");
  const confirmation: unknown = await response.json();
  if (!confirmation || typeof confirmation !== "object" || !("id" in confirmation) || typeof confirmation.id !== "string" || !confirmation.id) {
    throw new SurveyError(503, "Le service d’e-mail n’a pas confirmé l’envoi. Réessayez plus tard.");
  }
}

export async function requestSurveyCode(email: string, pollId: string) {
  const hash = surveyEmailHash(email, pollId);
  if (!process.env.RESEND_API_KEY || !process.env.SURVEY_EMAIL_FROM) throw new SurveyError(503, "La vérification par e-mail n’est pas configurée.");
  const allowed = await Promise.all([
    consumeQuota(`survey-mail-address:${hash}`, 1, 60),
    consumeQuota(`survey-mail-hour:${hash}`, 5, 3600),
    consumeQuota("survey-mail-global", 50, 3600),
  ]);
  if (allowed.some((value) => !value)) throw new SurveyError(429, "Trop de demandes de code. Patientez avant de réessayer.");
  const id = randomUUID();
  const code = String(randomInt(0, 100000000)).padStart(8, "0");
  const data = { id, codeHash: surveyDigest(`code:${id}:${code}`), attempts: 0, expiresAt: new Date(Date.now() + 10 * 60_000) };
  await database().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Poll" WHERE id = ${pollId}::uuid FOR SHARE`;
    const poll = await tx.poll.findUnique({ where: { id: pollId }, select: { status: true } });
    if (!poll || poll.status !== "PUBLISHED") throw new SurveyError(409, "Ce sondage n’accepte pas de participation.");
    await tx.surveyEmailChallenge.upsert({
      where: { pollId_emailHash: { pollId, emailHash: hash } },
      create: { ...data, pollId, emailHash: hash }, update: data,
    });
  });
  try { await sendSurveyCode(email, code); }
  catch (error) {
    try { await database().surveyEmailChallenge.deleteMany({ where: { id } }); }
    catch (cleanupError) { logFailure("survey-code-cleanup", cleanupError); }
    throw error;
  }
  return id;
}

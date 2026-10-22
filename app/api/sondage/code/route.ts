import { readJsonBody } from "@/lib/json-body";
import { normalizeSurveyEmail, SurveyError } from "@/lib/polls";
import { requestSurveyCode } from "@/lib/survey-email";
import { UUID_PATTERN } from "@/lib/survey";
import { consumeQuota, sameOrigin, logFailure } from "@/lib/request-security";

const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403, headers });
    if (!(await consumeQuota("survey-code-requests", 100, 60))) return Response.json({ error: "Trop de demandes. Réessayez plus tard." }, { status: 429, headers });
    let body: unknown;
    try { body = await readJsonBody(request, 1024); }
    catch (error) {
      const status = error instanceof Error && error.message === "TOO_LARGE" ? 413 : error instanceof Error && error.message === "CONTENT_TYPE" ? 415 : 400;
      return Response.json({ error: "Requête JSON invalide, de type incorrect ou trop volumineuse." }, { status, headers });
    }
    if (!body || typeof body !== "object" || !("email" in body) || !("pollId" in body)
      || Object.keys(body).sort().join(",") !== "email,pollId"
      || typeof body.pollId !== "string" || !UUID_PATTERN.test(body.pollId)) {
      return Response.json({ error: "Adresse ou sondage invalide." }, { status: 400, headers });
    }
    const email = normalizeSurveyEmail(body.email);
    if (!email) return Response.json({ error: "Indiquez une adresse e-mail valide." }, { status: 400, headers });
    const challengeId = await requestSurveyCode(email, body.pollId);
    return Response.json({ challengeId }, { headers });
  } catch (error) {
    logFailure("survey-code", error);
    return Response.json({ error: error instanceof SurveyError ? error.message : "L’envoi du code est indisponible. Aucun envoi n’est confirmé." }, { status: error instanceof SurveyError ? error.status : 503, headers });
  }
}

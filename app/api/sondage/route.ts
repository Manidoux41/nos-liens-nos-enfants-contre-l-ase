import { isSurveyAnswer, UUID_PATTERN } from "@/lib/survey";
import { deleteAnswer, saveVerifiedAnswer, type VerifiedSubmission } from "@/lib/survey-store";
import { consumeQuota, logFailure, sameOrigin } from "@/lib/request-security";
import { readJsonBody } from "@/lib/json-body";
import { EMAIL_CONSENT_VERSION, normalizeSurveyEmail, SurveyError } from "@/lib/polls";

const headers = { "Cache-Control": "no-store" };

function verifiedSubmission(value: unknown): value is VerifiedSubmission {
  if (!value || typeof value !== "object") return false;
  return Object.keys(value).sort().join(",") === "answer,challengeId,code,email,pollId"
    && "answer" in value && isSurveyAnswer(value.answer) && value.answer.consentVersion === EMAIL_CONSENT_VERSION
    && "pollId" in value && typeof value.pollId === "string" && UUID_PATTERN.test(value.pollId)
    && "email" in value && typeof value.email === "string" && normalizeSurveyEmail(value.email) !== null
    && "challengeId" in value && typeof value.challengeId === "string" && UUID_PATTERN.test(value.challengeId)
    && "code" in value && typeof value.code === "string" && /^\d{8}$/.test(value.code);
}

async function handle(request: Request, action: "save" | "delete") {
  try {
    if (!sameOrigin(request)) return Response.json({ error: "Cette requête doit provenir du site." }, { status: 403, headers });
    if (!(await consumeQuota(`survey-${action}`, action === "save" ? 30 : 60, 60))) {
      return Response.json({ error: "Le sondage reçoit beaucoup de demandes. Réessayez dans une minute." }, { status: 429, headers: { ...headers, "Retry-After": "60" } });
    }
  } catch (error) {
    logFailure("survey-quota", error);
    return Response.json({ error: "Le service de collecte est momentanément indisponible." }, { status: 503, headers });
  }
  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    if (error instanceof Error && error.message === "TOO_LARGE") return Response.json({ error: "La requête est trop volumineuse." }, { status: 413, headers });
    if (error instanceof Error && error.message === "CONTENT_TYPE") return Response.json({ error: "Un contenu JSON est requis." }, { status: 415, headers });
    return Response.json({ error: "La requête n’est pas un JSON valide." }, { status: 400, headers });
  }
  if (action === "save" && !verifiedSubmission(body)) {
    return Response.json({ error: "Vérifiez votre e-mail avec le code reçu, les réponses et les consentements. Si cette page était déjà ouverte avant la mise à jour, rechargez-la pour utiliser le formulaire avec vérification e-mail." }, { status: 400, headers });
  }
  if (action === "delete" && (!body || typeof body !== "object" || !("id" in body) || typeof body.id !== "string" || !UUID_PATTERN.test(body.id))) {
    return Response.json({ error: "Le code de suppression n’est pas valide." }, { status: 400, headers });
  }
  try {
    if (action === "save" && verifiedSubmission(body)) {
      const result = await saveVerifiedAnswer(body);
      return Response.json({ id: body.answer.id }, { status: result === "saved" ? 201 : 200, headers });
    }
    if (body && typeof body === "object" && "id" in body && typeof body.id === "string") {
      await deleteAnswer(body.id);
      return Response.json({ deleted: true }, { headers });
    }
  } catch (error) {
    logFailure(`survey-${action}`, error);
    if (error instanceof SurveyError) return Response.json({ error: error.message }, { status: error.status, headers });
    return Response.json({ error: "Le stockage est momentanément indisponible. Votre demande n’est pas confirmée. Réessayez plus tard." }, { status: 503, headers });
  }
  return Response.json({ error: "Requête non valide." }, { status: 400, headers });
}

export async function POST(request: Request) { return handle(request, "save"); }
export async function DELETE(request: Request) { return handle(request, "delete"); }

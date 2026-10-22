import { isSurveyAnswer, UUID_PATTERN } from "@/lib/survey";
import { deleteAnswer, saveAnswer } from "@/lib/survey-store";
import { consumeQuota, logFailure, sameOrigin } from "@/lib/request-security";

const headers = { "Cache-Control": "no-store" };

async function readBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new Error("CONTENT_TYPE");
  }
  if (!request.body) throw new Error("INVALID_JSON");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw new Error("TOO_LARGE");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } finally {
    reader.releaseLock();
  }
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
    body = await readBody(request);
  } catch (error) {
    if (error instanceof Error && error.message === "TOO_LARGE") return Response.json({ error: "La requête est trop volumineuse." }, { status: 413, headers });
    if (error instanceof Error && error.message === "CONTENT_TYPE") return Response.json({ error: "Un contenu JSON est requis." }, { status: 415, headers });
    return Response.json({ error: "La requête n’est pas un JSON valide." }, { status: 400, headers });
  }
  if (action === "save" && !isSurveyAnswer(body)) {
    return Response.json({ error: "Vérifiez les départements sélectionnés et votre consentement." }, { status: 400, headers });
  }
  if (action === "delete" && (!body || typeof body !== "object" || !("id" in body) || typeof body.id !== "string" || !UUID_PATTERN.test(body.id))) {
    return Response.json({ error: "Le code de suppression n’est pas valide." }, { status: 400, headers });
  }
  try {
    if (action === "save" && isSurveyAnswer(body)) {
      const result = await saveAnswer(body);
      return Response.json({ id: body.id }, { status: result === "saved" ? 201 : 200, headers });
    }
    if (body && typeof body === "object" && "id" in body && typeof body.id === "string") {
      await deleteAnswer(body.id);
      return Response.json({ deleted: true }, { headers });
    }
  } catch (error) {
    logFailure(`survey-${action}`, error);
    return Response.json({ error: "Le stockage est momentanément indisponible. Votre demande n’est pas confirmée. Réessayez plus tard." }, { status: 503, headers });
  }
  return Response.json({ error: "Requête non valide." }, { status: 400, headers });
}

export async function POST(request: Request) { return handle(request, "save"); }
export async function DELETE(request: Request) { return handle(request, "delete"); }

import { timingSafeEqual } from "node:crypto";
import { pruneExpiredAnswers } from "@/lib/survey-store";
import { logFailure } from "@/lib/request-security";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return Response.json({ error: "Maintenance non configurée." }, { status: 503 });
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") || "");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return Response.json({ error: "Accès refusé." }, { status: 401 });
  try {
    const deleted = await pruneExpiredAnswers();
    return Response.json({ deleted }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logFailure("retention", error);
    return Response.json({ error: "La maintenance a échoué." }, { status: 503 });
  }
}

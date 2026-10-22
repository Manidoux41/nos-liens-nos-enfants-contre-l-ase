import { authentication } from "@/lib/auth";
import { consumeQuota, logFailure, sameOrigin } from "@/lib/request-security";
import { createHash } from "node:crypto";

async function handle(request: Request) {
  const endpoint = new URL(request.url).pathname.replace("/api/auth", "");
  const permitted = request.method === "GET" ? endpoint === "/get-session" : ["/sign-in/email", "/sign-out"].includes(endpoint);
  if (!permitted) return Response.json({ error: "Cette opération n’est pas disponible." }, { status: 404 });
  try {
    if (request.method === "POST" && !sameOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
    if (endpoint === "/sign-in/email") {
      if (!(await consumeQuota("login-global", 50, 60))) return Response.json({ error: "Trop de tentatives. Réessayez plus tard." }, { status: 429 });
      const text = await request.clone().text();
      if (text.length > 2048) return Response.json({ error: "Requête trop volumineuse." }, { status: 413 });
      let body: unknown;
      try { body = JSON.parse(text); } catch { return Response.json({ error: "Requête invalide." }, { status: 400 }); }
      const email = body && typeof body === "object" && "email" in body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const emailKey = createHash("sha256").update(email).digest("hex");
      if (!(await consumeQuota(`login-account:${emailKey}`, 5, 900))) return Response.json({ error: "Connexion impossible. Réessayez dans quinze minutes." }, { status: 429 });
    }
    const response = await authentication().handler(request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    logFailure("auth", error);
    return Response.json({ error: "Authentification momentanément indisponible." }, { status: 503 });
  }
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }

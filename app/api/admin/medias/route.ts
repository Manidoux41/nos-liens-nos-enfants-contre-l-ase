import { randomUUID } from "node:crypto";
import { put, del } from "@vercel/blob";
import { currentAdmin } from "@/lib/admin";
import { database } from "@/lib/db";
import { MAX_MEDIA_BYTES, detectMedia } from "@/lib/editorial";
import { consumeQuota, logFailure, sameOrigin } from "@/lib/request-security";

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
    const actor = await currentAdmin(request.headers);
    if (!actor) return Response.json({ error: "Veuillez vous reconnecter à l’administration." }, { status: 401 });
    if (!(await consumeQuota(`media-upload:${actor.id}`, 20, 60))) return Response.json({ error: "Trop d’imports. Réessayez dans une minute." }, { status: 429 });
    if (!request.body) return Response.json({ error: "Le fichier est vide." }, { status: 400 });
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_MEDIA_BYTES) {
          await reader.cancel();
          return Response.json({ error: "Le fichier dépasse la limite de 4 Mo." }, { status: 413 });
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = Buffer.concat(chunks);
    const detected = detectMedia(bytes);
    if (!detected) return Response.json({ error: "Format non accepté. Choisissez une image JPEG, PNG, WebP ou un PDF." }, { status: 415 });
    if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: "Le stockage Vercel Blob privé n’est pas configuré. Ajoutez BLOB_READ_WRITE_TOKEN côté serveur." }, { status: 503 });
    const id = randomUUID();
    const blob = await put(`editorial/${id}.${detected.extension}`, bytes, { access: "private", contentType: detected.mimeType, addRandomSuffix: false });
    try {
      await database().$transaction([
        database().media.create({ data: { id, title: "Nouveau média", alt: "Description à compléter", caption: "", pathname: blob.pathname, mimeType: detected.mimeType, size } }),
        database().auditLog.create({ data: { actorId: actor.id, action: "MEDIA_UPLOAD", targetId: id } }),
      ]);
    } catch (error) {
      try { await del(blob.pathname); }
      catch (cleanupError) { logFailure("media-upload-orphan-cleanup", cleanupError); }
      throw error;
    }
    return Response.json({ id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logFailure("media-upload", error);
    return Response.json({ error: "L’import n’a pas pu être confirmé. Vérifiez la connexion à la base et au stockage Blob." }, { status: 503 });
  }
}

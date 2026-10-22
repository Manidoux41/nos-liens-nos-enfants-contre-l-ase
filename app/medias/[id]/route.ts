import { get } from "@vercel/blob";
import { currentAdmin } from "@/lib/admin";
import { database } from "@/lib/db";
import { UUID_PATTERN } from "@/lib/survey";
import { logFailure } from "@/lib/request-security";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const noStore = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (!UUID_PATTERN.test(id)) return new Response("Média introuvable.", { status: 404, headers: noStore });
  try {
    const media = await database().media.findUnique({
      where: { id, deleting: false },
      select: { pathname: true, mimeType: true, articles: { where: { article: { status: "PUBLISHED" } }, take: 1, select: { articleId: true } } },
    });
    if (!media) return new Response("Média introuvable.", { status: 404, headers: noStore });
    if (!media.articles.length && !(await currentAdmin(request.headers))) {
      return new Response("Média introuvable.", { status: 404, headers: noStore });
    }
    const blob = await get(media.pathname, { access: "private", useCache: false });
    if (!blob || blob.statusCode !== 200) return new Response("Fichier indisponible dans le stockage.", { status: 502, headers: noStore });
    return new Response(blob.stream, {
      headers: {
        ...noStore,
        "Content-Type": media.mimeType,
        "Content-Disposition": `${media.mimeType === "application/pdf" ? "attachment" : "inline"}; filename="${id}.${media.mimeType === "application/pdf" ? "pdf" : media.mimeType.split("/")[1]}"`,
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  } catch (error) {
    logFailure("media-read", error);
    return new Response("Le média est momentanément indisponible.", { status: 503, headers: noStore });
  }
}

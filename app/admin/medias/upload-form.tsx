"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MAX_MEDIA_BYTES } from "@/lib/editorial";

export function UploadForm({ configured }: { configured: boolean }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get("file");
    setError(""); setSuccess(false);
    if (!(file instanceof File) || !file.size) { setError("Choisissez un fichier non vide."); return; }
    if (file.size > MAX_MEDIA_BYTES) { setError("Le fichier dépasse la limite de 4 Mo."); return; }
    setPending(true);
    try {
      const response = await fetch("/api/admin/medias", { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: file });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "L’import n’a pas pu être confirmé.");
      setSuccess(true); form.reset(); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "L’import a échoué."); }
    finally { setPending(false); }
  }
  return <form onSubmit={upload} method="post" action="/api/admin/medias" encType="multipart/form-data" aria-busy={pending}><label className="field-label" htmlFor="media-file">Image ou PDF — 4 Mo maximum</label><input id="media-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required disabled={!configured || pending} /><p className="field-help">JPEG, PNG, WebP ou PDF. Aucun SVG, fichier exécutable ou document judiciaire confidentiel. Vérifiez vos droits de publication et retirez les métadonnées personnelles avant import.</p><button className="button button-primary" disabled={!configured || pending}>{pending ? "Import en cours…" : "Importer dans la médiathèque"}</button>{!configured && <p className="form-error">Stockage non configuré : créez un store Vercel Blob <strong>privé</strong> et définissez BLOB_READ_WRITE_TOKEN.</p>}{error && <p className="form-error" role="alert">{error}</p>}{success && <p className="deletion-success" role="status">Média importé. Complétez son titre et sa description dans la bibliothèque avant de l’associer à un article.</p>}</form>;
}

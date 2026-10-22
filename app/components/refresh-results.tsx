"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function RefreshResults({ unavailable }: { unavailable: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div className="results-refresh" aria-busy={pending}>
    <button type="button" className="button button-small" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      {pending ? "Vérification en cours…" : unavailable ? "Réessayer la lecture des résultats" : "Actualiser les résultats"}
    </button>
    {pending && <p role="status" className="field-help">Nouvelle lecture de la base en cours. Vos réponses au formulaire sont conservées.</p>}
  </div>;
}

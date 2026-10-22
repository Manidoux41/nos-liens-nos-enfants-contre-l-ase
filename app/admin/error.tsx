"use client";

export default function AdminError({ reset }: { reset: () => void }) {
  return <div role="alert" className="notice"><h1>Administration indisponible</h1><p>La vérification de votre session ou la lecture de la base a échoué. Aucun accès aux données n’est accordé sans vérification.</p><button className="button button-primary" onClick={reset}>Réessayer</button></div>;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return <div><button className="button button-small" disabled={pending} onClick={async () => {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) throw new Error("La déconnexion a échoué. Réessayez.");
      router.replace("/admin/connexion");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "La déconnexion a échoué."); setPending(false); }
  }}>{pending ? "Déconnexion…" : "Se déconnecter"}</button>{error && <p role="alert" className="form-error">{error}</p>}</div>;
}

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(data.get("email")).trim().toLowerCase(), password: String(data.get("password")), rememberMe: false }),
      });
      if (!response.ok) throw new Error(response.status === 429 ? "Trop de tentatives. Réessayez dans quinze minutes." : response.status >= 500 ? "Le service d’authentification est indisponible." : "Connexion refusée. Vérifiez vos identifiants et les droits du compte.");
      router.replace("/admin");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La connexion a échoué.");
    } finally { setPending(false); }
  }
  return <form method="post" action="/api/auth/sign-in/email" onSubmit={submit} aria-busy={pending}><label className="field-label" htmlFor="email">Adresse e-mail</label><input id="email" name="email" type="email" autoComplete="username" maxLength={254} required /><label className="field-label" htmlFor="password">Mot de passe</label><input id="password" name="password" type="password" autoComplete="current-password" maxLength={128} required /><button className="button button-primary form-submit" type="submit" disabled={pending}>{pending ? "Connexion…" : "Se connecter"} →</button>{error && <p role="alert" className="form-error">{error}</p>}<p className="field-help">Mot de passe oublié ? Un autre administrateur doit le réinitialiser depuis l’espace privé. Aucun lien de réinitialisation public n’est envoyé.</p></form>;
}

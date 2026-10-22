"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { aseOptions, MIN_PLACEMENT_YEAR, optionLabel, residenceOptions, returnHomeOptions, type ReturnHome } from "@/lib/survey";
import { DEFAULT_POLL_ID, EMAIL_CONSENT_VERSION } from "@/lib/polls";

export function Survey({ pollId = DEFAULT_POLL_ID }: { pollId?: string }) {
  const [step, setStep] = useState(1);
  const [residence, setResidence] = useState("");
  const [ase, setAse] = useState("");
  const [placementYear, setPlacementYear] = useState("");
  const [returnHome, setReturnHome] = useState<ReturnHome | "">("");
  const [consent, setConsent] = useState(false);
  const [judgeNames, setJudgeNames] = useState("");
  const [socialWorkerNames, setSocialWorkerNames] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [privateConsent, setPrivateConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [codeMessage, setCodeMessage] = useState("");
  const id = useRef("");
  const heading = useRef<HTMLHeadingElement>(null);

  function changeStep(next: number) {
    setError("");
    setStep(next);
    requestAnimationFrame(() => heading.current?.focus());
  }

  async function requestCode() {
    setSendingCode(true); setError(""); setCodeMessage("");
    setChallengeId(""); setCode("");
    try {
      const response = await fetch("/api/sondage/code", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId, email }),
      });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== "object" || !("challengeId" in result) || typeof result.challengeId !== "string") {
        throw new Error(result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "L’envoi du code n’a pas pu être confirmé.");
      }
      setChallengeId(result.challengeId); setCode("");
      setCodeMessage("Code envoyé. Consultez votre messagerie et les indésirables. Le dernier code reçu expire dans dix minutes.");
    } catch (error) { setError(error instanceof Error ? error.message : "L’envoi a échoué."); }
    finally { setSendingCode(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1) { changeStep(2); return; }
    setPending(true);
    setError("");
    try {
      if (!id.current) id.current = crypto.randomUUID();
      const response = await fetch("/api/sondage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId, email, challengeId, code, answer: { id: id.current, residence, ase, placementYear: placementYear ? Number(placementYear) : null, returnHome: returnHome || null, judgeNames, socialWorkerNames, jurisdiction, privateConsent, consent, consentVersion: EMAIL_CONSENT_VERSION } }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "L’enregistrement n’a pas pu être confirmé.");
      }
      if (!result || typeof result !== "object" || !("id" in result) || result.id !== id.current) {
        throw new Error("La confirmation reçue est invalide. Réessayez sans fermer cette page.");
      }
      setReceipt(id.current);
      requestAnimationFrame(() => heading.current?.focus());
    } catch (cause) {
      setError(cause instanceof TypeError ? "Connexion impossible. Vérifiez votre connexion puis réessayez ; aucune confirmation d’enregistrement n’a été reçue." : cause instanceof Error ? cause.message : "Une erreur inattendue empêche de confirmer l’enregistrement.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="survey-card">
      <noscript><p className="form-error">JavaScript est nécessaire pour vérifier et envoyer ce sondage. Aucune réponse n’est transmise automatiquement.</p></noscript>
      {receipt ? <div className="survey-success">
        <span className="success-icon" aria-hidden="true">✓</span>
        <p className="eyebrow">VOTRE RÉPONSE EST ENREGISTRÉE</p>
        <h3 ref={heading} tabIndex={-1}>Merci d’avoir fait entendre<br /><em>votre voix.</em></h3>
        <p>Votre participation compte. Conservez ce code privé pour pouvoir supprimer votre réponse :</p>
        <code className="receipt-code">{receipt}</code>
        <p className="small-print">Ne partagez pas ce code : toute personne le possédant peut supprimer cette réponse. Il ne sera pas possible de le récupérer après avoir quitté cette page.</p>
        <Link className="text-link" href="/confidentialite">Gérer ou supprimer ma réponse <span aria-hidden="true">→</span></Link>
      </div> : <form method="post" action="/api/sondage" onSubmit={submit} aria-busy={pending}>
        <div className="survey-topline"><span>LE SONDAGE DES LECTEURS</span><span>0{step} / 02</span></div>
        <div className="step-progress" aria-label={`Étape ${step} sur 2`}><span /><span className={step === 2 ? "filled" : ""} /></div>
        <h3 ref={heading} tabIndex={-1}>{step === 1 ? "Et vous, d’où venez-vous ?" : "Un dernier regard avant d’envoyer."}</h3>
        <p className="form-description">{step === 1 ? "Situez votre parcours. Les précisions sur les professionnels sont facultatives et privées." : "Vérifiez votre réponse et choisissez librement de la transmettre."}</p>
        {step === 1 ? <>
          <label className="field-label" htmlFor="residence">Votre département de résidence <span aria-hidden="true">*</span></label>
          <select id="residence" name="residence" value={residence} onChange={(event) => { setResidence(event.target.value); id.current = ""; }} required><option value="" disabled>Sélectionnez votre département</option>{residenceOptions.map(([code, name]) => <option key={code} value={code}>{/^\d/.test(code) ? `${code} — ` : ""}{name}</option>)}</select>
          <label className="field-label" htmlFor="ase">De quelle ASE dépendez-vous ? <span aria-hidden="true">*</span></label>
          <select id="ase" name="ase" aria-describedby="ase-help" value={ase} onChange={(event) => { setAse(event.target.value); id.current = ""; }} required><option value="" disabled>Sélectionnez le département de l’ASE</option>{aseOptions.map(([code, name]) => <option key={code} value={code}>{/^\d/.test(code) ? `${code} — ` : ""}{name}</option>)}</select>
          <p id="ase-help" className="field-help">Il peut être différent de votre lieu de résidence. Le code 69 regroupe le Rhône et la Métropole de Lyon.</p>
          <fieldset className="placement-fields"><legend>Le parcours de vos enfants — facultatif</legend>
            <label className="field-label" htmlFor="placement-year">En quelle année a commencé le premier placement de vos enfants ?</label>
            <input id="placement-year" name="placementYear" type="number" min={MIN_PLACEMENT_YEAR} max={new Date().getUTCFullYear()} step={1} value={placementYear} disabled={returnHome === "NOT_APPLICABLE"} onChange={(event) => { setPlacementYear(event.target.value); id.current = ""; }} aria-describedby="placement-help" placeholder="Exemple : 2020" />
            <p className="field-help" id="placement-help">Si plusieurs enfants sont concernés, indiquez l’année du premier placement parmi eux. Il ne s’agit pas de la date de participation. Laissez vide si vous ne savez pas ou préférez ne pas répondre. Aucun nom ni date de naissance.</p>
            <label className="field-label" htmlFor="return-home">Au moment de votre réponse, vos enfants concernés sont-ils revenus à votre foyer ?</label>
            <select id="return-home" name="returnHome" value={returnHome} onChange={(event) => { const value = returnHomeOptions.find(([code]) => code === event.target.value)?.[0] || ""; setReturnHome(value); if (value === "NOT_APPLICABLE") setPlacementYear(""); id.current = ""; }}><option value="">Non renseigné</option>{returnHomeOptions.map(([code, label]) => <option value={code} key={code}>{label}</option>)}</select>
            <p className="field-help">Un seul choix pour l’ensemble de vos enfants concernés. Il s’agit d’une situation déclarée à cet instant, pas d’un taux de réussite de l’ASE.</p>
          </fieldset>
          <label className="field-label" htmlFor="jurisdiction">Juridiction(s) intervenante(s) — facultatif</label>
          <input id="jurisdiction" value={jurisdiction} onChange={(event) => { setJurisdiction(event.target.value); id.current = ""; }} maxLength={200} placeholder="Tribunal judiciaire, cour d’appel et ville…" aria-describedby="jurisdiction-help" />
          <p id="jurisdiction-help" className="field-help">Le libellé déclaré reste privé. Une juridiction officielle pourra être rattachée après modération pour les statistiques.</p>
          <details className="private-fields"><summary>Préciser les professionnels — facultatif, jamais publié</summary>
            <p className="field-help">Noms professionnels uniquement, séparés par des retours à la ligne. N’indiquez aucun nom d’enfant, adresse, information de santé, accusation ou extrait de procédure. Ces champs ne constituent pas un dépôt de plainte.</p>
            <label className="field-label" htmlFor="judges">Nom(s) des juges — privé</label>
            <textarea id="judges" value={judgeNames} onChange={(event) => { setJudgeNames(event.target.value); id.current = ""; }} maxLength={600} rows={3} />
            <label className="field-label" htmlFor="workers">Nom(s) des intervenants sociaux — privé</label>
            <textarea id="workers" value={socialWorkerNames} onChange={(event) => { setSocialWorkerNames(event.target.value); id.current = ""; }} maxLength={600} rows={3} />
          </details>
          <button className="button button-primary form-submit" type="submit">Continuer <span aria-hidden="true">→</span></button>
          <p className="small-print">* Choix requis ; vous pouvez préférer ne pas répondre.<br />Aucune donnée n’est envoyée à cette étape.</p>
        </> : <>
          <fieldset className="placement-fields"><legend>Vérifier votre adresse e-mail</legend>
            <label className="field-label" htmlFor="survey-email">Votre adresse e-mail *</label>
            <input id="survey-email" name="email" type="email" autoComplete="email" maxLength={254} required disabled={pending || sendingCode} value={email} onChange={(event) => { setEmail(event.target.value); setChallengeId(""); setCode(""); setCodeMessage(""); id.current = ""; }} />
            <p className="field-help">Une réponse par adresse vérifiée et par sondage. Votre adresse est transmise à Resend uniquement pour envoyer le code ; seule une empreinte protégée est conservée en base. Pas de newsletter. Après suppression complète, vous pourrez répondre à nouveau.</p>
            <button type="button" className="button button-small" disabled={pending || sendingCode || !email.trim()} onClick={requestCode}>{sendingCode ? "Envoi du code…" : challengeId ? "Recevoir un nouveau code" : "Recevoir mon code par e-mail"}</button>
            {codeMessage && <p className="field-help" role="status">{codeMessage}</p>}
            <label className="field-label" htmlFor="survey-email-code">Code reçu par e-mail — 8 chiffres *</label>
            <input id="survey-email-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" minLength={8} maxLength={8} required disabled={pending || sendingCode || !challengeId} value={code} onChange={(event) => setCode(event.target.value)} />
          </fieldset>
          <dl className="answer-summary"><div><dt>Année du premier placement</dt><dd>{placementYear || "Non renseignée"}</dd></div><div><dt>Retour au foyer à ce jour</dt><dd>{returnHome ? optionLabel(returnHomeOptions, returnHome) : "Non renseigné"}</dd></div></dl>
          <dl className="answer-summary"><div><dt>Votre résidence</dt><dd>{optionLabel(residenceOptions, residence)}</dd></div><div><dt>Votre ASE de rattachement</dt><dd>{optionLabel(aseOptions, ase)}</dd></div><div><dt>Juridiction déclarée — privé avant modération</dt><dd>{jurisdiction || "Non renseignée"}</dd></div><div><dt>Juges — strictement privé</dt><dd>{judgeNames || "Non renseigné"}</dd></div><div><dt>Intervenants sociaux — strictement privé</dt><dd>{socialWorkerNames || "Non renseigné"}</dd></div></dl>
          {(judgeNames.trim() || socialWorkerNames.trim()) && <label className="consent-label"><input type="checkbox" checked={privateConsent} onChange={(event) => { setPrivateConsent(event.target.checked); id.current = ""; }} required disabled={pending} /><span>Je demande la conservation privée des noms professionnels que je fournis, sans publication ni classement nominatif. Je comprends que mon accord ne remplace pas les droits des personnes nommées.</span></label>}
          <label className="consent-label"><input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); id.current = ""; }} required disabled={pending} /><span>J’accepte la vérification de mon e-mail et la conservation de son empreinte pour limiter à une réponse par adresse et par sondage, ainsi que la conservation de ma contribution pendant 12 mois maximum et, après modération, son utilisation dans des statistiques publiques séparées par département, juridiction, année du premier placement et retour au foyer à partir de dix réponses par groupe, pour éclairer une future pétition. J’ai lu les <Link href="/confidentialite" target="_blank">informations de confidentialité (nouvel onglet)</Link>. Je peux retirer mon consentement avec mon code de suppression. Participer ne vaut pas signer une pétition.</span></label>
          <p className="field-help">Votre propre nom et votre adresse postale ne sont pas demandés. L’e-mail sert uniquement à vérifier la participation. Vos choix et les noms professionnels peuvent néanmoins permettre une identification indirecte. Les champs nominatifs ne sont jamais publics.</p>
          <button className="button button-primary form-submit" type="submit" disabled={pending || sendingCode || !challengeId || !/^\d{8}$/.test(code)}>{pending ? "Enregistrement en cours…" : "Envoyer ma réponse"}<span aria-hidden="true">↗</span></button>
          <button className="back-button" type="button" disabled={pending} onClick={() => changeStep(1)}>← Modifier mes réponses</button>
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-trust"><span aria-hidden="true">◇</span> Noms non publiés · Sans publicité · Statistiques modérées</div>
      </form>}
    </div>
  );
}

export function DeleteAnswer() {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setDeleted(false);
    try {
      const response = await fetch("/api/sondage", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: code.trim().toLowerCase() }) });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "La suppression n’a pas pu être confirmée.");
      if (!result || typeof result !== "object" || !("deleted" in result) || result.deleted !== true) throw new Error("Confirmation de suppression invalide.");
      setDeleted(true);
      setCode("");
    } catch (cause) {
      setError(cause instanceof TypeError ? "Connexion impossible. Réessayez lorsque votre connexion sera rétablie." : cause instanceof Error ? cause.message : "La suppression a échoué.");
    } finally {
      setPending(false);
    }
  }
  return <form className="delete-form" onSubmit={submit} aria-busy={pending}><label className="field-label" htmlFor="deletion-code">Votre code privé de suppression</label><input id="deletion-code" value={code} onChange={(event) => { setCode(event.target.value); setDeleted(false); }} required pattern="[0-9a-fA-F-]{36}" autoComplete="off" spellCheck={false} placeholder="xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx" /><button type="submit" className="button button-primary" disabled={pending}>{pending ? "Suppression en cours…" : "Supprimer définitivement ma réponse"}</button>{error && <p role="alert" className="form-error">{error}</p>}{deleted && <p role="status" className="deletion-success">Il ne reste aucune réponse associée à ce code sur le serveur actif. Les codes inconnus ou déjà supprimés reçoivent la même confirmation pour préserver votre confidentialité.</p>}</form>;
}

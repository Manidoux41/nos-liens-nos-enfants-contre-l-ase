import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Header } from "../components/navigation";
import { SurveyResults } from "../components/survey-results";

export const metadata: Metadata = { title: "Statistiques citoyennes & pétition" };

export default function StatisticsPage() {
  return <><Header /><main id="contenu" className="section-width privacy-page statistics-page"><Link href="/" className="text-link">← Retour à notre histoire</Link><p className="eyebrow">DES DÉCLARATIONS, PAS DES VERDICTS</p><h1>Rendre visibles<br /><em>les parcours.</em></h1><p className="privacy-lead">Départements, année du premier placement, retour au foyer et juridictions : plusieurs façons de lire les contributions, sans classement de personnes.</p><div className="notice"><strong>Comment lire ces chiffres ?</strong><p>Seules les réponses approuvées par un administrateur et non expirées sont comptabilisées. Un groupe n’est affiché qu’à partir de dix réponses. Chaque question est présentée séparément, sans croisement, total général ni petits effectifs. Une juridiction doit être rattachée à un libellé institutionnel vérifié par la modération. Les graphiques comptent des contributions, pas des enfants. L’année du premier placement n’est ni une durée continue de placement ni la date de participation.</p><p>Ce sondage est volontaire, non représentatif et ne garantit pas une réponse unique par personne. La modération contrôle la publication, pas la véracité judiciaire des déclarations. Ces données ne mesurent ni un taux de placement abusif ni la responsabilité d’un juge ou d’un service.</p></div><Suspense fallback={<p role="status">Chargement des résultats…</p>}><SurveyResults /></Suspense><Link href="/#sondage" className="text-link">Participer au sondage →</Link></main></>;
}

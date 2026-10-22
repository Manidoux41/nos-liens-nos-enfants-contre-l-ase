import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Header } from "../components/navigation";
import { publicStatistics } from "@/lib/public-statistics";
import { logFailure } from "@/lib/request-security";
import type { Statistic } from "@/lib/statistics";

export const metadata: Metadata = { title: "Statistiques citoyennes & pétition" };

function Groups({ title, values }: { title: string; values: Statistic[] }) {
  return <section className="stats-group"><h2>{title}</h2>{values.length ? <ul>{values.map((group) => <li key={group.label}><span>{group.label}</span><strong>{group.count} réponses</strong></li>)}</ul> : <p>Aucun groupe n’atteint actuellement le seuil de publication de dix réponses validées.</p>}</section>;
}

async function Results() {
  await connection();
  let data;
  try { data = await publicStatistics(); }
  catch (error) {
    logFailure("public-statistics", error);
    return <p role="alert" className="form-error">Les statistiques sont momentanément indisponibles. Aucun chiffre ne peut être affiché ; réessayez plus tard.</p>;
  }
  return <>
    {!data.published ? <p className="notice">La publication des statistiques n’est pas encore ouverte. Les réponses restent privées et soumises à modération.</p> : <><Groups title="Département de résidence" values={data.residence} /><Groups title="Département de l’ASE" values={data.ase} /><Groups title="Juridictions de rattachement" values={data.jurisdictions} /></>}
    <section id="petition"><p className="eyebrow">PRÉPARER UNE MOBILISATION CITOYENNE</p><h2>{data.settings?.petitionTitle || "Préserver les liens, faire évoluer la protection de l’enfance"}</h2><p>Ces contributions pourront éclairer une future pétition pour une protection de l’enfance plus transparente, un accompagnement adapté et un examen effectif des décisions contestées. Répondre au sondage ne vaut pas signature d’une pétition.</p>{data.settings?.petitionUrl ? <a className="button button-primary" href={data.settings.petitionUrl} target="_blank" rel="noopener noreferrer">Découvrir la pétition (nouvel onglet) ↗</a> : <p className="notice">La pétition est en préparation. Aucun nom de professionnel ni réponse individuelle ne sera transmis à une plateforme de pétition.</p>}</section>
  </>;
}

export default function StatisticsPage() {
  return <><Header /><main id="contenu" className="section-width privacy-page"><Link href="/" className="text-link">← Retour à notre histoire</Link><p className="eyebrow">DES DÉCLARATIONS, PAS DES VERDICTS</p><h1>Rendre visibles<br /><em>les parcours.</em></h1><p className="privacy-lead">Un éclairage citoyen sur les départements et les juridictions mentionnés par les participants. Aucun classement de personnes, aucune liste de noms.</p><div className="notice"><strong>Comment lire ces chiffres ?</strong><p>Seules les réponses approuvées par un administrateur et non expirées sont comptabilisées. Un groupe n’est affiché qu’à partir de dix réponses. Les départements et juridictions sont présentés séparément, sans croisement, total général ni petits effectifs. Une juridiction doit être rattachée à un libellé institutionnel vérifié par la modération.</p><p>Ce sondage est volontaire, non représentatif et ne garantit pas une réponse unique par personne. La modération contrôle la publication, pas la véracité judiciaire des déclarations. Ces données ne mesurent ni un taux de placement abusif ni la responsabilité d’un juge ou d’un service.</p></div><Suspense fallback={<p role="status">Chargement des résultats…</p>}><Results /></Suspense><Link href="/#sondage" className="text-link">Participer au sondage →</Link></main></>;
}

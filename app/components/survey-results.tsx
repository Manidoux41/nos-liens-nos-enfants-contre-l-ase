import Link from "next/link";
import { connection } from "next/server";
import { publicStatistics } from "@/lib/public-statistics";
import { logFailure } from "@/lib/request-security";
import { StatisticsChart, type ChartState } from "./statistics-chart";
import { RefreshResults } from "./refresh-results";

export async function SurveyResults({ compact = false }: { compact?: boolean }) {
  await connection();
  let data: Awaited<ReturnType<typeof publicStatistics>> | undefined;
  let state: ChartState = "unavailable";
  try {
    data = await publicStatistics();
    state = data.published ? "ready" : "closed";
  } catch (error) { logFailure("public-statistics", error); }
  return <div className="survey-results">
    {state === "unavailable" && <p role="alert" className="form-error">Les statistiques sont momentanément indisponibles. Aucun chiffre ne peut être affiché ; réessayez plus tard. Les cadres ci-dessous présentent les vues prévues, sans données inventées.</p>}
    {state === "closed" && <div className="notice"><p>La publication des statistiques n’est pas encore ouverte. Les réponses restent privées et soumises à modération. Il ne s’agit pas d’une panne de lecture.</p><p>Un administrateur doit activer « Ouvrir les statistiques publiques » dans <Link className="text-link" href="/admin/sondage">Sondage & réglages</Link>. Chaque groupe doit ensuite compter au moins dix réponses approuvées et non expirées pour apparaître.</p></div>}
    <RefreshResults unavailable={state === "unavailable"} />
    <div className="statistics-grid">
      <StatisticsChart state={state} title="Département de l’ASE" description="Les départements de rattachement déclarés, indépendamment du lieu de résidence." values={data?.ase || []} />
      <StatisticsChart state={state} title="Année du premier placement" description="Depuis quand les familles participantes sont-elles concernées ? Année du premier placement parmi leurs enfants." kind="years" values={data?.years || []} />
      <StatisticsChart state={state} title="Retour des enfants au foyer" description="Tous revenus, certains revenus ou aucun revenu : la situation déclarée au moment de la contribution." kind="donut" values={data?.returns || []} />
      {!compact && <><StatisticsChart state={state} title="Département de résidence" description="Le lieu de résidence déclaré par les participants, sans croisement avec les autres questions." values={data?.residence || []} /><StatisticsChart state={state} title="Juridictions de rattachement" description="Les seuls libellés institutionnels vérifiés par la modération. Aucun nom de professionnel." values={data?.jurisdictions || []} /></>}
    </div>
    <p className="field-help">Dix réponses approuvées et non expirées minimum par groupe. Les années et retours ne comptent que les contributions recueillies avec le nouveau consentement. Aucun rapprochement année / département / retour. Déclarations volontaires, non représentatives ; aucun taux de placement abusif ne peut en être déduit.</p>
    {compact ? <Link className="text-link" href="/statistiques">Toutes les vues et la méthode de publication →</Link> : <section id="petition"><p className="eyebrow">PRÉPARER UNE MOBILISATION CITOYENNE</p><h2>{data?.settings?.petitionTitle || "Préserver les liens, faire évoluer la protection de l’enfance"}</h2><p>Ces contributions pourront éclairer une future pétition pour une protection de l’enfance plus transparente, un accompagnement adapté et un examen effectif des décisions contestées. Répondre au sondage ne vaut pas signature d’une pétition.</p>{state === "unavailable" ? <p className="notice">L’état de la pétition ne peut pas être vérifié pendant cette indisponibilité.</p> : data?.settings?.petitionUrl ? <a className="button button-primary" href={data.settings.petitionUrl} target="_blank" rel="noopener noreferrer">Découvrir la pétition (nouvel onglet) ↗</a> : <p className="notice">La pétition est en préparation. Aucun nom de professionnel ni réponse individuelle ne sera transmis à une plateforme de pétition.</p>}</section>}
  </div>;
}

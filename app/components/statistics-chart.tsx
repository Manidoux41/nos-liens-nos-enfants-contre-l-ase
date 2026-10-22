"use client";

import { useId, useState } from "react";
import type { Statistic } from "@/lib/statistics";

export type ChartState = "ready" | "closed" | "unavailable";
const colors = ["#a7553b", "#536a42", "#476b85"];

export function StatisticsChart({ title, description, values, kind = "bars", state }: {
  title: string; description: string; values: Statistic[]; kind?: "bars" | "years" | "donut"; state: ChartState;
}) {
  const id = useId();
  const [view, setView] = useState<"chart" | "table">("chart");
  const max = Math.max(1, ...values.map((value) => value.count));
  const totalDisplayed = values.reduce((sum, value) => sum + value.count, 0);
  const empty = state === "unavailable" ? "Données indisponibles : impossible de lire la base pour le moment."
    : state === "closed" ? "En attente d’ouverture de la publication par l’administration."
    : "Aucun groupe n’atteint le seuil de dix réponses approuvées. Les effectifs absents sont masqués, pas égaux à zéro.";
  return <section className="statistics-card" aria-labelledby={`${id}-title`}>
    <div className="statistics-card-heading"><span className="eyebrow">{kind === "years" ? "CHRONOLOGIE DÉCLARÉE" : kind === "donut" ? "SITUATION AU MOMENT DE LA RÉPONSE" : "RÉPARTITION DES CONTRIBUTIONS"}</span><h2 id={`${id}-title`}>{title}</h2><p>{description}</p></div>
    <div className="chart-switch" role="group" aria-label={`Présentation : ${title}`}><button type="button" aria-pressed={view === "chart"} onClick={() => setView("chart")}>Graphique</button><button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>Tableau accessible</button></div>
    {!values.length ? <div className="chart-empty"><span aria-hidden="true">{kind === "donut" ? "◯" : "▥"}</span><strong>{state === "unavailable" ? "Lecture impossible" : "En attente de résultats publiables"}</strong><p>{empty}</p><small>Aucune donnée fictive ni estimation affichée.</small></div> : view === "table" ? <div className="chart-table-wrap"><table><caption>{title} — groupes publiables uniquement</caption><thead><tr><th scope="col">{kind === "years" ? "Année du premier placement" : "Groupe"}</th><th scope="col">Réponses</th></tr></thead><tbody>{values.map((value) => <tr key={value.label}><th scope="row">{value.label}</th><td>{value.count}</td></tr>)}</tbody></table></div> :
      <figure className={`survey-chart ${kind}`} aria-label={`${title} : ${values.map((value) => `${value.label}, ${value.count} réponses`).join(" ; ")}`}>
        {kind === "donut" ? <div className="donut-layout"><svg viewBox="0 0 120 120" role="img" aria-label="Répartition parmi les seuls groupes affichés"><circle cx="60" cy="60" r="44" fill="none" stroke="#e3e3d9" strokeWidth="16" />{values.map((value, index) => {
          const length = value.count / totalDisplayed * 100;
          const start = values.slice(0, index).reduce((sum, group) => sum + group.count, 0) / totalDisplayed * 100;
          return <circle key={value.label} cx="60" cy="60" r="44" fill="none" stroke={colors[index % colors.length]} strokeWidth="16" pathLength="100" strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={-start} transform="rotate(-90 60 60)" />;
        })}</svg><ul>{values.map((value, index) => <li key={value.label}><span className="chart-dot" style={{ backgroundColor: colors[index % colors.length] }} /><span>{value.label}<strong>{value.count} réponses</strong></span></li>)}</ul></div> :
          <ul className="chart-bars">{values.map((value) => <li key={value.label}><div className="chart-bar-label"><span>{value.label}</span><strong>{value.count} réponses</strong></div><div className="chart-bar-track"><span style={{ width: `${value.count / max * 100}%` }} /></div></li>)}</ul>}
        <figcaption>{kind === "years" ? "Années classées chronologiquement. Chaque barre compte des contributions, pas des enfants. Les années absentes ne signifient pas zéro placement." : kind === "donut" ? "L’anneau représente uniquement les catégories affichables. Les groupes masqués et les non-réponses en sont exclus : ce n’est pas un taux global de retour." : "Longueur des barres proportionnelle aux seuls effectifs affichés. Aucun total général ni croisement individuel."}</figcaption>
      </figure>}
  </section>;
}

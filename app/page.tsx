import Link from "next/link";
import { Suspense } from "react";
import { Header, ShareButton } from "./components/navigation";
import { PublishedSurvey } from "./components/published-survey";
import { SurveyResults } from "./components/survey-results";
import { chapters } from "@/lib/story";

const resources = [
  { number: "01", title: "Connaître ses droits", text: "Une institution indépendante pour défendre les droits des enfants et accompagner vos démarches.", name: "Défenseur des droits", url: "https://www.defenseurdesdroits.fr/" },
  { number: "02", title: "Protéger un enfant", text: "Un enfant en danger ou en risque de l’être ? Le 119 est le numéro national dédié à la protection de l’enfance.", name: "Allô 119", url: "https://www.allo119.gouv.fr/" },
  { number: "03", title: "S’informer et comprendre", text: "Retrouvez le site du journal évoqué dans notre récit. Le lien vers notre article sera ajouté lorsqu’il sera disponible.", name: "La République du Centre · accueil", url: "https://www.larep.fr/" },
];

export default function Home() {
  return (
    <>
      <Header />
      <main id="contenu">
        <section className="hero section-width">
          <div className="hero-copy">
            <div className="eyebrow"><span className="small-line" /> UN TÉMOIGNAGE. UNE FAMILLE. DES LIENS.</div>
            <h1>Derrière les dossiers,<br />il y a <em>nos vies.</em></h1>
            <p className="hero-description">Treize années de séparations, d’espoirs et de combat pour préserver nos liens. Aujourd’hui, depuis l’Asie, nous choisissons de raconter notre histoire et de faire entendre les familles.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#notre-histoire">Découvrir notre histoire <span aria-hidden="true">↗</span></a>
              <a className="text-link" href="#sondage">Et vous, d’où venez-vous ? <span aria-hidden="true">→</span></a>
            </div>
            <div className="hero-note"><span className="tiny-heart" aria-hidden="true">♡</span> Pour que les liens familiaux ne soient jamais oubliés.</div>
          </div>
          <div className="hero-art">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/family-landscape.svg" width="640" height="590" alt="Illustration d’une famille réunie devant un paysage d’Asie au soleil levant." fetchPriority="high" />
            <div className="art-caption"><span className="caption-dot" /><span>Un nouveau chapitre, en Asie</span><span aria-hidden="true">↗</span></div>
            <span className="art-side-note">GARDER LE LIEN, TOUJOURS.</span>
          </div>
        </section>

        <div className="intro-strip">
          <div className="section-width intro-strip-inner">
            <p>Notre histoire est singulière.<br /><strong>La force des liens, elle, est universelle.</strong></p>
            <div className="strip-item"><strong>2013</strong><span>Le début de notre histoire</span></div>
            <div className="strip-item"><strong>5 enfants</strong><span>Une seule et même famille</span></div>
            <div className="strip-item"><strong>France <span aria-hidden="true">↔</span> Asie</strong><span>L’amour ne connaît pas de frontières</span></div>
          </div>
        </div>

        <section id="notre-histoire" className="story-section section-width section-space">
          <div className="section-heading">
            <div><p className="eyebrow">01 — NOTRE HISTOIRE</p><h2>Une famille.<br />Des épreuves. <em>Toujours de l’amour.</em></h2></div>
            <p>Nous ne demandons pas que notre parole soit la seule vérité. Nous demandons qu’elle puisse être entendue.</p>
          </div>
          <div className="story-grid">
            <article className="story-card"><span className="chapter-date">2013 — 2016</span><span className="story-symbol" aria-hidden="true">✳</span><h3>Les premières<br />séparations</h3><p>Devenir parents, chercher du soutien, puis voir nos trois aînés nous être confiés seulement le temps des visites.</p><a href="#chapitre-1">Là où tout commence <span aria-hidden="true">↗</span></a></article>
            <article className="story-card"><span className="chapter-date">2018 — 2025</span><span className="story-symbol" aria-hidden="true">⌁</span><h3>Reconstruire<br />la confiance</h3><p>Notre mariage, des rencontres plus libres et un accompagnement constructif nous redonnent de l’espoir.</p><a href="#chapitre-4">Les années d’espoir <span aria-hidden="true">↗</span></a></article>
            <article className="story-card"><span className="chapter-date">2026 — AUJOURD’HUI</span><span className="story-symbol" aria-hidden="true">☼</span><h3>Écrire un<br />nouveau chapitre</h3><p>Après de nouvelles ruptures, nous choisissons de reconstruire un quotidien en Asie avec nos deux plus jeunes.</p><a href="#chapitre-11">Notre vie aujourd’hui <span aria-hidden="true">↗</span></a></article>
          </div>
          <div className="story-preface"><p>Ouvrez les étapes ci-dessous pour lire notre récit. Cette adaptation anonymisée présente notre vécu, sans prétendre établir les responsabilités des personnes concernées. Les noms ont été retirés ; certains éléments de contexte ont été conservés.</p></div>
          <div className="timeline" aria-label="Les étapes de notre histoire">
            {chapters.map((chapter, index) => <details key={chapter.title} id={`chapitre-${index + 1}`}><summary><span className="timeline-date">{chapter.date}</span><span>{chapter.title}</span><span className="timeline-plus" aria-hidden="true">+</span></summary><div>{chapter.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></details>)}
          </div>
        </section>

        <section className="quote-section"><div className="section-width"><span className="quote-mark" aria-hidden="true">“</span><blockquote>Un enfant n’est pas un dossier.<br />Et une famille, <em>ce sont des liens à préserver.</em></blockquote><p>LE SENS DE NOTRE TÉMOIGNAGE</p></div></section>

        <section id="comprendre" className="section-width section-space evidence-section">
          <p className="eyebrow">NOMMER LES DYSFONCTIONNEMENTS, EXIGER DES GARANTIES</p>
          <h2>Protéger les enfants.<br /><em>Écouter aussi les alertes.</em></h2>
          <p>En France, les abus dénoncés dans la protection de l’enfance, les ruptures de suivi, les atteintes aux liens familiaux et les décisions de placement contestées doivent pouvoir être examinés. Reconnaître la nécessité de protéger un enfant n’interdit pas de questionner les pratiques, de demander des explications et d’exercer les recours prévus par la loi.</p>
          <p>La commission d’enquête de l’Assemblée nationale a consacré son rapport du 1er avril 2025 aux <a href="https://www.assemblee-nationale.fr/dyn/17/rapports/cease/l17b1200-ti_rapport-enquete" target="_blank" rel="noopener noreferrer">manquements des politiques publiques de protection de l’enfance (nouvel onglet)</a>. Ce travail institutionnel constitue une source pour comprendre la crise du système ; il n’établit pas que chaque placement contesté est abusif.</p>
          <div className="notice"><strong>Comparer sans confondre.</strong><p>Les statistiques de placement mesurent des prises en charge, pas leur caractère abusif. Le rapport de l’<a href="https://www.unicef.org/eca/reports/pathways-better-protection" target="_blank" rel="noopener noreferrer">UNICEF sur la protection de remplacement (nouvel onglet)</a> souligne les limites des comparaisons internationales. Nous ne disposons pas d’une étude comparative vérifiable permettant de classer la France parmi les pays d’Europe ayant le plus de « placements abusifs ». Nous ne présentons donc pas ce classement comme un fait.</p></div>
          <p>Notre démarche : recueillir les parcours, publier des statistiques prudentes après modération et préparer une pétition pour davantage de transparence, de continuité dans l’accompagnement et de respect des droits des enfants et des familles.</p>
          <Link className="text-link" href="/statistiques">Statistiques & préparation de la pétition →</Link>
        </section>

        <section id="sondage" className="survey-section section-space section-width">
          <div className="survey-intro"><p className="eyebrow">02 — VOTRE VOIX COMPTE</p><h2>Des histoires différentes.<br /><em>Une parole commune.</em></h2><p>Indiquez votre département, l’ASE dont vous dépendez et, si vous le souhaitez, l’année du premier placement de vos enfants, leur retour au foyer et les juridictions ou professionnels concernés. Ces contributions aideront à préparer des statistiques citoyennes et une future pétition.</p><ul className="survey-benefits"><li><span aria-hidden="true">◷</span> Deux étapes, des précisions facultatives</li><li><span aria-hidden="true">◇</span> Les noms restent strictement privés</li><li><span aria-hidden="true">♡</span> Une participation libre, révocable par code</li></ul><p className="survey-footnote">Seules les réponses approuvées sont comptabilisées. Aucun groupe de moins de dix réponses n’est publié. Ce sondage ne mesure pas les placements abusifs et n’établit aucune responsabilité individuelle.</p><Link className="text-link" href="/statistiques">Comprendre les statistiques →</Link></div>
          <Suspense fallback={<p role="status">Chargement du sondage…</p>}><PublishedSurvey /></Suspense>
        </section>
        <section id="resultats-sondage" className="section-width section-space"><p className="eyebrow">LES PARCOURS EN GRAPHIQUES</p><h2>Recueillir la parole.<br /><em>Donner à voir les parcours.</em></h2><p>Barres par département et par année, répartition des retours au foyer et tableaux accessibles. Les résultats apparaissent après ouverture de la publication et dès que les seuils de confidentialité sont atteints.</p><Suspense fallback={<p role="status">Chargement des graphiques…</p>}><SurveyResults compact /></Suspense></section>

        <section id="ressources" className="resources-section section-space">
          <div className="section-width">
            <div className="section-heading"><div><p className="eyebrow">03 — POUR ALLER PLUS LOIN</p><h2>S’informer. Être accompagné.<br /><em>Ne pas rester seul.</em></h2></div><p>Quelques portes d’entrée pour comprendre vos droits et trouver les bons interlocuteurs.</p></div>
            <div className="resources-grid">{resources.map((resource) => <a href={resource.url} target="_blank" rel="noopener noreferrer" className="resource-card" key={resource.number}><span className="resource-number">{resource.number}<span aria-hidden="true">↗</span></span><h3>{resource.title}</h3><p>{resource.text}</p><span className="resource-link">{resource.name}<span className="sr-only"> (nouvel onglet)</span></span></a>)}</div>
          </div>
        </section>
        <section className="share-section section-width"><div><p className="eyebrow">FAIRE VIVRE LA PAROLE</p><h2>Une histoire entendue,<br />c’est déjà <em>un lien qui se crée.</em></h2><p>Si notre témoignage vous touche, vous pouvez le partager.</p></div><ShareButton /></section>
      </main>
      <footer><div className="section-width footer-main"><a className="brand" href="#"><span className="brand-icon" aria-hidden="true">♡</span> Nos liens, notre histoire<span className="brand-dot">.</span></a><Link href="/statistiques">Statistiques & pétition</Link><Link href="/confidentialite">Confidentialité & vos réponses ↗</Link><Link href="/admin">Administration</Link></div><div className="section-width footer-bottom"><span>© 2026 · Nos liens, notre histoire</span><span>De la France à l’Asie, le lien demeure.</span></div></footer>
    </>
  );
}

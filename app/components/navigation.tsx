"use client";

import { useState } from "react";
import Link from "next/link";

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="section-width header-inner">
        <Link href="/" className="brand" aria-label="Nos liens, notre histoire — accueil"><span className="brand-icon" aria-hidden="true">♡</span> Nos liens, notre histoire<span className="brand-dot">.</span></Link>
        <button className="menu-toggle" type="button" aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen(!open)}>{open ? "Fermer ×" : "Menu ☰"}</button>
        <nav id="main-nav" className={open ? "main-nav is-open" : "main-nav"} aria-label="Navigation principale">
          <Link href="/#notre-histoire" onClick={() => setOpen(false)}>Notre histoire</Link>
          <Link href="/articles" onClick={() => setOpen(false)}>Le journal</Link>
          <Link href="/sondages" onClick={() => setOpen(false)}>Les sondages</Link>
          <Link href="/#ressources" onClick={() => setOpen(false)}>Ressources</Link>
          <Link href="/statistiques" onClick={() => setOpen(false)}>Statistiques & pétition</Link>
          <Link href="/#sondage" className="button button-small" onClick={() => setOpen(false)}>Participer au sondage <span aria-hidden="true">↗</span></Link>
        </nav>
      </div>
    </header>
  );
}

export function ShareButton() {
  return <button className="button button-primary" onClick={() => { window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.origin)}`, "_blank", "noopener,noreferrer"); }}>Partager sur Facebook <span aria-hidden="true">↗</span></button>;
}

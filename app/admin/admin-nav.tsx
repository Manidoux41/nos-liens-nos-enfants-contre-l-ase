"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["/admin", "Vue d’ensemble", "◈"],
  ["/admin/articles", "Articles", "▤"],
  ["/admin/categories", "Catégories", "▦"],
  ["/admin/medias", "Médiathèque", "▧"],
  ["/admin/sondage", "Sondage & réglages", "◎"],
] as const;

export function AdminNav() {
  const path = usePathname();
  if (path === "/admin/connexion") return null;
  return <nav className="editorial-nav" aria-label="Administration">{links.map(([url, name, icon]) => <Link key={url} href={url} aria-current={(url === "/admin" ? path === url : path.startsWith(url)) ? "page" : undefined}><span aria-hidden="true">{icon}</span>{name}</Link>)}</nav>;
}

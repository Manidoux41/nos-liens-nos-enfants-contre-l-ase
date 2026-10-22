import Link from "next/link";

export function Feedback({ error, success }: { error?: string; success?: string }) {
  return <>{error && <p className="form-error" role="alert">{error === "input" ? "Vérifiez les champs obligatoires, les longueurs et la confirmation demandée." : "L’opération n’a pas pu être confirmée. Vérifiez la connexion, les noms ou adresses déjà utilisés et les éléments liés. Si cet article a été modifié ailleurs, rechargez-le avant de réessayer."}</p>}{success && <p className="deletion-success" role="status">Vos modifications ont été enregistrées.</p>}</>;
}

export function PageHeading({ eyebrow, title, action, href }: { eyebrow: string; title: string; action?: string; href?: string }) {
  return <div className="admin-heading editorial-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{action && href && <Link className="button button-primary" href={href}>{action} ↗</Link>}</div>;
}

export function Pagination({ page, total, href }: { page: number; total: number; href: string }) {
  return <nav className="admin-pagination" aria-label="Pagination">{page > 1 && <Link href={`${href}page=${page - 1}`}>← Précédent</Link>}<span>Page {page} · {total} élément(s)</span>{page * 20 < total && <Link href={`${href}page=${page + 1}`}>Suivant →</Link>}</nav>;
}

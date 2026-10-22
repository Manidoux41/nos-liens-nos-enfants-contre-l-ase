import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Nos liens, notre histoire — Un témoignage de famille", template: "%s | Nos liens, notre histoire" },
  description: "De la France à l’Asie, une famille témoigne de son parcours auprès de l’ASE. Participez au sondage citoyen pour éclairer une future pétition.",
  robots: { index: false, follow: false },
  openGraph: { title: "Nos liens, notre histoire", description: "Derrière les dossiers, il y a nos vies. Un témoignage de famille, de la France à l’Asie.", locale: "fr_FR", type: "website" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body><a href="#contenu" className="skip-link">Aller au contenu</a>{children}</body>
    </html>
  );
}

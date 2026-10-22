import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = { title: "Administration", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <><header className="site-header"><div className="section-width header-inner"><Link className="brand" href="/">Nos liens, notre histoire<span className="brand-dot">.</span></Link><span className="eyebrow">ESPACE PRIVÉ</span></div></header><main id="contenu" className="section-width admin-page"><Suspense fallback={null}><AdminNav /></Suspense>{children}</main></>;
}

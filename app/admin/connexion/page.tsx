import { LoginForm } from "./login-form";

export default function LoginPage() {
  return <div className="login-card"><p className="eyebrow">ACCÈS RÉSERVÉ AUX ADMINISTRATEURS</p><h1>Garder un regard<br /><em>responsable.</em></h1><p>Connectez-vous avec le compte qui vous a été créé. Aucune inscription publique n’est possible.</p><LoginForm /></div>;
}

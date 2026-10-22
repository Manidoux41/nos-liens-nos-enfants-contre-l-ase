import { createAdmin } from "../lib/admin-accounts.ts";
import { database } from "../lib/db.ts";

try {
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "";
  await createAdmin(email, password, null, true);
  console.log("Premier administrateur créé. Retirez les variables BOOTSTRAP_ADMIN_* de votre environnement.");
} catch (error) {
  console.error("Création refusée. Vérifiez les identifiants (mot de passe de 16 à 128 caractères), la connexion et l’absence de compte existant.", error && typeof error === "object" && "code" in error ? error.code : "BOOTSTRAP_FAILED");
  process.exitCode = 1;
} finally {
  if (process.env.DATABASE_URL) await database().$disconnect();
}

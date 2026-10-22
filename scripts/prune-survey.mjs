import { pruneExpiredAnswers } from "../lib/survey-store.ts";
import { disconnectDatabase } from "../lib/db.ts";

try {
  await pruneExpiredAnswers();
  console.log("Nettoyage des réponses de plus de 365 jours terminé.");
} catch (error) {
  console.error("Le nettoyage du sondage a échoué.", error instanceof Error ? error.message : "Erreur inconnue");
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}

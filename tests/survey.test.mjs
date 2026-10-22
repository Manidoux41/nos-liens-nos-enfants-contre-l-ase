import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { departments, isSurveyAnswer, CONSENT_VERSION, optionLabel, aseOptions } from "../lib/survey.ts";
import { publishableGroups, validPetitionUrl } from "../lib/statistics.ts";
import { validCredentials } from "../lib/admin-accounts.ts";
import { chapters } from "../lib/story.ts";

const answer = (overrides = {}) => ({
  id: randomUUID(), residence: "28", ase: "41", judgeNames: "", socialWorkerNames: "",
  jurisdiction: "", privateConsent: false, consent: true, consentVersion: CONSENT_VERSION, ...overrides,
});

test("les 101 départements incluent la Corse et l’outre-mer sans doublons", () => {
  assert.equal(departments.length, 101);
  assert.equal(new Set(departments.map(([code]) => code)).size, 101);
  for (const code of ["2A", "2B", "971", "972", "973", "974", "976", "90"]) assert.ok(departments.some(([value]) => value === code));
  assert.ok(!departments.some(([value]) => value === "20"));
});

test("départements différents et champs facultatifs vides acceptés", () => {
  for (const value of [answer(), answer({ residence: "OTHER", ase: "UNKNOWN" }), answer({ residence: "2A", ase: "976" }), answer({ residence: "UNDISCLOSED", ase: "UNDISCLOSED" }), answer({ ase: "NONE" })]) assert.equal(isSurveyAnswer(value), true);
  assert.equal(optionLabel(aseOptions, "28"), "28 — Eure-et-Loir");
  assert.equal(optionLabel(aseOptions, "UNKNOWN"), "Je ne sais pas");
});

test("noms professionnels : consentement privé distinct et limites strictes", () => {
  assert.equal(isSurveyAnswer(answer({ judgeNames: "Juge fictif", privateConsent: true })), true);
  assert.equal(isSurveyAnswer(answer({ judgeNames: "Juge fictif" })), false);
  assert.equal(isSurveyAnswer(answer({ socialWorkerNames: "Intervenant fictif" })), false);
  assert.equal(isSurveyAnswer(answer({ jurisdiction: "Tribunal judiciaire de Test" })), true);
  for (const value of [
    answer({ judgeNames: "x".repeat(601), privateConsent: true }),
    answer({ socialWorkerNames: "x".repeat(601), privateConsent: true }),
    answer({ jurisdiction: "x".repeat(201) }),
    answer({ judgeNames: "<script>", privateConsent: true }),
    answer({ jurisdiction: "\u0000" }),
    answer({ privateConsent: "true" }),
    answer({ consentVersion: "2026-10-22" }),
  ]) assert.equal(isSurveyAnswer(value), false);
});

test("valeurs invalides et données personnelles supplémentaires refusées", () => {
  for (const value of [null, [], "28", answer({ residence: "20" }), answer({ ase: "999" }), answer({ consent: false }), answer({ consent: "true" }), answer({ id: "../../public/secret" }), answer({ email: "person@example.invalid" })]) assert.equal(isSurveyAnswer(value), false);
});

test("seuil public exact : 9 exclu, 10 et 11 inclus, pas de groupe sans libellé", () => {
  assert.deepEqual(publishableGroups([{ label: "Groupe A", count: 9 }, { label: "Groupe B", count: 10 }, { label: "Groupe C", count: 11 }, { label: "", count: 50 }]), [{ label: "Groupe B", count: 10 }, { label: "Groupe C", count: 11 }]);
});

test("pétition : HTTPS uniquement, sans identifiants dans l’URL", () => {
  for (const value of ["", "https://petitions.example.org/une-petition"]) assert.equal(validPetitionUrl(value), true);
  for (const value of ["javascript:alert(1)", "http://example.org", "https://user:pass@example.org", "https://localhost", "pas-un-lien"]) assert.equal(validPetitionUrl(value), false);
});

test("administrateurs : adresse valide et mots de passe de 16 à 128 caractères", () => {
  assert.equal(validCredentials("admin@example.invalid", "a".repeat(16)), true);
  assert.equal(validCredentials("admin@example.invalid", "a".repeat(15)), false);
  assert.equal(validCredentials("admin@example.invalid", "a".repeat(129)), false);
  assert.equal(validCredentials("pas-un-email", "a".repeat(16)), false);
});

test("le récit reste structuré en douze chapitres et situe la nouvelle vie en Asie", () => {
  assert.equal(chapters.length, 12);
  assert.equal(chapters[10].title, "Notre quotidien en Asie");
  assert.ok(chapters.every((chapter) => chapter.paragraphs.length >= 2));
});

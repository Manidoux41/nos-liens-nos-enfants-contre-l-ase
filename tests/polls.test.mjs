import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { normalizeSurveyEmail, EMAIL_CONSENT_VERSION } from "../lib/polls.ts";
import { surveyDigest, surveyEmailHash, sendSurveyCode } from "../lib/survey-email.ts";
import { isSurveyAnswer } from "../lib/survey.ts";
import { readJsonBody } from "../lib/json-body.ts";

test("normalisation e-mail : casse et espaces, sans fusion des alias ni valeurs invalides", () => {
  assert.equal(normalizeSurveyEmail(" Alice+famille@Example.ORG "), "alice+famille@example.org");
  for (const value of [null, "", "a@localhost", ".a@example.org", "a..b@example.org", "a.@example.org", "a\r\n@example.org", "é@example.org", "a".repeat(65) + "@example.org"]) assert.equal(normalizeSurveyEmail(value), null);
});

test("HMAC stable par sondage, secret obligatoire et consentement e-mail versionné", () => {
  process.env.SURVEY_EMAIL_SECRET = randomBytes(48).toString("hex");
  const poll = randomUUID();
  const hash = surveyEmailHash("Alice@Example.org", poll);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hash, surveyEmailHash(" alice@example.org ", poll));
  assert.notEqual(hash, surveyEmailHash("alice@example.org", randomUUID()));
  assert.notEqual(hash, surveyEmailHash("alice+alias@example.org", poll));
  assert.notEqual(hash, surveyDigest("alice@example.org"));
  assert.equal(isSurveyAnswer({ id: randomUUID(), residence: "28", ase: "41", placementYear: 2020, returnHome: "ALL", judgeNames: "", socialWorkerNames: "", jurisdiction: "", consent: true, privateConsent: false, consentVersion: EMAIL_CONSENT_VERSION }), true);
  delete process.env.SURVEY_EMAIL_SECRET;
  assert.throws(() => surveyEmailHash("alice@example.org", poll), /SURVEY_EMAIL_SECRET/);
});

test("Resend : destinataire unique, aucun code retourné, erreurs explicites, aucun e-mail réel", async (t) => {
  const original = { key: process.env.RESEND_API_KEY, from: process.env.SURVEY_EMAIL_FROM };
  t.after(() => {
    for (const [name, value] of [["RESEND_API_KEY", original.key], ["SURVEY_EMAIL_FROM", original.from]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  process.env.RESEND_API_KEY = "test-never-sent";
  process.env.SURVEY_EMAIL_FROM = "Sondages <test@example.invalid>";
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls++;
    assert.equal(url, "https://api.resend.com/emails");
    const body = JSON.parse(options.body);
    assert.deepEqual(body.to, ["alice@example.invalid"]);
    assert.match(body.text, /12345678/);
    assert.ok(options.signal);
    return Response.json({ id: randomUUID() });
  });
  assert.equal(await sendSurveyCode("alice@example.invalid", "12345678"), undefined);
  assert.equal(calls, 1);
  globalThis.fetch.mock.mockImplementation(async () => Response.json({ error: "provider unavailable" }, { status: 503 }));
  await assert.rejects(sendSurveyCode("alice@example.invalid", "12345678"), { status: 503 });
  globalThis.fetch.mock.mockImplementation(async () => Response.json({}));
  await assert.rejects(sendSurveyCode("alice@example.invalid", "12345678"), { status: 503 });
  delete process.env.RESEND_API_KEY;
  await assert.rejects(sendSurveyCode("alice@example.invalid", "12345678"), { status: 503 });
});

test("lecteur JSON partagé : borne réelle du flux, format et type contrôlés", async () => {
  const request = (body, type = "application/json") => new Request("https://example.invalid", { method: "POST", headers: { "Content-Type": type }, body });
  assert.deepEqual(await readJsonBody(request('{"a":1}')), { a: 1 });
  await assert.rejects(readJsonBody(request("x".repeat(1025)), 1024), /TOO_LARGE/);
  await assert.rejects(readJsonBody(request("{}" , "text/plain")), /CONTENT_TYPE/);
  await assert.rejects(readJsonBody(request("{")));
});

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import { CONSENT_VERSION } from "../lib/survey.ts";
import { database } from "../lib/db.ts";
import { createAdmin } from "../lib/admin-accounts.ts";
import { saveAnswer, deleteAnswer, pruneExpiredAnswers } from "../lib/survey-store.ts";
import { deletionHash } from "../lib/request-security.ts";

const origin = "http://127.0.0.1:3118";
const url = process.env.TEST_DATABASE_URL;
if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname) || new URL(url).pathname !== "/ase_app_test") {
  throw new Error("TEST_DATABASE_URL doit pointer vers une base locale dédiée nommée ase_app_test. Ne jamais utiliser une base réelle.");
}
process.env.DATABASE_URL = url;
const db = database();
const answer = (overrides = {}) => ({
  id: randomUUID(), residence: "28", ase: "41", judgeNames: "", socialWorkerNames: "",
  jurisdiction: "", privateConsent: false, consent: true, consentVersion: CONSENT_VERSION, ...overrides,
});

test("PostgreSQL + HTTP : authentification, confidentialité, modération, seuil, persistance et rétention", { timeout: 90000 }, async (t) => {
  let server;
  let serverOutput = "";
  const password = randomBytes(24).toString("base64url");
  const secret = randomBytes(48).toString("base64url");
  const cronSecret = randomBytes(40).toString("hex");
  const email = `admin-${randomUUID()}@example.invalid`;
  const secondEmail = `operator-${randomUUID()}@example.invalid`;
  const firstId = await createAdmin(email, password, null);
  await assert.rejects(createAdmin(`bootstrap-${randomUUID()}@example.invalid`, password, null, true), /Bootstrap is only allowed/);
  let cookie = "";
  const fixtures = [];
  const jurisdictionId = randomUUID();
  async function stop() {
    if (server && server.exitCode === null) {
      const exited = once(server, "exit"); server.kill("SIGTERM"); await exited;
    }
  }
  async function start() {
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", "3118", "--hostname", "127.0.0.1"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: url, SITE_ORIGIN: origin, BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: secret, CRON_SECRET: cronSecret },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await new Promise((resolve, reject) => {
      let output = "";
      const timeout = setTimeout(() => reject(new Error(`Server startup timed out: ${output}`)), 15000);
      server.on("error", (error) => { clearTimeout(timeout); reject(error); });
      server.on("exit", (code) => { clearTimeout(timeout); reject(new Error(`Server exited (${code}): ${output}`)); });
      server.stderr.on("data", (data) => { output += data.toString(); serverOutput += data.toString(); });
      server.stdout.on("data", (data) => {
        output += data.toString();
        if (output.includes("Ready in")) { clearTimeout(timeout); resolve(); }
      });
    });
  }
  function send(body, options = {}, endpoint = "/api/sondage") {
    return fetch(`${origin}${endpoint}`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify(body), ...options,
    });
  }
  t.after(async () => {
    await stop();
    await db.surveyResponse.deleteMany({ where: { deletionHash: { in: fixtures.map((value) => deletionHash(value.id)) } } });
    await db.jurisdiction.deleteMany({ where: { id: jurisdictionId } });
    await db.user.deleteMany({ where: { email: { in: [email, secondEmail] } } });
    await db.siteSettings.deleteMany({ where: { id: 1 } });
    await db.requestBucket.deleteMany();
    await db.rateLimit.deleteMany();
    await db.auditLog.deleteMany();
    await db.$disconnect();
  });
  await start();
  for (const route of ["/", "/confidentialite", "/statistiques", "/admin/connexion", "/family-landscape.svg"]) assert.equal((await fetch(`${origin}${route}`)).status, 200, route);
  const html = await (await fetch(origin)).text();
  assert.match(html, /lang="fr"/);
  assert.match(html, /depuis l’Asie/);
  assert.doesNotMatch(html, /Noah|Izaach|Lory|Loukas|Illyana|Cabecinha|Boché|Wanza/);
  const loginHtml = await (await fetch(`${origin}/admin/connexion`)).text();
  const loginFormTag = loginHtml.match(/<form\b[^>]*>/)?.[0];
  assert.ok(loginFormTag);
  assert.match(loginFormTag, /method="post"/);
  assert.match(loginFormTag, /action="\/api\/auth\/sign-in\/email"/);
  const anonymous = await (await fetch(`${origin}/admin`, { redirect: "manual" })).text();
  assert.doesNotMatch(anonymous, new RegExp(email));
  assert.match(anonymous, /\/admin\/connexion/);
  assert.equal((await send({}, {}, "/api/auth/sign-up/email")).status, 404);
  assert.equal((await send({}, {}, "/api/auth/change-password")).status, 404);
  assert.equal((await fetch(`${origin}/api/cron/retention`)).status, 401);
  assert.equal((await send({ email, password }, { headers: { "Content-Type": "application/json", Origin: "https://example.invalid" } }, "/api/auth/sign-in/email")).status, 403);
  const badLogin = await send({ email, password: "incorrect-password" }, {}, "/api/auth/sign-in/email");
  assert.equal(badLogin.status, 401);
  const login = await send({ email, password, rememberMe: false }, {}, "/api/auth/sign-in/email");
  assert.equal(login.status, 200, `${await login.clone().text()}\n${serverOutput}`);
  const setCookies = login.headers.getSetCookie();
  assert.ok(setCookies.some((value) => value.includes("HttpOnly") && value.includes("SameSite=Lax")));
  cookie = setCookies.map((value) => value.split(";")[0]).join("; ");
  assert.ok(cookie.includes("session_token="));
  const dashboard = await (await fetch(`${origin}/admin`, { headers: { Cookie: cookie } })).text();
  assert.match(dashboard, new RegExp(email));
  function findAction(html, marker) {
    const form = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map((match) => match[1]).find((content) => content.includes(marker));
    assert.ok(form, `real form found for ${marker}`);
    const name = form.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
    assert.ok(name, "real Next.js action found");
    return name;
  }
  async function act(action, fields, authenticated = true) {
    const data = new FormData();
    data.set(action, "");
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return fetch(`${origin}/admin`, { method: "POST", headers: { Origin: origin, ...(authenticated ? { Cookie: cookie } : {}) }, body: data, redirect: "manual" });
  }
  const createAccount = await act(findAction(dashboard, 'id="new-email"'), { email: secondEmail, password });
  assert.equal(createAccount.status, 303);
  assert.match(createAccount.headers.get("location"), /success=1/);
  const secondUser = await db.user.findUniqueOrThrow({ where: { email: secondEmail } });
  const refreshedDashboard = await (await fetch(`${origin}/admin`, { headers: { Cookie: cookie } })).text();
  const secondForm = [...refreshedDashboard.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map((match) => match[1]).find((form) => form.includes(`value="${secondUser.id}"`) && form.includes('name="operation"'));
  const updateAccountAction = secondForm?.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
  assert.ok(updateAccountAction);
  const secondLogin = await send({ email: secondEmail, password }, {}, "/api/auth/sign-in/email");
  assert.equal(secondLogin.status, 200);
  assert.equal(await db.session.count({ where: { userId: secondUser.id } }), 1);
  const resetPassword = await act(updateAccountAction, { id: secondUser.id, operation: "PASSWORD", password: randomBytes(24).toString("hex") });
  assert.equal(resetPassword.status, 303);
  assert.match(resetPassword.headers.get("location"), /success=1/);
  assert.equal(await db.session.count({ where: { userId: secondUser.id } }), 0);
  const disableAccount = await act(updateAccountAction, { id: secondUser.id, operation: "DISABLE" });
  assert.equal(disableAccount.status, 303);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: secondUser.id } })).active, false);

  const value = answer({ judgeNames: "JUGE_SYNTHETIQUE_PRIVE", socialWorkerNames: "SOCIAL_SYNTHETIQUE_PRIVE", jurisdiction: "LIBELLE_DECLARE_PRIVE", privateConsent: true });
  fixtures.push(value);
  assert.equal((await send({ ...value, consent: false })).status, 400);
  assert.equal((await send({ ...value, privateConsent: false })).status, 400);
  assert.equal((await send({ ...value, ase: "999" })).status, 400);
  assert.equal((await send(value, { headers: { "Content-Type": "application/json", Origin: "https://example.invalid" } })).status, 403);
  assert.equal((await send(value, { headers: { "Content-Type": "text/plain", Origin: origin } })).status, 415);
  assert.equal((await send(value, { body: "{" })).status, 400);
  assert.equal((await send(value, { body: "x".repeat(8193) })).status, 413);
  const response = await send(value);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { id: value.id });
  assert.equal((await send(value)).status, 200);
  const stored = await db.surveyResponse.findUniqueOrThrow({ where: { deletionHash: deletionHash(value.id) } });
  assert.notEqual(stored.id, value.id);
  assert.equal(stored.status, "PENDING");
  assert.equal(stored.judgeNames, value.judgeNames);
  const before = await (await fetch(`${origin}/statistiques`)).text();
  assert.doesNotMatch(before, /JUGE_SYNTHETIQUE_PRIVE|SOCIAL_SYNTHETIQUE_PRIVE|LIBELLE_DECLARE_PRIVE/);
  const privateDashboard = await (await fetch(`${origin}/admin`, { headers: { Cookie: cookie } })).text();
  assert.match(privateDashboard, /JUGE_SYNTHETIQUE_PRIVE/);
  assert.doesNotMatch(privateDashboard, new RegExp(stored.deletionHash));
  const moderationForm = [...privateDashboard.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map((match) => match[1]).find((form) => form.includes(`value="${stored.id}"`) && form.includes('name="decision"'));
  assert.ok(moderationForm, "a real moderation form is rendered");
  const actionName = moderationForm.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
  assert.ok(actionName, "a real Next.js server action is present");
  function moderationData(decision) {
    const data = new FormData();
    data.set(actionName, "");
    data.set("id", stored.id);
    data.set("decision", decision);
    data.set("jurisdictionId", "");
    return data;
  }
  const unauthorizedAction = await fetch(`${origin}/admin`, { method: "POST", headers: { Origin: origin }, body: moderationData("APPROVED"), redirect: "manual" });
  assert.equal(unauthorizedAction.status, 303);
  assert.match(unauthorizedAction.headers.get("location"), /\/admin\/connexion/);
  assert.equal((await db.surveyResponse.findUniqueOrThrow({ where: { id: stored.id } })).status, "PENDING");
  const approvedAction = await fetch(`${origin}/admin`, { method: "POST", headers: { Origin: origin, Cookie: cookie }, body: moderationData("APPROVED"), redirect: "manual" });
  assert.equal(approvedAction.status, 303);
  assert.match(approvedAction.headers.get("location"), /success=1/);
  const moderated = await db.surveyResponse.findUniqueOrThrow({ where: { id: stored.id } });
  assert.equal(moderated.status, "APPROVED");
  assert.equal(moderated.moderatedById, firstId);
  assert.ok(await db.auditLog.count({ where: { actorId: firstId, action: "RESPONSE_APPROVED", targetId: stored.id } }));
  await stop();
  await start();
  assert.equal((await send(value)).status, 200, "contribution survives web server restart");
  const concurrent = answer(); fixtures.push(concurrent);
  const results = await Promise.all(Array.from({ length: 5 }, () => saveAnswer(concurrent)));
  assert.equal(results.filter((result) => result === "saved").length, 1);
  await deleteAnswer(concurrent.id);

  await db.jurisdiction.create({ data: { id: jurisdictionId, name: "Tribunal judiciaire synthétique" } });
  const settingsAction = findAction(dashboard, 'name="petitionUrl"');
  const invalidSettings = await act(settingsAction, { petitionTitle: "Une pétition synthétique", petitionUrl: "javascript:alert(1)", statsPublished: "on" });
  assert.match(invalidSettings.headers.get("location"), /error=input/);
  assert.equal(await db.siteSettings.count(), 0);
  const settingsSaved = await act(settingsAction, { petitionTitle: "Une pétition synthétique", petitionUrl: "https://petitions.example.invalid/une-petition", statsPublished: "on" });
  assert.match(settingsSaved.headers.get("location"), /success=1/);
  assert.equal((await db.siteSettings.findUniqueOrThrow({ where: { id: 1 } })).statsPublished, true);
  for (let i = 0; i < 9; i++) {
    const fixture = answer({ residence: "90", ase: "90" }); fixtures.push(fixture);
    await saveAnswer(fixture);
    await db.surveyResponse.update({ where: { deletionHash: deletionHash(fixture.id) }, data: { status: "APPROVED", jurisdictionId } });
  }
  const belowThreshold = await (await fetch(`${origin}/statistiques`)).text();
  assert.doesNotMatch(belowThreshold, /Tribunal judiciaire synthétique/);
  const tenth = answer({ residence: "90", ase: "90" }); fixtures.push(tenth);
  await saveAnswer(tenth);
  await db.surveyResponse.update({ where: { deletionHash: deletionHash(tenth.id) }, data: { status: "APPROVED", jurisdictionId } });
  const atThreshold = await (await fetch(`${origin}/statistiques`)).text();
  assert.match(atThreshold, /Tribunal judiciaire synthétique/);
  assert.match(atThreshold, /10<!-- --> réponses/);
  assert.doesNotMatch(atThreshold, /JUGE_SYNTHETIQUE_PRIVE|SOCIAL_SYNTHETIQUE_PRIVE|LIBELLE_DECLARE_PRIVE/);
  await deleteAnswer(tenth.id);
  const withdrawn = await (await fetch(`${origin}/statistiques`)).text();
  assert.doesNotMatch(withdrawn, /Tribunal judiciaire synthétique/);

  await db.surveyResponse.update({ where: { deletionHash: deletionHash(value.id) }, data: { expiresAt: new Date(Date.now() - 1000) } });
  assert.ok(await pruneExpiredAnswers() >= 1);
  assert.equal(await db.surveyResponse.count({ where: { deletionHash: deletionHash(value.id) } }), 0);
  assert.equal((await send({ id: value.id }, { method: "DELETE" })).status, 200);
  assert.equal((await fetch(`${origin}/api/cron/retention`, { headers: { Authorization: `Bearer ${cronSecret}` } })).status, 200);
  const ownNewPassword = randomBytes(24).toString("hex");
  const ownPasswordChanged = await act(findAction(dashboard, 'name="currentPassword"'), { currentPassword: password, password: ownNewPassword });
  assert.equal(ownPasswordChanged.status, 303);
  assert.match(ownPasswordChanged.headers.get("location"), /\/admin\/connexion/);
  assert.equal(await db.session.count({ where: { userId: firstId } }), 0);
  const reconnect = await send({ email, password: ownNewPassword }, {}, "/api/auth/sign-in/email");
  assert.equal(reconnect.status, 200, `${await reconnect.clone().text()}\n${serverOutput}`);
  cookie = reconnect.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  await db.user.update({ where: { id: firstId }, data: { active: false } });
  const disabled = await (await fetch(`${origin}/admin`, { headers: { Cookie: cookie }, redirect: "manual" })).text();
  assert.doesNotMatch(disabled, /JUGE_SYNTHETIQUE_PRIVE|Connecté :/);
  const logout = await send({}, { headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie } }, "/api/auth/sign-out");
  assert.equal(logout.status, 200);
});

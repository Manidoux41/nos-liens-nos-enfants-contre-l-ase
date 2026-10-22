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
  const categorySlug = `editorial-${randomUUID()}`;
  const articleSlug = `article-${randomUUID()}`;
  const mediaId = randomUUID();
  async function stop() {
    if (server && server.exitCode === null) {
      const exited = once(server, "exit"); server.kill("SIGTERM"); await exited;
    }
  }
  async function start() {
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", "3118", "--hostname", "127.0.0.1"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: url, SITE_ORIGIN: origin, BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: secret, CRON_SECRET: cronSecret, BLOB_READ_WRITE_TOKEN: "" },
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
    await db.article.deleteMany({ where: { slug: articleSlug } });
    await db.category.deleteMany({ where: { slug: categorySlug } });
    await db.media.deleteMany({ where: { id: mediaId } });
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
  assert.equal(badLogin.status, 401, `${await badLogin.clone().text()}\n${serverOutput}`);
  const login = await send({ email, password, rememberMe: false }, {}, "/api/auth/sign-in/email");
  assert.equal(login.status, 200, `${await login.clone().text()}\n${serverOutput}`);
  const setCookies = login.headers.getSetCookie();
  assert.ok(setCookies.some((value) => value.includes("HttpOnly") && value.includes("SameSite=Lax")));
  cookie = setCookies.map((value) => value.split(";")[0]).join("; ");
  assert.ok(cookie.includes("session_token="));
  const overview = await (await fetch(`${origin}/admin`, { headers: { Cookie: cookie } })).text();
  assert.match(overview, /Vos derniers articles/);
  const dashboard = await (await fetch(`${origin}/admin/sondage`, { headers: { Cookie: cookie } })).text();
  assert.match(dashboard, new RegExp(email));
  const actionRoutes = new Map();
  function findAction(html, marker, route = "/admin/sondage") {
    const form = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map((match) => match[1]).find((content) => content.includes(marker));
    assert.ok(form, `real form found for ${marker}`);
    const name = form.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
    assert.ok(name, "real Next.js action found");
    actionRoutes.set(name, route);
    return name;
  }
  async function act(action, fields, authenticated = true) {
    const data = new FormData();
    data.set(action, "");
    for (const [key, value] of Object.entries(fields)) {
      if (Array.isArray(value)) for (const item of value) data.append(key, item);
      else data.set(key, value);
    }
    return fetch(`${origin}${actionRoutes.get(action) || "/admin/sondage"}`, { method: "POST", headers: { Origin: origin, ...(authenticated ? { Cookie: cookie } : {}) }, body: data, redirect: "manual" });
  }
  const adminHtml = async (route) => (await fetch(`${origin}${route}`, { headers: { Cookie: cookie } })).text();
  for (const route of ["/admin/articles", "/admin/categories", "/admin/medias", "/admin/articles/nouveau"]) {
    assert.match(await (await fetch(`${origin}${route}`, { redirect: "manual" })).text(), /\/admin\/connexion/);
  }
  const categoryAction = findAction(await adminHtml("/admin/categories"), 'id="category-name"', "/admin/categories");
  assert.match((await act(categoryAction, { name: "Catégorie synthétique", slug: categorySlug }, false)).headers.get("location"), /\/admin\/connexion/);
  assert.equal(await db.category.count({ where: { slug: categorySlug } }), 0);
  assert.match((await act(categoryAction, { name: "Catégorie synthétique", slug: categorySlug })).headers.get("location"), /success=1/);
  const category = await db.category.findUniqueOrThrow({ where: { slug: categorySlug } });
  const deleteCategoryAction = findAction(await adminHtml("/admin/categories"), "Je confirme la suppression.", "/admin/categories");
  assert.match((await act(categoryAction, { id: category.id, name: "Catégorie renommée", slug: categorySlug })).headers.get("location"), /success=1/);
  assert.equal((await db.category.findUniqueOrThrow({ where: { id: category.id } })).name, "Catégorie renommée");
  await db.media.create({ data: { id: mediaId, title: "Média synthétique privé", alt: "Illustration de test", caption: "", pathname: `editorial-test/${mediaId}.png`, mimeType: "image/png", size: 20 } });
  const deleteMediaAction = findAction(await adminHtml("/admin/medias"), "Confirmer la suppression", "/admin/medias");
  const mediaRoute = `/medias/${mediaId}`;
  assert.equal((await fetch(`${origin}${mediaRoute}`)).status, 404, "an unattached private file cannot be read anonymously");
  assert.equal((await fetch(`${origin}/api/admin/medias`, { method: "POST", headers: { Origin: origin }, body: "not an image" })).status, 401);
  const upload = (body, source = origin) => fetch(`${origin}/api/admin/medias`, { method: "POST", headers: { Origin: source, Cookie: cookie }, body });
  assert.equal((await upload("<svg>not an accepted image</svg>")).status, 415);
  assert.equal((await upload("invalid", "https://example.invalid")).status, 403);
  assert.equal((await upload(Buffer.alloc(4194305))).status, 413, "enforce exact 4 MiB maximum");
  const maxUpload = Buffer.alloc(4194304);
  Buffer.from([137,80,78,71,13,10,26,10]).copy(maxUpload);
  const unconfiguredUpload = await upload(maxUpload);
  assert.equal(unconfiguredUpload.status, 503, "exactly 4 MiB passes size/signature validation, but cloud configuration is required");
  assert.match((await unconfiguredUpload.json()).error, /BLOB_READ_WRITE_TOKEN/);
  const createArticleAction = findAction(await adminHtml("/admin/articles/nouveau"), 'id="article-title"', "/admin/articles/nouveau");
  const fields = { title: "ARTICLE_SYNTHETIQUE_CONFIDENTIEL", slug: articleSlug, excerpt: "Résumé éditorial synthétique de validation.", content: "Premier paragraphe synthétique.\n\n<script>contenu non exécuté</script>", categoryId: category.id, status: "DRAFT", mediaIds: [mediaId] };
  assert.match((await act(createArticleAction, fields, false)).headers.get("location"), /\/admin\/connexion/);
  assert.equal(await db.article.count({ where: { slug: articleSlug } }), 0);
  assert.match((await act(createArticleAction, fields)).headers.get("location"), /success=1/);
  let article = await db.article.findUniqueOrThrow({ where: { slug: articleSlug } });
  const articlePath = `/admin/articles/${article.id}`;
  assert.doesNotMatch(await (await fetch(`${origin}/articles`)).text(), /ARTICLE_SYNTHETIQUE_CONFIDENTIEL/);
  assert.doesNotMatch(await (await fetch(`${origin}/articles/${articleSlug}`)).text(), /ARTICLE_SYNTHETIQUE_CONFIDENTIEL/);
  assert.equal((await fetch(`${origin}${mediaRoute}`)).status, 404, "draft association does not publish a file");
  assert.match((await act(deleteCategoryAction, { id: category.id, confirm: "on" })).headers.get("location"), /error=operation/);
  assert.equal(await db.category.count({ where: { id: category.id } }), 1);
  const saveArticleAction = findAction(await adminHtml(articlePath), 'id="article-title"', articlePath);
  assert.match((await act(saveArticleAction, { ...fields, id: article.id, version: article.version, status: "PUBLISHED" })).headers.get("location"), /success=1/);
  article = await db.article.findUniqueOrThrow({ where: { slug: articleSlug } });
  assert.equal(article.version, 2);
  assert.equal(article.status, "PUBLISHED");
  assert.ok(article.publishedAt);
  const publicArticle = await (await fetch(`${origin}/articles/${articleSlug}`)).text();
  assert.match(publicArticle, /ARTICLE_SYNTHETIQUE_CONFIDENTIEL/);
  assert.match(publicArticle, /&lt;script&gt;/);
  assert.doesNotMatch(publicArticle, /<script>contenu non exécuté<\/script>/);
  assert.match(publicArticle, new RegExp(mediaRoute));
  assert.match((await act(deleteMediaAction, { id: mediaId, confirm: "on" })).headers.get("location"), /error=operation/);
  assert.equal((await db.media.findUniqueOrThrow({ where: { id: mediaId } })).deleting, false, "a linked file cannot enter deletion");
  assert.equal((await fetch(`${origin}${mediaRoute}`)).status, 503, "a published relation reaches the private store, whose token is deliberately absent in isolated tests");
  assert.match(await (await fetch(`${origin}/articles?categorie=${categorySlug}`)).text(), /ARTICLE_SYNTHETIQUE_CONFIDENTIEL/);
  assert.doesNotMatch(await (await fetch(`${origin}/articles?categorie=aucune-categorie`)).text(), /ARTICLE_SYNTHETIQUE_CONFIDENTIEL/);
  assert.match((await act(saveArticleAction, { ...fields, id: article.id, version: 1, title: "Ne doit pas écraser le texte" })).headers.get("location"), /error=operation/);
  assert.equal((await db.article.findUniqueOrThrow({ where: { id: article.id } })).title, fields.title);
  const mediaHtml = await adminHtml("/admin/medias");
  assert.match((await act(findAction(mediaHtml, `id="title-${mediaId}"`, "/admin/medias"), { id: mediaId, title: "Média renommé", alt: "Texte accessible", caption: "Crédit de test" })).headers.get("location"), /success=1/);
  assert.equal((await db.media.findUniqueOrThrow({ where: { id: mediaId } })).alt, "Texte accessible");
  assert.match((await act(saveArticleAction, { ...fields, id: article.id, version: article.version, excerpt: "Résumé modifié après publication.", status: "DRAFT" })).headers.get("location"), /success=1/);
  assert.equal((await db.article.findUniqueOrThrow({ where: { id: article.id } })).excerpt, "Résumé modifié après publication.");
  assert.doesNotMatch(await (await fetch(`${origin}/articles/${articleSlug}`)).text(), /ARTICLE_SYNTHETIQUE_CONFIDENTIEL/);
  const privateMedia = await fetch(`${origin}${mediaRoute}`);
  assert.equal(privateMedia.status, 404, "unpublishing revokes anonymous access before contacting Blob");
  assert.match(privateMedia.headers.get("cache-control"), /no-store/);
  article = await db.article.findUniqueOrThrow({ where: { id: article.id } });
  const editorHtml = await adminHtml(articlePath);
  assert.match((await act(findAction(editorHtml, "Supprimer définitivement", articlePath), { id: article.id, version: article.version, confirm: "on" })).headers.get("location"), /success=1/);
  assert.equal(await db.articleMedia.count({ where: { articleId: article.id } }), 0);
  assert.equal(await db.media.count({ where: { id: mediaId } }), 1, "article deletion preserves library files");
  assert.match((await act(deleteMediaAction, { id: mediaId, confirm: "on" })).headers.get("location"), /error=operation/);
  assert.equal((await db.media.findUniqueOrThrow({ where: { id: mediaId } })).deleting, true, "a cloud deletion failure remains explicitly retryable");
  assert.match(await adminHtml("/admin/medias"), /Réessayer la suppression/);
  assert.match((await act(deleteCategoryAction, { id: category.id, confirm: "on" })).headers.get("location"), /success=1/);
  assert.equal(await db.category.count({ where: { id: category.id } }), 0);
  assert.ok(await db.auditLog.count({ where: { actorId: firstId, action: "ARTICLE_DELETE" } }));
  const createAccount = await act(findAction(dashboard, 'id="new-email"'), { email: secondEmail, password });
  assert.equal(createAccount.status, 303);
  assert.match(createAccount.headers.get("location"), /success=1/);
  const secondUser = await db.user.findUniqueOrThrow({ where: { email: secondEmail } });
  const refreshedDashboard = await (await fetch(`${origin}/admin/sondage`, { headers: { Cookie: cookie } })).text();
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
  const privateDashboard = await (await fetch(`${origin}/admin/sondage`, { headers: { Cookie: cookie } })).text();
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
  const unauthorizedAction = await fetch(`${origin}/admin/sondage`, { method: "POST", headers: { Origin: origin }, body: moderationData("APPROVED"), redirect: "manual" });
  assert.equal(unauthorizedAction.status, 303);
  assert.match(unauthorizedAction.headers.get("location"), /\/admin\/connexion/);
  assert.equal((await db.surveyResponse.findUniqueOrThrow({ where: { id: stored.id } })).status, "PENDING");
  const approvedAction = await fetch(`${origin}/admin/sondage`, { method: "POST", headers: { Origin: origin, Cookie: cookie }, body: moderationData("APPROVED"), redirect: "manual" });
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

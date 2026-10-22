import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDatabaseUrl } from "../lib/database-url.ts";

const database = "postgresql://database.example.invalid/app";
const postgres = "postgres://postgres.example.invalid/app";
const prisma = "postgresql://prisma.example.invalid/app";
const direct = "postgresql://direct.example.invalid/app";

test("chaque variable PostgreSQL est utilisable seule pour migrer et exécuter", () => {
  for (const name of ["DATABASE_URL", "POSTGRES_URL", "PRISMA_DATABASE_URL", "DIRECT_URL"]) {
    for (const purpose of ["migration", "runtime"]) {
      assert.equal(resolveDatabaseUrl({ [name]: database }, purpose), database);
    }
  }
});

test("priorités explicites : DIRECT_URL en migration, DATABASE_URL en exécution", () => {
  const env = { DATABASE_URL: database, POSTGRES_URL: postgres, PRISMA_DATABASE_URL: prisma, DIRECT_URL: direct };
  assert.equal(resolveDatabaseUrl(env, "migration"), direct);
  assert.equal(resolveDatabaseUrl(env, "runtime"), database);
  assert.equal(resolveDatabaseUrl({ ...env, DIRECT_URL: "", DATABASE_URL: "" }, "migration"), postgres);
  assert.equal(resolveDatabaseUrl({ PRISMA_DATABASE_URL: `  ${prisma}  ` }, "migration"), prisma);
});

test("génération sans connexion possible, variables vides ignorées", () => {
  assert.equal(resolveDatabaseUrl({}, "migration"), undefined);
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: " ", POSTGRES_URL: "" }, "runtime"), undefined);
});

test("URL proxy : utilisation d’une vraie URL PostgreSQL ou erreur explicite", () => {
  for (const proxy of ["prisma://proxy.example.invalid/?api_key=private", "prisma+postgres://proxy.example.invalid/?api_key=private"]) {
    assert.equal(resolveDatabaseUrl({ DATABASE_URL: proxy, POSTGRES_URL: postgres }, "migration"), postgres);
    assert.equal(resolveDatabaseUrl({ PRISMA_DATABASE_URL: proxy, DATABASE_URL: database }, "runtime"), database);
    assert.throws(() => resolveDatabaseUrl({ PRISMA_DATABASE_URL: proxy }, "migration"), /Prisma proxy URL/);
  }
});

test("une mauvaise URL ne provoque pas de basculement silencieux et ne divulgue aucun secret", () => {
  for (const value of ["invalid-private-secret", "https://user:private-secret@example.invalid", "postgresql:///app"]) {
    assert.throws(() => resolveDatabaseUrl({ DATABASE_URL: value, POSTGRES_URL: postgres }, "migration"), (error) => {
      assert.match(error.message, /DATABASE_URL/);
      assert.ok(!error.message.includes("private-secret"));
      return true;
    });
  }
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { slugify, validSlug, validText, detectMedia, MAX_MEDIA_BYTES } from "../lib/editorial.ts";

test("adresses lisibles sans accents ni caractères actifs", () => {
  assert.equal(slugify("  Nos récits : l’ASE & l’Asie  "), "nos-recits-l-ase-l-asie");
  assert.ok(validSlug("notre-histoire-42", 120));
  for (const invalid of ["a", "-abc", "abc-", "a--b", "../admin", "été", "a/b", ""]) assert.equal(validSlug(invalid, 120), false);
  assert.ok(validSlug("a".repeat(120), 120));
  assert.equal(validSlug("a".repeat(121), 120), false);
});

test("bornes du texte et caractères de contrôle", () => {
  assert.ok(validText("Paragraphe\n\nSuivant", 3, 30));
  assert.ok(validText("", 0, 500));
  assert.equal(validText("  ", 2, 10), false);
  assert.equal(validText("a".repeat(501), 0, 500), false);
  assert.equal(validText("abc\u0000def", 2, 50), false);
  assert.equal(MAX_MEDIA_BYTES, 4194304);
});

test("signatures acceptées, sans confiance dans une extension ou un type déclaré", () => {
  assert.deepEqual(detectMedia(Buffer.from([255,216,255,...Array(12).fill(0)])), { mimeType: "image/jpeg", extension: "jpg" });
  assert.deepEqual(detectMedia(Buffer.from([137,80,78,71,13,10,26,10,...Array(12).fill(0)])), { mimeType: "image/png", extension: "png" });
  assert.deepEqual(detectMedia(Buffer.from("RIFFxxxxWEBP")), { mimeType: "image/webp", extension: "webp" });
  assert.deepEqual(detectMedia(Buffer.from("%PDF-1.7\nbody")), { mimeType: "application/pdf", extension: "pdf" });
  for (const invalid of ["", "<svg>image</svg>", "<html>not a JPEG</html>", "RIFFxxxxWAVE", "GIF89abcdefgh"]) assert.equal(detectMedia(Buffer.from(invalid)), null);
});

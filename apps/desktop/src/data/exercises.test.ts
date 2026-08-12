import assert from "node:assert/strict";
import test from "node:test";
import { CATEGORIES, EQUIPMENT_KINDS, EXERCISES } from "./exercises.ts";

// Must stay a superset-safe match for YOUTUBE_ID in ExerciseBrowser.tsx: a URL
// this rejects renders as "No video yet." instead of a player.
const WATCH_URL = /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/;

test("every exercise has an embeddable demo video", () => {
  const bad = EXERCISES.filter((e) => !e.video || !WATCH_URL.test(e.video));
  assert.deepEqual(
    bad.map((e) => e.slug),
    [],
  );
});

test("video ids are not reused across exercises", () => {
  const ids = EXERCISES.map((e) => e.video);
  assert.equal(new Set(ids).size, EXERCISES.length);
});

test("source refs are resolvable web URLs", () => {
  const bad = EXERCISES.flatMap((e) => e.sourceRefs).filter((r) => !r.url.startsWith("https://"));
  assert.deepEqual(bad, []);
});

// The cheapest guard against a typo in a 117-record hand edit.
test("every exercise requires at least one known equipment kind", () => {
  const bad = EXERCISES.filter(
    (e) => e.requires.length === 0 || e.requires.some((kind) => !EQUIPMENT_KINDS.includes(kind)),
  );
  assert.deepEqual(
    bad.map((e) => e.slug),
    [],
  );
});

test("every exercise belongs to a declared category", () => {
  const slugs = new Set(CATEGORIES.map((c) => c.slug));
  const orphans = EXERCISES.filter((e) => !slugs.has(e.categorySlug)).map((e) => e.slug);
  assert.deepEqual(orphans, []);
});

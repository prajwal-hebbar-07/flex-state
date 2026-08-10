import assert from "node:assert/strict";
import test from "node:test";
import { equipmentCovers, isLocation, normalizeLocationId } from "./locations.ts";

test("equipmentCovers is a subset test", () => {
  assert.equal(equipmentCovers(["bodyweight"], ["bodyweight"]), true);
  assert.equal(equipmentCovers(["bodyweight", "floor"], ["bodyweight"]), true);
  assert.equal(equipmentCovers(["bodyweight"], ["bodyweight", "floor"]), false);
  assert.equal(equipmentCovers(["bodyweight", "dumbbells"], ["dumbbells"]), true);
  assert.equal(equipmentCovers([], ["bodyweight"]), false);
});

test("equipmentCovers accepts an empty requirement anywhere", () => {
  assert.equal(equipmentCovers([], []), true);
  assert.equal(equipmentCovers(["floor"], []), true);
});

test("equipmentCovers ignores extra kit the exercise does not need", () => {
  const everything = ["bodyweight", "furniture", "dumbbells", "floor"] as const;
  assert.equal(equipmentCovers([...everything], ["floor"]), true);
  assert.equal(equipmentCovers([...everything], [...everything]), true);
});

test("isLocation accepts a valid location and rejects bad shapes", () => {
  const valid = {
    id: "home",
    name: "Home",
    equipment: ["bodyweight"],
    excludedExerciseSlugs: [],
    displayOrder: 0,
  };
  // `as unknown` throughout: TypeScript rejects these at compile time, which is
  // the point - the runtime guard still has to.
  const check = (value: unknown) => isLocation(value);
  assert.equal(check(valid), true);
  assert.equal(check(null), false);
  assert.equal(check({ ...valid, equipment: [] }), false); // empty kit
  assert.equal(check({ ...valid, equipment: ["barbell"] }), false); // not a known kind
  assert.equal(check({ ...valid, equipment: ["bodyweight", "bodyweight"] }), false);
  assert.equal(check({ ...valid, id: "Home" }), false); // uppercase
  assert.equal(check({ ...valid, id: "my office" }), false); // space
  assert.equal(check({ ...valid, name: "  " }), false); // blank
  assert.equal(check({ ...valid, displayOrder: -1 }), false);
  assert.equal(check({ ...valid, excludedExerciseSlugs: ["a", "a"] }), false);
});

test("normalizeLocationId lowercases and hyphenates", () => {
  assert.equal(normalizeLocationId("My Office"), "my-office");
  assert.equal(normalizeLocationId("gym 1"), "gym-1");
  assert.equal(normalizeLocationId("home"), "home");
  assert.equal(normalizeLocationId("  The Park!  "), "the-park");
  assert.equal(normalizeLocationId("!!!"), "");
});

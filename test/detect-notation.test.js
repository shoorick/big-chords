const { test } = require("node:test");
const assert = require("node:assert/strict");
const { detectNotationSystem } = require("../js/split.js");

test("detects German notation from H in a chord root", () => {
  assert.equal(detectNotationSystem(["Hm", "C"]), "german");
});

test("detects German notation from H in a slash bass", () => {
  assert.equal(detectNotationSystem(["C/H"]), "german");
});

test("detects English notation from B-flat written with a flat symbol", () => {
  assert.equal(detectNotationSystem(["B♭m", "C"]), "english");
});

test("detects English notation from B-flat written as Bb", () => {
  assert.equal(detectNotationSystem(["Bb7", "C"]), "english");
});

test("detects English notation from B-flat written with a Cyrillic soft sign", () => {
  assert.equal(detectNotationSystem(["Вь7", "C"]), "english");
});

test("uses a B-flat slash bass as an English notation clue", () => {
  assert.equal(detectNotationSystem(["C/Bb"]), "english");
});

test("returns null when the chord lines do not distinguish the systems", () => {
  assert.equal(detectNotationSystem(["Am", "C/G", "B"]), null);
});

test("returns null when German and English clues conflict", () => {
  assert.equal(detectNotationSystem(["Hm", "Bb"]), null);
});

test("ignores H in a chord quality suffix", () => {
  assert.equal(detectNotationSystem(["C7H"]), null);
});

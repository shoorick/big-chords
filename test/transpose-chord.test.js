const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseChord, respellChord, transposeChord } = require("../js/big-chords.js");

const transposed = (source, semitones, system = "english") =>
  respellChord(transposeChord(parseChord(source, system), semitones), "as-is");

test("transposes a root by whole and semitone steps", () => {
  assert.equal(transposed("C", 2), "D");
  assert.equal(transposed("C", 1), "C♯");
  assert.equal(transposed("G7", 5), "C7");
});

test("transposes negative offsets and wraps around the octave", () => {
  assert.equal(transposed("C", -1), "B");
  assert.equal(transposed("C", -13), "B");
  assert.equal(transposed("C", 12), "C");
});

test("transposes both root and slash bass while preserving the quality", () => {
  const chord = transposeChord(parseChord("Am7/G", "english"), 5);

  assert.deepEqual(chord.root, { letter: "D", accidental: "", pitchClass: 2 });
  assert.equal(chord.quality, "m7");
  assert.deepEqual(chord.bass, { letter: "C", accidental: "", pitchClass: 0 });
  assert.equal(chord.normalized, "Dm7/C");
});

test("transposes sharp roots into enharmonically respellable pitch classes", () => {
  const chord = transposeChord(parseChord("F#m7/A#", "english"), 2);

  assert.equal(respellChord(chord, "sharps"), "G♯m7/C");
  assert.equal(respellChord(chord, "flats"), "A♭m7/C");
});

test("respells transposed chords with the flat preference", () => {
  const chord = transposeChord(parseChord("C", "english"), 1);

  assert.equal(respellChord(chord, "flats"), "D♭");
});

test("transposes German B and H using German pitch classes", () => {
  const system = "german";

  assert.equal(transposed("H", 1, system), "C");
  assert.equal(transposed("B", -1, system), "A");
});

test("leaves unresolved B and H unchanged when notation is ambiguous", () => {
  const chord = transposeChord(parseChord("B/C", null), 2);

  assert.deepEqual(chord.root, { letter: "B", accidental: "", pitchClass: null });
  assert.deepEqual(chord.bass, { letter: "D", accidental: "", pitchClass: 2 });
});

test("returns the chord unchanged for invalid input", () => {
  const chord = parseChord("C", "english");

  assert.equal(transposeChord(null, 2), null);
  assert.equal(transposeChord(chord, Number.NaN), chord);
  assert.deepEqual(transposeChord(chord, 0), chord);
});

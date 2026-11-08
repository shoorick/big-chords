const { test } = require("node:test");
const assert = require("node:assert/strict");
const { detectNotationSystem, parseChord } = require("../js/split.js");

test("parses common Latin chord symbols and preserves their quality suffixes", () => {
  const examples = [
    ["C", "C", "", 0],
    ["Dm", "D", "m", 2],
    ["E7", "E", "7", 4],
    ["Fmaj7", "F", "maj7", 5],
    ["G7", "G", "7", 7],
    ["Am7", "A", "m7", 9],
  ];

  for (const [source, letter, quality, pitchClass] of examples) {
    const chord = parseChord(source, "english");
    assert.equal(chord.source, source);
    assert.deepEqual(chord.root, { letter, accidental: "", pitchClass });
    assert.equal(chord.quality, quality);
    assert.equal(chord.bass, null);
    assert.equal(chord.normalized, source);
  }
});

test("parses a sharp root and a slash bass", () => {
  const chord = parseChord("F#m7/A#", "english");

  assert.deepEqual(chord.root, { letter: "F", accidental: "♯", pitchClass: 6 });
  assert.equal(chord.quality, "m7");
  assert.deepEqual(chord.bass, { letter: "A", accidental: "♯", pitchClass: 10 });
  assert.equal(chord.normalized, "F♯m7/A♯");
});

test("normalizes flat and sharp symbols in roots, basses, and quality suffixes", () => {
  assert.equal(parseChord("Bb7/Db", "english").normalized, "B♭7/D♭");
  assert.equal(parseChord("C7#5", "english").normalized, "C7♯5");
});

test("normalizes Cyrillic note lookalikes in root and bass positions", () => {
  const chord = parseChord("С#7/Н", "german");
  const cyrillicE = parseChord("Е7", "english");

  assert.deepEqual(chord.root, { letter: "C", accidental: "♯", pitchClass: 1 });
  assert.deepEqual(chord.bass, { letter: "H", accidental: "", pitchClass: 11 });
  assert.equal(chord.normalized, "C♯7/H");
  assert.deepEqual(cyrillicE.root, { letter: "E", accidental: "", pitchClass: 4 });
  assert.equal(cyrillicE.normalized, "E7");
});

test("normalizes Cyrillic soft signs to flats", () => {
  const chord = parseChord("Вь7/АЬ", "english");

  assert.deepEqual(chord.root, { letter: "B", accidental: "♭", pitchClass: 10 });
  assert.deepEqual(chord.bass, { letter: "A", accidental: "♭", pitchClass: 8 });
  assert.equal(chord.normalized, "B♭7/A♭");
});

test("uses auto-detection to resolve B in German notation", () => {
  const system = detectNotationSystem(["Hm", "C"]);

  assert.equal(system, "german");
  assert.equal(parseChord("B", system).root.pitchClass, 10);
  assert.equal(parseChord("H", system).root.pitchClass, 11);
});

test("uses auto-detection to resolve B in English notation", () => {
  const system = detectNotationSystem(["Bb", "C"]);

  assert.equal(system, "english");
  assert.equal(parseChord("B", system).root.pitchClass, 11);
  assert.equal(parseChord("H", system).root.pitchClass, null);
});

test("manual English notation treats B as natural and applies accidentals", () => {
  assert.equal(parseChord("B", "english").root.pitchClass, 11);
  assert.equal(parseChord("B♭", "english").root.pitchClass, 10);
  assert.equal(parseChord("B♯", "english").root.pitchClass, 0);
});

test("manual German notation treats B as flat and H as natural", () => {
  assert.equal(parseChord("B", "german").root.pitchClass, 10);
  assert.equal(parseChord("H", "german").root.pitchClass, 11);
  assert.equal(parseChord("B♭", "german").root.pitchClass, 9);
  assert.equal(parseChord("B♯", "german").root.pitchClass, 11);
});

test("leaves B and H pitch classes unresolved when auto-detection has no clue", () => {
  const system = detectNotationSystem(["Am", "C/G", "B"]);

  assert.equal(system, null);
  assert.equal(parseChord("B", system).root.pitchClass, null);
  assert.equal(parseChord("H", system).root.pitchClass, null);
});

test("rejects unsupported roots and malformed slash basses", () => {
  assert.equal(parseChord("I7", "english"), null);
  assert.equal(parseChord("C/Gm", "english"), null);
  assert.equal(parseChord("C/G/B", "english"), null);
  assert.equal(parseChord("C##", "english"), null);
});

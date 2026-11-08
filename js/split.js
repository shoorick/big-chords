(() => {
  "use strict";

  const CHORD_NOTATION_SYSTEM = "auto"; // "english", "german", or "auto"
  const CHORD_ENHARMONIC_PREFERENCE = "as-is"; // "sharps", "flats", or "as-is"
  const source = typeof document === "undefined"
    ? null
    : document.querySelector("pre[data-chord-lines]");
  if (!source) {
    if (typeof module !== "undefined" && module.exports) {
      module.exports = { detectNotationSystem, parseChord, respellChord };
    }
    return;
  }

  const song = document.createElement("section");
  song.className = "song";

  const lines = source.textContent.replace(/\r\n?/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  const detectedNotationSystem = detectNotationSystem(
    lines.filter((_, index) => index % 2 === 0),
  );
  const notationSystem = CHORD_NOTATION_SYSTEM === "auto"
    ? detectedNotationSystem
    : CHORD_NOTATION_SYSTEM;
  const enharmonicPreference = getEnharmonicPreference();
  const chordElements = [];

  for (let index = 0; index < lines.length; index += 2) {
    const lyricLine = Array.from(lines[index + 1] ?? "");
    const chords = [...(lines[index] ?? "").matchAll(/\S+/g)].map((match) => {
      const parsed = parseChord(match[0], notationSystem);
      return {
        parsed,
        chord: parsed
          ? respellChord(parsed, enharmonicPreference)
          : match[0],
        column: Array.from((lines[index] ?? "").slice(0, match.index)).length,
      };
    });

    const row = document.createElement("article");
    row.className = "song-line";

    let cursor = 0;
    for (const [chordIndex, item] of chords.entries()) {
      if (item.column > cursor) {
        addFragment(row, "", lyricLine.slice(cursor, item.column).join(""));
      }

      const nextColumn = chords[chordIndex + 1]?.column ?? lyricLine.length;
      const chordElement = addFragment(row, item.chord, lyricLine.slice(item.column, nextColumn).join(""));
      if (item.parsed) chordElements.push({ element: chordElement, parsed: item.parsed });
      cursor = Math.max(cursor, nextColumn);
    }

    if (chords.length === 0) {
      addFragment(row, "", lyricLine.join(""));
    } else if (cursor < lyricLine.length) {
      addFragment(row, "", lyricLine.slice(cursor).join(""));
    }

    song.append(row);
  }

  source.replaceWith(song);

  const enharmonicControl = document.querySelector(".enharmonic-control");
  enharmonicControl?.addEventListener("change", (event) => {
    if (event.target.name !== "enharmonic-preference") return;

    const preference = getEnharmonicPreference();
    for (const { element, parsed } of chordElements) {
      element.textContent = respellChord(parsed, preference);
    }
  });

  const sizeControl = document.querySelector(".chord-size-control");
  if (sizeControl) {
    const setChordSize = (value) => {
      const parsedSize = Number.parseInt(value, 10);
      const size = Number.isInteger(parsedSize) ? Math.min(6, Math.max(1, parsedSize)) : 2;
      song.style.setProperty("--chord-size", `${size}em`);
      return size;
    };
    const sizeRadios = sizeControl.querySelectorAll('input[name="chord-size"]');

    if (sizeRadios.length > 0) {
      const selectedSize = sizeControl.querySelector('input[name="chord-size"]:checked');
      setChordSize(selectedSize?.value ?? 2);
      sizeControl.addEventListener("change", (event) => {
        if (event.target.name === "chord-size") setChordSize(event.target.value);
      });
    } else {
      const sizeOutput = sizeControl.querySelector("output");
      if (!sizeOutput) return;

      const size = setChordSize(sizeOutput.textContent);
      sizeOutput.textContent = String(size);
      sizeControl.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (!button || !sizeControl.contains(button)) return;

        const change = button.id === "chord-size-increase"
          ? 1
          : button.id === "chord-size-decrease"
            ? -1
            : 0;
        if (change === 0) return;

        const currentSize = Number.parseInt(sizeOutput.textContent, 10);
        const nextSize = setChordSize(currentSize + change);
        sizeOutput.textContent = String(nextSize);
      });
    }
  }

  function addFragment(row, chord, lyric) {
    const fragment = document.createElement("div");
    fragment.className = "song-fragment";

    const chordElement = document.createElement("em");
    chordElement.textContent = chord;
    fragment.append(chordElement);

    const lyricElement = document.createElement("span");
    lyricElement.textContent = lyric;
    fragment.append(lyricElement);

    row.append(fragment);
    return chordElement;
  }

  function getEnharmonicPreference() {
    const selected = document.querySelector('input[name="enharmonic-preference"]:checked')?.value;
    return ["sharps", "flats", "as-is"].includes(selected)
      ? selected
      : CHORD_ENHARMONIC_PREFERENCE;
  }

  function parseChord(source, system) {
    const parts = source.split("/");
    if (parts.length > 2) return null;

    const rootMatch = parts[0].match(/^([A-HАВСЕН])([#♯b♭Ьь]?)(.*)$/u);
    if (!rootMatch || /^[#♯b♭Ьь]/u.test(rootMatch[3])) return null;

    const bassMatch = parts.length === 2
      ? parts[1].match(/^([A-HАВСЕН])([#♯b♭Ьь]?)$/u)
      : null;
    if (parts.length === 2 && !bassMatch) return null;

    const root = {
      letter: normalizeNoteLetter(rootMatch[1]),
      accidental: normalizeAccidental(rootMatch[2]),
    };
    root.pitchClass = getPitchClass(root, system);
    const quality = rootMatch[3]
      .replace(/[Ьь]/g, "♭")
      .replace(/#/g, "♯")
      .replace(/([A-Z])b/g, "$1♭");
    const bass = bassMatch
      ? {
          letter: normalizeNoteLetter(bassMatch[1]),
          accidental: normalizeAccidental(bassMatch[2]),
        }
      : null;
    if (bass) bass.pitchClass = getPitchClass(bass, system);

    const normalized = `${formatNote(root)}${quality}${bass ? `/${formatNote(bass)}` : ""}`;
    return { source, root, quality, bass, normalized, notationSystem: system };
  }

  function respellChord(chord, preference) {
    if (!chord) return null;
    if (preference === "as-is") return chord.normalized;
    if (preference !== "sharps" && preference !== "flats") return chord.normalized;

    const root = respellNote(chord.root, preference, chord.notationSystem);
    const bass = chord.bass
      ? respellNote(chord.bass, preference, chord.notationSystem)
      : null;
    return `${root}${chord.quality}${bass ? `/${bass}` : ""}`;
  }

  function respellNote(note, preference, system) {
    if (note.pitchClass === null) return formatNote(note);

    const germanNames = {
      sharps: ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "H"],
      flats: ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B", "H"],
    };
    const englishNames = {
      sharps: ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"],
      flats: ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"],
    };
    const names = system === "german" ? germanNames : englishNames;
    return names[preference][note.pitchClass];
  }

  function detectNotationSystem(chordLines) {
    let hasH = false;
    let hasBFlat = false;

    for (const line of chordLines) {
      for (const match of line.matchAll(/\S+/g)) {
        const chord = parseChord(match[0], null);
        if (!chord) continue;

        for (const note of [chord.root, chord.bass]) {
          if (!note) continue;
          if (note.letter === "H") hasH = true;
          if (note.letter === "B" && note.accidental === "♭") hasBFlat = true;
        }
      }
    }

    if (hasH === hasBFlat) return null;
    return hasH ? "german" : "english";
  }

  function getPitchClass(note, system) {
    const naturalPitchClasses = { A: 9, B: 11, C: 0, D: 2, E: 4, F: 5, G: 7, H: null };
    if (note.letter === "B" && system === "german") naturalPitchClasses.B = 10;
    if (note.letter === "H" && system === "german") naturalPitchClasses.H = 11;
    if (note.letter === "B" && system === null) return null;

    const naturalPitchClass = naturalPitchClasses[note.letter];
    if (naturalPitchClass === null || naturalPitchClass === undefined) return null;

    const accidentalOffset = note.accidental === "♯" ? 1 : note.accidental === "♭" ? -1 : 0;
    return (naturalPitchClass + accidentalOffset + 12) % 12;
  }

  function normalizeNoteLetter(letter) {
    const lookalikes = { "А": "A", "В": "B", "С": "C", "Е": "E", "Н": "H" };
    return lookalikes[letter] ?? letter;
  }

  function normalizeAccidental(accidental) {
    if (accidental === "#") return "♯";
    if (accidental === "b" || accidental === "Ь" || accidental === "ь") return "♭";
    return accidental;
  }

  function formatNote(note) {
    return `${note.letter}${note.accidental}`;
  }
})();

(() => {
  "use strict";

  const CHORD_NOTATION_SYSTEM = "auto"; // "english", "german", or "auto"
  const source = document.querySelector("pre[data-chord-lines]");
  if (!source) return;

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

  for (let index = 0; index < lines.length; index += 2) {
    const lyricLine = Array.from(lines[index + 1] ?? "");
    const chords = [...(lines[index] ?? "").matchAll(/\S+/g)].map((match) => {
      const parsed = parseChord(match[0], notationSystem);
      return {
        chord: parsed?.normalized ?? match[0],
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
      addFragment(row, item.chord, lyricLine.slice(item.column, nextColumn).join(""));
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

  const sizeControl = document.querySelector(".chord-size-control");
  const sizeOutput = sizeControl?.querySelector("output");
  if (sizeControl && sizeOutput) {
    const initialSize = Number.parseInt(sizeOutput.textContent, 10);
    const size = Number.isInteger(initialSize) ? Math.min(6, Math.max(1, initialSize)) : 2;
    sizeOutput.textContent = String(size);
    song.style.setProperty("--chord-size", `${size}em`);

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
      const nextSize = Math.min(6, Math.max(1, currentSize + change));
      sizeOutput.textContent = String(nextSize);
      song.style.setProperty("--chord-size", `${nextSize}em`);
    });
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

(() => {
  "use strict";

  /** @typedef {"english" | "german" | null} NotationSystem */
  /** @typedef {"english" | "german"} DisplayNotationSystem */
  /** @typedef {"sharps" | "flats" | "as-is"} EnharmonicPreference */
  /**
   * @typedef {Object} ParsedNote
   * @property {string} letter Normalized Latin note letter.
   * @property {string} accidental Normalized accidental, if present.
   * @property {number | null} pitchClass Semitone number from C, or null if unresolved.
   */
  /**
   * @typedef {Object} ParsedChord
   * @property {string} source Original chord token.
   * @property {ParsedNote} root Root note.
   * @property {string} quality Chord quality and extensions after the root.
   * @property {ParsedNote | null} bass Optional slash bass note.
   * @property {string} normalized Chord with normalized note spelling.
   * @property {NotationSystem} notationSystem System used to interpret the notes.
   */

  const CHORD_NOTATION_SYSTEM = "auto"; // "english", "german", or "auto"
  const CHORD_ENHARMONIC_PREFERENCE = "as-is"; // "sharps", "flats", or "as-is"
  const scriptElement = typeof document === "undefined" ? null : document.currentScript;
  const source = typeof document === "undefined"
    ? null
    : document.querySelector("pre[data-chord-lines]");
  if (!source) {
    if (typeof module !== "undefined" && module.exports) {
      module.exports = { detectNotationSystem, parseChord, respellChord, transposeChord };
    }
    return;
  }

  const song = document.createElement("section");
  song.className = "song";

  const lines = source.textContent.replace(/\r\n?/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  const configuredNotationSystem = getDataSetting(
    "notation-system",
    ["english", "german", "auto"],
    CHORD_NOTATION_SYSTEM,
  );
  const detectedNotationSystem = detectNotationSystem(
    lines.filter((_, index) => index % 2 === 0),
  );
  const notationSystem = configuredNotationSystem === "auto"
    ? detectedNotationSystem
    : configuredNotationSystem;
  const configuredEnharmonicPreference = getDataSetting(
    "enharmonic-preference",
    ["sharps", "flats", "as-is"],
    CHORD_ENHARMONIC_PREFERENCE,
  );
  const configuredDisplayNotationSystem = getDataSetting(
    "display-notation-system",
    ["english", "german"],
    null,
  );
  const configuredChordSize = getDataSetting(
    "chord-size",
    ["1", "2", "3", "4", "5", "6"],
    null,
  );
  const configuredTranspose = getTransposeSetting();
  applyDataSettingToControl("enharmonic-preference", ["sharps", "flats", "as-is"]);
  applyDataSettingToControl("display-notation-system", ["english", "german"]);
  applyDataSettingToControl("chord-size", ["1", "2", "3", "4", "5", "6"]);
  const enharmonicPreference = getEnharmonicPreference(configuredEnharmonicPreference);
  const chordElements = [];
  let transposeSemitones = 0;

  for (let index = 0; index < lines.length; index += 2) {
    const lyricLine = Array.from(lines[index + 1] ?? "");
    const chords = [...(lines[index] ?? "").matchAll(/\S+/g)].map((match) => {
      const parsed = parseChord(match[0], notationSystem);
      return {
        parsed,
        chord: parsed
          ? respellChord(parsed, enharmonicPreference, getDisplayNotationSystem(configuredDisplayNotationSystem))
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

  /** Rewrites displayed chord labels using the currently selected spellings. */
  const refreshChordSpellings = () => {
    const preference = getEnharmonicPreference(configuredEnharmonicPreference);
    const displaySystem = getDisplayNotationSystem(configuredDisplayNotationSystem);
    for (const { element, parsed } of chordElements) {
      renderChordLabel(
        element,
        respellChord(
          transposeChord(parsed, transposeSemitones),
          preference,
          displaySystem,
        ),
      );
    }
  };

  for (const control of document.querySelectorAll(".enharmonic-control, .notation-system-control")) {
    control.addEventListener("change", (event) => {
      if (["enharmonic-preference", "display-notation-system"].includes(event.target.name)) {
        refreshChordSpellings();
      }
    });
  }

  const transposeControl = document.querySelector(".transpose-control");
  const transposeRadios = transposeControl?.querySelectorAll('input[name="transpose-semitones"]') ?? [];
  const transposeOutput = transposeControl?.querySelector("output");
  /**
   * Applies a chromatic transposition offset, reduced modulo 12 to the -11 to +11 range.
   * @param {string | number} value Requested offset in semitones.
   * @returns {number} Applied offset.
   */
  const setTranspose = (value) => {
    const parsedValue = Number.parseInt(value, 10);
    transposeSemitones = Number.isInteger(parsedValue) ? parsedValue % 12 || 0 : 0;
    if (transposeOutput) transposeOutput.textContent = String(transposeSemitones);
    refreshChordSpellings();
    return transposeSemitones;
  };
  for (const radio of transposeRadios) {
    radio.addEventListener("change", () => {
      if (radio.checked) setTranspose(getRadioValue(radio));
    });
  }
  if (transposeRadios.length === 0 && transposeControl) {
    transposeControl.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button || !transposeControl.contains(button)) return;

      const change = button.id === "transpose-increase"
        ? 1
        : button.id === "transpose-decrease"
          ? -1
          : 0;
      if (change === 0) return;

      setTranspose(transposeSemitones + change);
    });
  }
  if (configuredTranspose !== null) {
    const radio = [...transposeRadios]
      .find((input) => getRadioValue(input) === String(configuredTranspose));
    if (radio) radio.checked = true;
    setTranspose(configuredTranspose);
  }

  const sizeControl = document.querySelector(".chord-size-control");
  const sizeRadios = sizeControl?.querySelectorAll('input[name="chord-size"]') ?? [];
  const sizeOutput = sizeControl?.querySelector("output");
  /**
   * Applies a chord font size, clamped to the supported 1–6 em range.
   * @param {string | number} value Requested size.
   * @returns {number} Applied size.
   */
  const setChordSize = (value) => {
    const parsedSize = Number.parseInt(value, 10);
    const size = Number.isInteger(parsedSize) ? Math.min(6, Math.max(1, parsedSize)) : 2;
    song.style.setProperty("--chord-size", `${size}em`);
    return size;
  };
  const checkedRadio = sizeControl?.querySelector('input[name="chord-size"]:checked');
  const checkedSize = checkedRadio ? getRadioValue(checkedRadio) : undefined;
  const initialSize = configuredChordSize ?? checkedSize ?? sizeOutput?.textContent ?? 2;
  const size = setChordSize(initialSize);
  if (sizeRadios.length > 0) {
    const radio = [...sizeRadios].find((input) => getRadioValue(input) === String(size));
    if (radio) radio.checked = true;
    sizeControl.addEventListener("change", (event) => {
      if (event.target.name === "chord-size") setChordSize(getRadioValue(event.target));
    });
  } else if (sizeOutput) {
    sizeOutput.textContent = String(size);
    if (sizeControl) {
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

  /**
   * Adds one chord-and-lyric fragment to a rendered song line.
   * @param {HTMLElement} row Parent line element.
   * @param {string} chord Chord label, or an empty string for no chord.
   * @param {string} lyric Corresponding lyric fragment.
   * @returns {HTMLElement} The fragment's chord element.
   */
  function addFragment(row, chord, lyric) {
    const fragment = document.createElement("div");
    fragment.className = "song-fragment";

    const chordElement = document.createElement("em");
    renderChordLabel(chordElement, chord);
    fragment.append(chordElement);

    const lyricElement = document.createElement("span");
    lyricElement.textContent = lyric;
    fragment.append(lyricElement);

    row.append(fragment);
    return chordElement;
  }

  /**
   * Renders a chord label, replacing sharp/flat characters with SVG accidentals.
   * @param {HTMLElement} element Chord element to fill.
   * @param {string | null} text Chord label text.
   * @returns {void}
   */
  function renderChordLabel(element, text) {
    element.replaceChildren();
    for (const part of String(text ?? "").split(/([♯♭])/)) {
      if (!part) continue;
      if (part === "♯" || part === "♭") {
        const mark = document.createElement("span");
        mark.className = `accidental accidental--${part === "♯" ? "sharp" : "flat"}`;
        mark.textContent = part;
        element.append(mark);
      } else {
        element.append(document.createTextNode(part));
      }
    }
  }

  /**
   * Reads the selected enharmonic preference, falling back to the configured default.
   * @param {EnharmonicPreference} [fallback] Preference used when no valid radio is selected.
   * @returns {EnharmonicPreference}
   */
  function getEnharmonicPreference(fallback = CHORD_ENHARMONIC_PREFERENCE) {
    const selected = document.querySelector('input[name="enharmonic-preference"]:checked')?.value;
    return ["sharps", "flats", "as-is"].includes(selected)
      ? selected
      : fallback;
  }

  /**
   * Reads a validated setting, preferring the chord sheet's `<pre>` over the script element.
   * @param {string} name Data-attribute name without the `data-` prefix.
   * @param {string[]} validValues Accepted values.
   * @param {string | null} fallback Value returned when neither element has a valid setting.
   * @returns {string | null}
   */
  function getDataSetting(name, validValues, fallback) {
    for (const element of [source, scriptElement]) {
      const value = element?.getAttribute(`data-${name}`);
      if (validValues.includes(value)) return value;
    }
    return fallback;
  }

  /**
   * Reads a validated transposition offset, preferring the chord sheet's `<pre>` over the script element.
   * Any integer is accepted and reduced modulo 12 to the -11 to +11 range.
   * @returns {number | null} Offset in semitones, or null when unset or invalid.
   */
  function getTransposeSetting() {
    for (const element of [source, scriptElement]) {
      const raw = element?.getAttribute("data-transpose");
      if (raw === null || raw === undefined || !/^-?\d+$/.test(raw.trim())) continue;
      return Number.parseInt(raw, 10) % 12 || 0;
    }
    return null;
  }

  /**
   * Sets the radio matching a configured data setting, when that control exists.
   * @param {string} name Radio group and data-attribute name.
   * @param {string[]} validValues Accepted values.
   * @returns {void}
   */
  function applyDataSettingToControl(name, validValues) {
    const value = getDataSetting(name, validValues, null);
    if (value === null) return;

    const radio = [...document.querySelectorAll(`input[name="${name}"]`)]
      .find((input) => getRadioValue(input) === value);
    if (radio) radio.checked = true;
  }

  /**
   * Gets a radio's value, inferring chord size or transposition offset from its label when `value` is omitted.
   * @param {HTMLInputElement} input Radio input.
   * @returns {string}
   */
  function getRadioValue(input) {
    if (input.name === "chord-size" && input.value === "on") {
      const label = input.closest("label")?.textContent.trim();
      if (/^[1-6]$/.test(label)) return label;
    }
    if (input.name === "transpose-semitones" && input.value === "on") {
      const label = input.closest("label")?.textContent.trim();
      if (/^[+-]?\d+$/.test(label)) return String(Number.parseInt(label, 10));
    }
    return input.value;
  }

  /**
   * Reads the selected output notation system, falling back to its configured default.
   * @param {DisplayNotationSystem | null} [fallback]
   * @returns {DisplayNotationSystem | null}
   */
  function getDisplayNotationSystem(fallback = null) {
    const selected = document.querySelector('input[name="display-notation-system"]:checked')?.value;
    return ["english", "german"].includes(selected) ? selected : fallback;
  }

  /**
   * Parses a chord token into root, quality, and optional slash bass components.
   * @param {string} source Chord token to parse.
   * @param {NotationSystem} system Notation used to interpret B and H.
   * @returns {ParsedChord | null} Parsed chord, or null when the token is not recognized.
   */
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

  /**
   * Returns a chord with its root and slash bass respelled as requested.
   * @param {ParsedChord | null} chord Parsed chord.
   * @param {EnharmonicPreference} preference Preferred accidental spelling.
   * @param {DisplayNotationSystem | NotationSystem} [displaySystem] Note-name system for output.
   * @returns {string | null}
   */
  function respellChord(chord, preference, displaySystem = chord?.notationSystem) {
    if (!chord) return null;
    if (preference === "as-is") {
      const root = formatNoteForSystem(chord.root, displaySystem);
      const bass = chord.bass ? formatNoteForSystem(chord.bass, displaySystem) : null;
      return `${root}${chord.quality}${bass ? `/${bass}` : ""}`;
    }
    if (preference !== "sharps" && preference !== "flats") return chord.normalized;

    const system = displaySystem ?? chord.notationSystem;
    const root = respellNote(chord.root, preference, system);
    const bass = chord.bass
      ? respellNote(chord.bass, preference, system)
      : null;
    return `${root}${chord.quality}${bass ? `/${bass}` : ""}`;
  }

  /**
   * Transposes a parsed chord by a number of semitones.
   * Notes with unresolved pitch classes (ambiguous B/H) are left unchanged.
   * @param {ParsedChord} chord Parsed chord to transpose.
   * @param {number} semitones Chromatic offset; may be negative.
   * @returns {ParsedChord} Transposed chord with the same quality suffix.
   */
  function transposeChord(chord, semitones) {
    if (!chord || !Number.isFinite(semitones) || semitones === 0) return chord;
    const system = chord.notationSystem ?? "english";
    const root = transposeNote(chord.root, semitones, system);
    const bass = chord.bass ? transposeNote(chord.bass, semitones, system) : null;
    return {
      ...chord,
      root,
      bass,
      normalized: `${formatNote(root)}${chord.quality}${bass ? `/${formatNote(bass)}` : ""}`,
    };
  }

  /**
   * Shifts a note's pitch class and respells it, using sharps as the base spelling.
   * @param {ParsedNote} note Note to transpose.
   * @param {number} semitones Chromatic offset.
   * @param {DisplayNotationSystem | NotationSystem} system Notation used for respelling.
   * @returns {ParsedNote} Transposed note.
   */
  function transposeNote(note, semitones, system) {
    if (note.pitchClass === null) return { ...note };
    const pitchClass = Math.round((((note.pitchClass + semitones) % 12) + 12) % 12);
    const spelling = respellNote({ ...note, pitchClass }, "sharps", system);
    return { letter: spelling[0], accidental: spelling.slice(1), pitchClass };
  }

  /**
   * Formats B-flat/B-natural according to the selected English or German notation.
   * @param {ParsedNote} note Note to format.
   * @param {DisplayNotationSystem | NotationSystem} system Output notation system.
   * @returns {string} Formatted note.
   */
  function formatNoteForSystem(note, system) {
    if (note.pitchClass === null || !["english", "german"].includes(system)) {
      return formatNote(note);
    }
    if (note.pitchClass === 10) return system === "german" ? "B" : "B♭";
    if (note.pitchClass === 11) return system === "german" ? "H" : "B";
    return formatNote(note);
  }

  /**
   * Rewrites one note using the selected accidental preference and notation system.
   * @param {ParsedNote} note Note to respell.
   * @param {"sharps" | "flats"} preference Preferred accidental spelling.
   * @param {DisplayNotationSystem | NotationSystem} system Output notation system.
   * @returns {string} Respelled note.
   */
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

  /**
   * Detects notation from H notes or B-flat notes in chord tokens.
   * @param {string[]} chordLines Lines containing chord tokens.
   * @returns {NotationSystem} Detected system, or null when the clues are absent or conflict.
   */
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

  /**
   * Converts a note to a pitch class, or returns null when B/H is ambiguous.
   * @param {ParsedNote} note Note to convert.
   * @param {NotationSystem} system Notation used to interpret B and H.
   * @returns {number | null} Semitone number from C, in the range 0–11.
   */
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

  /**
   * Converts supported Cyrillic note lookalikes to Latin note letters.
   * @param {string} letter Note letter to normalize.
   * @returns {string} Normalized note letter.
   */
  function normalizeNoteLetter(letter) {
    const lookalikes = { "А": "A", "В": "B", "С": "C", "Е": "E", "Н": "H" };
    return lookalikes[letter] ?? letter;
  }

  /**
   * Converts textual sharp/flat spellings to Unicode accidental symbols.
   * @param {string} accidental Accidental to normalize.
   * @returns {string} Normalized accidental.
   */
  function normalizeAccidental(accidental) {
    switch (accidental) {
      case "#":
        return "♯";
      case "b":
      case "ｂ":
      case "Ь":
      case "ь":
      case "ხ":
      case "Ხ":
        return "♭";
      default:
        return accidental;
    }
  }

  /**
   * Returns a note's letter and normalized accidental as a single string.
   * @param {ParsedNote} note Note to format.
   * @returns {string} Formatted note.
   */
  function formatNote(note) {
    return `${note.letter}${note.accidental}`;
  }
})();

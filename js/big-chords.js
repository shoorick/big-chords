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
  const chordSelector = scriptElement?.getAttribute("data-selector")?.trim()
    || "pre[data-chord-lines]";
  let sources = [];
  if (typeof document !== "undefined") {
    try {
      sources = [...document.querySelectorAll(chordSelector)];
    } catch {
      sources = [...document.querySelectorAll("pre[data-chord-lines]")];
    }
  }
  if (sources.length === 0) {
    if (typeof module !== "undefined" && module.exports) {
      module.exports = {
        detectNotationSystem,
        parseChord,
        parseInlineMarkup,
        respellChord,
        transposeChord,
      };
    }
    return;
  }

  const primarySource = sources[0];
  const configuredEnharmonicPreference = getDataSetting(
    primarySource,
    "enharmonic-preference",
    ["sharps", "flats", "as-is"],
    CHORD_ENHARMONIC_PREFERENCE,
  );
  const configuredDisplayNotationSystem = getDataSetting(
    primarySource,
    "display-notation-system",
    ["english", "german"],
    null,
  );
  const configuredChordSize = getDataSetting(
    primarySource,
    "chord-size",
    ["1", "2", "3", "4", "5", "6"],
    null,
  );
  const configuredTranspose = getTransposeSetting(primarySource);
  const hasEnharmonicControl = document.querySelector('input[name="enharmonic-preference"]') !== null;
  const hasDisplaySystemControl = document.querySelector('input[name="display-notation-system"]') !== null;
  const hasChordSizeControl = document.querySelector(".chord-size-control") !== null;
  const hasTransposeControl = document.querySelector(".transpose-control") !== null;
  applyDataSettingToControl(primarySource, "enharmonic-preference", ["sharps", "flats", "as-is"]);
  applyDataSettingToControl(primarySource, "display-notation-system", ["english", "german"]);
  applyDataSettingToControl(primarySource, "chord-size", ["1", "2", "3", "4", "5", "6"]);
  const enharmonicPreference = getEnharmonicPreference(configuredEnharmonicPreference);
  const chordElements = [];
  const songs = [];
  let transposeSemitones = 0;

  for (const source of sources) {
    renderSong(source);
  }

  /**
   * Renders one chord sheet `<pre>` into a song section in place.
   * @param {HTMLElement} source Source element to replace.
   * @returns {void}
   */
  function renderSong(source) {
    const song = document.createElement("section");
    song.className = "song";

    const lines = source.textContent.replace(/\r\n?/g, "\n").split("\n");
    if (lines.at(-1) === "") lines.pop();
    const configuredNotationSystem = getDataSetting(
      source,
      "notation-system",
      ["english", "german", "auto"],
      CHORD_NOTATION_SYSTEM,
    );
    const detectChords = getDataSetting(source, "detect-chords", ["comma"], null);
    const chordSourceLines = detectChords === "comma"
      ? lines.filter((line) => line.startsWith(",")).map((line) => line.slice(1))
      : lines.filter((_, index) => index % 2 === 0);
    const detectedNotationSystem = detectNotationSystem(chordSourceLines);
    const notationSystem = configuredNotationSystem === "auto"
      ? detectedNotationSystem
      : configuredNotationSystem;
    const internalMarkup = getDataSetting(source, "internal-markup", ["mediawiki"], null) === "mediawiki";
    const songConfig = {
      enharmonicPreference: hasEnharmonicControl
        ? enharmonicPreference
        : getDataSetting(source, "enharmonic-preference", ["sharps", "flats", "as-is"], CHORD_ENHARMONIC_PREFERENCE),
      displayNotationSystem: hasDisplaySystemControl
        ? getDisplayNotationSystem(configuredDisplayNotationSystem)
        : getDataSetting(source, "display-notation-system", ["english", "german"], null),
      transpose: hasTransposeControl ? 0 : getTransposeSetting(source) ?? 0,
    };
    if (!hasChordSizeControl) {
      const size = getDataSetting(source, "chord-size", ["1", "2", "3", "4", "5", "6"], null);
      if (size !== null) song.style.setProperty("--chord-size", `${size}em`);
    }

    const pairs = [];
    if (detectChords === "comma") {
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (line.startsWith(",")) {
          const hasLyric = index + 1 < lines.length && !lines[index + 1].startsWith(",");
          pairs.push({ chord: line.replace(/^,/, " "), lyric: hasLyric ? lines[++index] : "" });
        } else {
          pairs.push({ chord: "", lyric: line });
        }
      }
    } else {
      for (let index = 0; index < lines.length; index += 2) {
        pairs.push({ chord: lines[index] ?? "", lyric: lines[index + 1] ?? "" });
      }
    }

    for (const { chord: chordSource, lyric: lyricSource } of pairs) {
      const lyricLine = Array.from(lyricSource ?? "");
      const chords = [...(chordSource ?? "").matchAll(/\S+/g)].map((match) => {
        const parsed = parseChord(match[0], notationSystem);
        return {
          parsed,
          chord: parsed
            ? respellChord(parsed, songConfig.enharmonicPreference, songConfig.displayNotationSystem)
            : match[0],
          column: Array.from((chordSource ?? "").slice(0, match.index)).length,
        };
      });

      const row = document.createElement("article");
      row.className = "song-line";

      let cursor = 0;
      for (const [chordIndex, item] of chords.entries()) {
        if (item.column > cursor) {
          addFragment(row, "", lyricLine.slice(cursor, item.column).join(""), internalMarkup);
        }

        const nextColumn = chords[chordIndex + 1]?.column ?? lyricLine.length;
        const chordElement = addFragment(row, item.chord, lyricLine.slice(item.column, nextColumn).join(""), internalMarkup);
        if (item.parsed) chordElements.push({ element: chordElement, parsed: item.parsed, config: songConfig });
        cursor = Math.max(cursor, nextColumn);
      }

      if (chords.length === 0) {
        addFragment(row, "", lyricLine.join(""), internalMarkup);
      } else if (cursor < lyricLine.length) {
        addFragment(row, "", lyricLine.slice(cursor).join(""), internalMarkup);
      }

      song.append(row);
    }

    source.replaceWith(song);
    songs.push(song);
  }

  const wordCharPattern = /[\p{L}\p{N}\p{M}]/u;

  /**
   * Returns the lyric element's text excluding invisible helpers.
   * @param {HTMLElement} element Lyric element.
   * @returns {string}
   */
  const visibleText = (element) => {
    let text = "";
    for (const node of element.childNodes) {
      if (
        node.nodeType === 1 &&
        (node.classList.contains("gap-pad") || node.classList.contains("word-dash"))
      ) {
        continue;
      }
      text += node.textContent;
    }
    return text;
  };

  /**
   * Returns the first or last visible character of a lyric element's text.
   * @param {HTMLElement} element Lyric element.
   * @param {boolean} fromEnd Whether to take the last character.
   * @returns {string | undefined}
   */
  const edgeChar = (element, fromEnd) => {
    const chars = Array.from(visibleText(element));
    return fromEnd ? chars.at(-1) : chars[0];
  };

  /**
   * Returns the bounding box covering an element's rendered text.
   * @param {HTMLElement} element Element whose text to measure.
   * @returns {{left: number, right: number} | null}
   */
  const textBounds = (element) => {
    let left = Infinity;
    let right = -Infinity;
    let found = false;
    for (const node of element.childNodes) {
      if (
        node.nodeType === 1 &&
        (node.classList.contains("gap-pad") || node.classList.contains("word-dash"))
      ) {
        continue;
      }
      const range = document.createRange();
      range.selectNode(node);
      for (const rect of range.getClientRects()) {
        left = Math.min(left, rect.left);
        right = Math.max(right, rect.right);
        found = true;
      }
    }
    return found ? { left, right } : null;
  };

  /**
   * Inserts dash markers into lyric fragments whose text ends in the middle of
   * a word: a hyphen at a real line break, an en dash inside a wide gap.
   * Trailing underscores in the source count as explicit word breaks.
   * @returns {void}
   */
  const updateWordBreakMarkers = () => {
    for (const row of songs.flatMap((song) => [...song.querySelectorAll(".song-line")])) {
      const fragments = [...row.querySelectorAll(".song-fragment")];
      for (const [index, fragment] of fragments.entries()) {
        const next = fragments[index + 1];
        if (!next) continue;
        const lyric = fragment.querySelector(".lyric");
        const nextLyric = next.querySelector(".lyric");
        if (!lyric || !nextLyric) continue;
        const splitsWord = lyric.classList.contains("forced-break") ||
          (wordCharPattern.test(edgeChar(lyric, true) ?? "") &&
            wordCharPattern.test(edgeChar(nextLyric, false) ?? ""));
        const wrapped = fragment.offsetTop !== next.offsetTop;

        let dashText = null;
        let dashMargin = 0;
        if (splitsWord && wrapped) {
          dashText = "-";
        } else if (splitsWord) {
          const bounds = textBounds(lyric);
          const nextBounds = textBounds(nextLyric);
          const fontSize = parseFloat(getComputedStyle(lyric).fontSize);
          const gap = bounds && nextBounds ? nextBounds.left - bounds.right : 0;
          if (gap > fontSize * 0.5) {
            dashText = "–";
            dashMargin = Math.max(0, gap / 2 - fontSize * 0.3);
          }
        }

        let dash = null;
        for (const child of lyric.children) {
          if (child.classList.contains("word-dash")) {
            dash = child;
            break;
          }
        }
        if (dashText === null) {
          dash?.remove();
        } else {
          if (!dash) {
            dash = document.createElement("span");
            dash.className = "word-dash";
            lyric.insertBefore(dash, lyric.querySelector(".gap-pad"));
          }
          dash.textContent = dashText;
          dash.style.marginLeft = `${dashMargin}px`;
        }
      }
    }
  };

  let breakMarkersScheduled = false;
  const scheduleWordBreakMarkers = () => {
    if (breakMarkersScheduled) return;
    breakMarkersScheduled = true;
    requestAnimationFrame(() => {
      breakMarkersScheduled = false;
      updateWordBreakMarkers();
    });
  };
  window.addEventListener("resize", scheduleWordBreakMarkers);
  if (typeof document !== "undefined" && document.fonts) {
    document.fonts.ready.then(scheduleWordBreakMarkers);
  }
  updateWordBreakMarkers();

  /** Rewrites displayed chord labels using the currently selected spellings. */
  const refreshChordSpellings = () => {
    for (const { element, parsed, config } of chordElements) {
      const preference = hasEnharmonicControl
        ? getEnharmonicPreference(configuredEnharmonicPreference)
        : config.enharmonicPreference;
      const displaySystem = hasDisplaySystemControl
        ? getDisplayNotationSystem(configuredDisplayNotationSystem)
        : config.displayNotationSystem;
      const transpose = hasTransposeControl ? transposeSemitones : config.transpose;
      renderChordLabel(
        element,
        respellChord(
          transposeChord(parsed, transpose),
          preference,
          displaySystem,
        ),
      );
    }
  };
  refreshChordSpellings();

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
    const normalized = ((transposeSemitones % 12) + 12) % 12;
    const radio = [...transposeRadios]
      .find((input) => getRadioValue(input) === String(transposeSemitones))
      ?? [...transposeRadios].find((input) => {
        const value = Number(getRadioValue(input));
        return Number.isInteger(value) && ((value % 12) + 12) % 12 === normalized;
      });
    if (radio) radio.checked = true;
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
  if (hasTransposeControl && configuredTranspose !== null) {
    setTranspose(configuredTranspose);
  }

  window.addEventListener("keydown", (event) => {
    if (!event.ctrlKey || event.altKey || event.metaKey) return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    ) {
      return;
    }

    const isReset = event.key === "Home";
    const delta = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : null;
    if (delta === null && !isReset) return;
    event.preventDefault();

    if (hasTransposeControl) {
      setTranspose(isReset ? 0 : transposeSemitones + delta);
      return;
    }
    for (const config of new Set(chordElements.map((item) => item.config))) {
      config.transpose = isReset ? 0 : (config.transpose + delta) % 12 || 0;
    }
    refreshChordSpellings();
  });

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
    for (const song of songs) song.style.setProperty("--chord-size", `${size}em`);
    updateWordBreakMarkers();
    return size;
  };
  const checkedRadio = sizeControl?.querySelector('input[name="chord-size"]:checked');
  const checkedSize = checkedRadio ? getRadioValue(checkedRadio) : undefined;
  const initialSize = configuredChordSize ?? checkedSize ?? sizeOutput?.textContent ?? 2;
  const size = hasChordSizeControl ? setChordSize(initialSize) : null;
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

  const THEME_STORAGE_KEY = "big-chords-theme";
  const validThemes = ["light", "auto", "dark"];
  const themeControl = document.querySelector(".theme-control");
  const themeRadios = themeControl?.querySelectorAll('input[name="theme"]') ?? [];
  const themeMedia = typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;
  const readStoredTheme = () => {
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      return null;
    }
  };
  const readThemePreference = () => {
    const stored = readStoredTheme();
    if (validThemes.includes(stored)) return stored;
    const checked = themeControl?.querySelector('input[name="theme"]:checked');
    const value = checked ? getRadioValue(checked) : null;
    return validThemes.includes(value) ? value : "auto";
  };
  const systemTheme = () => themeMedia?.matches ? "dark" : "light";
  const applyTheme = (preference = readThemePreference()) => {
    if (preference === "auto" && themeMedia === null) {
      document.documentElement.removeAttribute("data-theme");
      return;
    }
    document.documentElement.dataset.theme = preference === "auto" ? systemTheme() : preference;
  };
  const checkThemeRadio = (preference) => {
    const radio = [...themeRadios].find((input) => getRadioValue(input) === preference);
    if (radio) radio.checked = true;
  };
  const persistThemePreference = (preference) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      return;
    }
  };
  if (themeRadios.length > 0) {
    const initialTheme = readThemePreference();
    checkThemeRadio(initialTheme);
    applyTheme(initialTheme);
    themeControl.addEventListener("change", (event) => {
      if (event.target.name !== "theme") return;
      const preference = getRadioValue(event.target);
      if (!validThemes.includes(preference)) return;
      persistThemePreference(preference);
      applyTheme(preference);
    });
    if (themeMedia) {
      const onSystemThemeChange = () => {
        if (readThemePreference() === "auto") applyTheme("auto");
      };
      if (typeof themeMedia.addEventListener === "function") {
        themeMedia.addEventListener("change", onSystemThemeChange);
      } else {
        themeMedia.addListener?.(onSystemThemeChange);
      }
    }
  }

  /**
   * Adds one chord-and-lyric fragment to a rendered song line.
   * @param {HTMLElement} row Parent line element.
   * @param {string} chord Chord label, or an empty string for no chord.
   * @param {string} lyric Corresponding lyric fragment.
   * @param {boolean} markup Whether to parse MediaWiki-style ''italic'' and '''bold''' markup.
   * @returns {HTMLElement} The fragment's chord element.
   */
  function addFragment(row, chord, lyric, markup) {
    const fragment = document.createElement("div");
    fragment.className = "song-fragment";

    const chordElement = document.createElement("em");
    renderChordLabel(chordElement, chord);
    fragment.append(chordElement);

    const lyricElement = document.createElement("span");
    lyricElement.className = "lyric";
    const forcedBreak = /_+$/.test(lyric);
    renderLyricText(
      lyricElement,
      forcedBreak ? lyric.replace(/_+$/, "") : lyric,
      markup,
    );
    if (forcedBreak) {
      lyricElement.classList.add("forced-break");
      const pad = document.createElement("span");
      pad.className = "gap-pad";
      pad.textContent = lyric.match(/_+$/)[0];
      lyricElement.append(pad);
    }
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
   * Parses MediaWiki-style ''italic'' and '''bold''' markers into a token tree.
   * Unclosed markers and single quotes are kept as literal text.
   * @param {string} text Text to parse.
   * @returns {{type: string, text?: string, children?: object[]}[]} Token list.
   */
  function parseInlineMarkup(text) {
    const tokens = [];
    let buffer = "";
    let index = 0;
    const flush = () => {
      if (buffer) tokens.push({ type: "text", text: buffer });
      buffer = "";
    };
    while (index < text.length) {
      const marker = text.startsWith("'''", index)
        ? "'''"
        : text.startsWith("''", index)
          ? "''"
          : null;
      if (marker === null) {
        buffer += text[index];
        index += 1;
        continue;
      }
      const end = text.indexOf(marker, index + marker.length);
      if (end === -1) {
        buffer += marker;
        index += marker.length;
        continue;
      }
      flush();
      tokens.push({
        type: marker === "'''" ? "bold" : "italic",
        children: parseInlineMarkup(text.slice(index + marker.length, end)),
      });
      index = end + marker.length;
    }
    flush();
    return tokens;
  }

  /**
   * Appends parsed markup tokens to a parent element as DOM nodes.
   * @param {HTMLElement} parent Parent element.
   * @param {object[]} tokens Tokens from parseInlineMarkup.
   * @returns {void}
   */
  function appendMarkupNodes(parent, tokens) {
    for (const token of tokens) {
      if (token.type === "text") {
        parent.append(document.createTextNode(token.text));
      } else {
        const element = document.createElement(token.type === "bold" ? "strong" : "em");
        appendMarkupNodes(element, token.children);
        parent.append(element);
      }
    }
  }

  /**
   * Fills a lyric element with text, optionally parsing MediaWiki-style markup.
   * @param {HTMLElement} element Lyric element.
   * @param {string} text Lyric text.
   * @param {boolean} markup Whether to parse ''italic'' and '''bold'''.
   * @returns {void}
   */
  function renderLyricText(element, text, markup) {
    element.replaceChildren();
    if (markup) appendMarkupNodes(element, parseInlineMarkup(text));
    else element.textContent = text;
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
   * @param {HTMLElement} source Chord sheet `<pre>` element.
   * @param {string} name Data-attribute name without the `data-` prefix.
   * @param {string[]} validValues Accepted values.
   * @param {string | null} fallback Value returned when neither element has a valid setting.
   * @returns {string | null}
   */
  function getDataSetting(source, name, validValues, fallback) {
    for (const element of [source, scriptElement]) {
      const value = element?.getAttribute(`data-${name}`);
      if (validValues.includes(value)) return value;
    }
    return fallback;
  }

  /**
   * Reads a validated transposition offset, preferring the chord sheet's `<pre>` over the script element.
   * Any integer is accepted and reduced modulo 12 to the -11 to +11 range.
   * @param {HTMLElement} source Chord sheet `<pre>` element.
   * @returns {number | null} Offset in semitones, or null when unset or invalid.
   */
  function getTransposeSetting(source) {
    for (const element of [source, scriptElement]) {
      const raw = element?.getAttribute("data-transpose");
      if (raw === null || raw === undefined || !/^-?\d+$/.test(raw.trim())) continue;
      return Number.parseInt(raw, 10) % 12 || 0;
    }
    return null;
  }

  /**
   * Sets the radio matching a configured data setting, when that control exists.
   * @param {HTMLElement} source Chord sheet `<pre>` element the setting is read from.
   * @param {string} name Radio group and data-attribute name.
   * @param {string[]} validValues Accepted values.
   * @returns {void}
   */
  function applyDataSettingToControl(source, name, validValues) {
    const value = getDataSetting(source, name, validValues, null);
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
    if (input.name === "theme" && input.value === "on") {
      const label = input.closest("label")?.textContent.trim().toLowerCase() ?? "";
      if (label.includes("auto")) return "auto";
      if (label.includes("☼") || label.includes("light")) return "light";
      if (label.includes("☽") || label.includes("dark")) return "dark";
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
   * A slash suffix that is not a note (e.g. `/-5`, `/+5`) is kept as part of the quality.
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
    const alteration = parts.length === 2 && !bassMatch && /^[+-]\d+$/.test(parts[1])
      ? parts[1]
      : null;
    if (parts.length === 2 && !bassMatch && !alteration) return null;

    const root = {
      letter: normalizeNoteLetter(rootMatch[1]),
      accidental: normalizeAccidental(rootMatch[2]),
    };
    root.pitchClass = getPitchClass(root, system);
    const quality = rootMatch[3]
      .replace(/[Ьь]/g, "♭")
      .replace(/#/g, "♯")
      .replace(/([A-Z])b/g, "$1♭")
      + (alteration ? `/${alteration}` : "");
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
   * Converts a note to a pitch class, or returns null when B is ambiguous.
   * H is always German B natural, so its pitch class is known in every system.
   * @param {ParsedNote} note Note to convert.
   * @param {NotationSystem} system Notation used to interpret B.
   * @returns {number | null} Semitone number from C, in the range 0–11.
   */
  function getPitchClass(note, system) {
    const naturalPitchClasses = { A: 9, B: 11, C: 0, D: 2, E: 4, F: 5, G: 7, H: 11 };
    if (note.letter === "B" && system === "german") naturalPitchClasses.B = 10;
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

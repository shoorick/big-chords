(() => {
  "use strict";

  const source = document.querySelector("pre[data-chord-lines]");
  if (!source) return;

  const song = document.createElement("section");
  song.className = "song";

  const lines = source.textContent.replace(/\r\n?/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();

  for (let index = 0; index < lines.length; index += 2) {
    const lyricLine = Array.from(lines[index + 1] ?? "");
    const chords = [...(lines[index] ?? "").matchAll(/\S+/g)].map((match) => ({
      chord: normalizeChord(match[0]),
      column: Array.from((lines[index] ?? "").slice(0, match.index)).length,
    }));

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

  function normalizeChord(chord) {
    const lookalikes = { "А": "A", "В": "B", "С": "C", "Е": "E", "Н": "H" };
    return chord
      .replace(/^([АВСЕН])/, (_, letter) => lookalikes[letter])
      .replace(/\/([АВСЕН])/, (_, letter) => `/${lookalikes[letter]}`);
  }
})();

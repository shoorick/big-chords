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
      chord: match[0],
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
})();

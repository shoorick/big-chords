const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseInlineMarkup } = require("../js/big-chords.js");

test("returns plain text as a single token", () => {
  assert.deepEqual(parseInlineMarkup("просто текст"), [
    { type: "text", text: "просто текст" },
  ]);
});

test("parses italic and bold markers", () => {
  assert.deepEqual(parseInlineMarkup("a ''b'' c '''d''' e"), [
    { type: "text", text: "a " },
    { type: "italic", children: [{ type: "text", text: "b" }] },
    { type: "text", text: " c " },
    { type: "bold", children: [{ type: "text", text: "d" }] },
    { type: "text", text: " e" },
  ]);
});

test("keeps unclosed and single quotes as literal text", () => {
  assert.deepEqual(parseInlineMarkup("rock 'n' roll ''oops"), [
    { type: "text", text: "rock 'n' roll ''oops" },
  ]);
});

test("nests italic inside bold", () => {
  assert.deepEqual(parseInlineMarkup("'''a ''b'' c'''"), [
    {
      type: "bold",
      children: [
        { type: "text", text: "a " },
        { type: "italic", children: [{ type: "text", text: "b" }] },
        { type: "text", text: " c" },
      ],
    },
  ]);
});

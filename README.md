# Big Chords

`js/split.js` turns a chord sheet inside a `<pre>` element into responsive HTML fragments. It expects lines in pairs: a chord line followed by a lyric line. Chords and lyrics are split at matching character columns, so they stay aligned as the fragments wrap. If the page includes a `.chord-size-control`, its <kbd>+</kbd> and <kbd>−</kbd> buttons adjust the chord size.

## How to use it

Add the script and stylesheet to an HTML page containing a chord sheet, then open the page in a browser.

## Example

Link the stylesheet and script from an HTML page:

```html
<link rel="stylesheet" href="css/style.css" />
<script src="js/split.js" defer></script>

<pre data-chord-lines>C                 F      C
Twinkle, twinkle, little star,
F     C      G        C
How I wonder what you are!</pre>
```

Optionally, add a chord-size control:

```html
<div class="chord-size-control">
  Chord size
  <button
    type="button"
    id="chord-size-decrease"
    aria-label="Shrink chords">
    −
  </button>
  <output id="chord-size-value" aria-live="polite">2</output>
  <button
    type="button"
    id="chord-size-increase"
    aria-label="Enlarge chords">
    +
  </button>
</div>
```

The result looks like this:

![Formatted page](twinkle.png)

## Examples

Examples are in the `samples/` directory:

- [Jingle Bells](samples/jingle-bells.html)
- [Jingle Bells — all-in-one](samples/jingle-bells-offline.html) (see below)

For pages in `samples/`, use the paths `../css/style.css` and `../js/split.js`.

## Troubleshooting

The page has been tested in Google Chrome 156 on desktop.

When opened through an Android file picker, mobile browsers such as Google Chrome and Mi Browser may not load the page's external script and stylesheet.

### Possible solutions

Use the [all-in-one version](samples/jingle-bells-offline.html), which includes the script and stylesheet in the HTML file.

Or serve the files over HTTP. For example, run one of these commands from the project root:

```bash
php -S localhost:8000
```

Or, with Python:

```bash
python3 -m http.server 8000
```

You can also use [Simple HTTP Server: Wi-Fi Share](https://apps.ubi.jp/en/apps/simple-http-server/), available on [Google Play](https://play.google.com/store/apps/details?id=jp.ubi.common.http.server).

To open the page in a browser on the same phone, set **Network interface** to `localhost only`. Use `Wi-Fi only` to access the server from another device on the same network, or `All networks` for both. Restart the server if the app asks you to.

After starting the server from the project root, open http://localhost:8000/samples/jingle-bells.html in your browser.

## Available on GitHub

The project is hosted at [github.com/shoorick/big-chords](https://github.com/shoorick/big-chords).

Feel free to [report issues](https://github.com/shoorick/big-chords/issues).

## Author

Alexander Sapozhnikov <shoorick@cpan.org>

## License

The project's source code is available under the MIT License; see [LICENSE](LICENSE). Song lyrics and other third-party material in `samples/` are not covered by this license.

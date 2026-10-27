# tratra

A small Firefox add-on that translates the text you select inside any input field **in place**, by round-tripping it through a pivot language (English → Japanese → English by default).

Select text in a textarea, input, or contenteditable element, press the hotkey, and the selection is replaced with the translation. Handy for checking what your own writing sounds like after a round trip, or for quickly rephrasing text without leaving the page.

## Features

- Works in `<textarea>`, text input types, and `contenteditable` elements (including inside iframes).
- Round-trip translation: source → pivot → target, configurable per language.
- Configurable hotkey, recorded directly in the options page.
- Live settings: changes apply to all open tabs immediately, no reload needed.
- Automatic retry with exponential backoff when the translation endpoint rate-limits (HTTP 429).

## Install

Requires Firefox 78 or newer.

### Temporary (for development)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `manifest.json` in this directory.

The add-on is removed when Firefox restarts.

### Permanent

The add-on is not signed, so a regular Firefox release will refuse to install it permanently. Either:

- Sign it on [addons.mozilla.org](https://addons.mozilla.org/developers/) (unlisted or listed), or
- Use Firefox Developer Edition / Nightly with `xpinstall.signatures.required` set to `false` in `about:config`, or
- Run it with [`web-ext`](https://github.com/mozilla/web-ext):

  ```sh
  npx web-ext run
  ```

## Usage

1. Select some text inside an editable field.
2. Press the hotkey. The default is **Ctrl + Y**.
3. The selection is replaced with the translated result.

If nothing is selected, nothing happens. Translation errors are logged to the browser console with a `[tratra]` prefix.

## Settings

Open the add-on's options page (Add-ons Manager → tratra → Preferences, or `about:addons` → **…** → **Options**).

| Setting | Default | Description |
| --- | --- | --- |
| Source language | `en` | Language of the selected text, or `auto` for detection. |
| Pivot language | `ja` | Language used for the intermediate step. |
| Target language | `en` | Language of the result that replaces the selection. |
| Wait after pivot | `1500` ms | Delay before the second request, to avoid rate limiting. |
| Hotkey | `Ctrl + Y` | Any combination that includes Ctrl, Alt, Shift, or Meta. |

The options page warns about combinations reserved by the browser (e.g. `Ctrl+T`, `Ctrl+W`), since those cannot be reliably intercepted.

## How it works

```
content.js  ──message──▶  background.js  ──▶  translate.googleapis.com
   ▲                              │
   └──────── result ──────────────┘
```

- **`content.js`** listens for the hotkey in every frame. On a match it grabs the selection, asks the background script to translate it, and writes the result back into the field (using `setRangeText` for inputs/textareas and `execCommand`/Range APIs for contenteditable, then firing an `input` event so the page notices the change).
- **`background.js`** handles the two translation requests and the wait between them. It retries up to three times on HTTP 429 with 5 s / 10 s / 20 s backoff.
- **`options.js` / `options.html`** provide the settings UI and persist to `browser.storage.local` under the keys `hotkey` and `translateConfig`.

Settings are read at request time, so saved changes take effect immediately in all tabs.

### Files

```
manifest.json   Manifest V2, background script, content script, options page
background.js   Translation pipeline and message handler
content.js      Hotkey detection and in-place text replacement
options.html    Settings UI markup and styles
options.js      Settings UI logic and storage
```

## Privacy

Selected text is sent to `https://translate.googleapis.com/` (Google Translate's unofficial web endpoint) for translation. That is the only network request the add-on makes. No text is stored; the only data kept locally is your hotkey and language settings in `browser.storage.local`.

## Limitations

- Uses an undocumented Google Translate endpoint. If Google changes it, translation will fail until the endpoint is updated.
- Translation is block-and-replace: there is no preview, undo, or batch mode. Use the browser's own undo (`Ctrl+Z`) to revert a replacement.
- Some sites override key handling or implement custom editors; replacement may not work in every rich-text widget.
- Manifest V2; Firefox is the only supported browser.

## Development

There is no build step — the files in this directory are the add-on. Edit them and reload the temporary add-on from `about:debugging` to test changes. Browser console messages from the add-on are prefixed with `[tratra]`.

```sh
# lint / run with web-ext (optional)
npx web-ext lint
npx web-ext run
```

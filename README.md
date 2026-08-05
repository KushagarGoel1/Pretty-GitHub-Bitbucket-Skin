# Pretty GitHub — Bitbucket Skin

A tiny Chrome extension that restyles **github.com** to look like Atlassian
Bitbucket: the blue accent (`#0052cc`), softer neutral grays, and Bitbucket-style
diffs (mint-green additions, salmon-red deletions with tinted line-number gutters).

Pure UI overwrite — **no login, no permissions beyond `storage`** (used only to
remember your on/off toggle). No network calls, no data collection.

## Install (unpacked)

1. Open `chrome://extensions` in Chrome.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select this folder (`pretty-github`).
4. Visit any page on github.com — it's restyled instantly.

Click the toolbar icon to toggle the skin on/off (changes apply live; reload the
tab if a page ever looks half-styled).

## Files

| File                 | Purpose                                                  |
|----------------------|----------------------------------------------------------|
| `manifest.json`      | MV3 manifest — injects the skin on `https://github.com/*`|
| `bitbucket-skin.css` | All the styling, gated on `html.pretty-github-bb`        |
| `skin.js`            | Adds the body marker, persists across SPA navigations    |
| `popup.html/.js`     | On/off toggle                                            |
| `icons/`             | Toolbar icons                                            |

## Tweaking

All colors are CSS variables at the top of `bitbucket-skin.css` (`--bb-blue`,
`--bb-add-bg`, etc.). Change them and reload the extension.

GitHub ships UI changes often; if a specific element stops matching, its class
name likely changed — update the corresponding selector in the CSS.

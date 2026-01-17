# Pokechill Automation Scripts

This repo holds browser-injected automation helpers for Pokechill.

## Auto-refight (manual click)

`auto-refight-bookmarklet.js` injects a checkbox into the combat UI. When enabled, it waits for the battle-end screen and triggers the normal **Fight Again** button (`#area-rejoin`). It does **not** use the paid auto-refight feature.

### Usage (bookmarklet)

1. Copy the contents of `auto-refight-bookmarklet.js`.
2. Create a new bookmark in your browser.
3. Set the bookmark URL to `javascript:` followed by the script contents.
4. While on Pokechill, click the bookmark to inject the UI.
5. Click the checkbox to enable/disable. Running the bookmarklet again removes it.

### Usage (console)

Paste the contents of `auto-refight-bookmarklet.js` into the browser console while playing.

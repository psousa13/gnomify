# Spotify Media Controls — GNOME Shell Extension

A GNOME Shell extension (GNOME 45–50, GJS/ESM format) that puts Spotify
controls in your top panel: current track, play/pause, next, and previous.
It uses the standard **MPRIS2 D-Bus interface**, so it also works with other
MPRIS-compatible players (it prefers Spotify, and falls back to whatever is
playing).

## Features

- Play / pause / next / previous from the panel and the dropdown menu
- Live track title + artist display
- Buttons auto-dim when the player can't perform an action
- Preferences to toggle the panel text and inline controls
- "Open Player" to raise the Spotify window

## Files

| File | Purpose |
|------|---------|
| `metadata.json` | Extension manifest (UUID, supported shell versions) |
| `extension.js` | Panel button + menu UI, wires up MPRIS |
| `mpris.js` | MPRIS2 D-Bus wrapper + player manager |
| `prefs.js` | libadwaita preferences window |
| `stylesheet.css` | Panel/menu styling |
| `schemas/*.gschema.xml` | GSettings schema |

## Install (manual)

```bash
# 1. Copy the folder into your local extensions directory
cp -r "spotify-controls@v0.dev" ~/.local/share/gnome-shell/extensions/

# 2. Compile the settings schema
glib-compile-schemas ~/.local/share/gnome-shell/extensions/spotify-controls@v0.dev/schemas/

# 3. Restart GNOME Shell
#    - Wayland: log out and back in
#    - X11: press Alt+F2, type "r", press Enter

# 4. Enable the extension
gnome-extensions enable spotify-controls@v0.dev
```

Open preferences with:

```bash
gnome-extensions prefs spotify-controls@v0.dev
```

## Notes

- Open Spotify and start playback — the controls activate once an MPRIS
  player is on the session bus.
- Spotify's Linux clients (official deb/snap/flatpak) all expose MPRIS by
  default, so no extra Spotify configuration is needed.

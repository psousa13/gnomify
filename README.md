# Gnomify — Spotify Controls for GNOME 50

A GNOME Shell extension that brings Spotify into your top panel: current track, cover art, and playback controls. Built using the **MPRIS2 D-Bus interface**.

## Features
- Live track title + artist display in the top panel
- Dropdown menu with cover art, track info, and playback controls
- Play / pause / next / previous buttons
- Buttons auto-dim when an action isn't available
- Automatically appears and disappears with Spotify

## Files
| File | Purpose |
|------|---------|
| `metadata.json` | Extension manifest (UUID, supported shell versions) |
| `extension.js` | Panel button + dropdown menu UI |
| `mpris.js` | MPRIS2 D-Bus wrapper + player manager |
| `prefs.js` | Preferences window (About) |
| `stylesheet.css` | Panel and menu styling |
| `schemas/*.gschema.xml` | GSettings schema |

## Install (manual)
```bash
# 1. Copy the folder into your local extensions directory
cp -r "gnomify@psousa13" ~/.local/share/gnome-shell/extensions/

# 2. Compile the settings schema
glib-compile-schemas ~/.local/share/gnome-shell/extensions/gnomify@psousa13/schemas/

# 3. Restart GNOME Shell
#    - Wayland: log out and back in
#    - X11: press Alt+F2, type "r", press Enter

# 4. Enable the extension
gnome-extensions enable gnomify@psousa13
```

## Notes
- Open Spotify and start playback — Gnomify will appear in the panel automatically.
- Spotify's Linux clients (official deb/snap/flatpak) all expose MPRIS by default, so no extra configuration is needed.

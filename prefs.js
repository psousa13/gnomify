// prefs.js — Gnomify preferences (GNOME 45+)

import Adw from 'gi://Adw';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class GnomifyPrefs extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const page = new Adw.PreferencesPage({
      title: 'About',
      icon_name: 'audio-x-generic-symbolic',
    });
    window.add(page);

    const group = new Adw.PreferencesGroup({
      title: 'Gnomify',
      description:
        'Brings Spotify into your GNOME panel.\n\n' +
        'The extension appears automatically when Spotify is running and ' +
        'disappears when it is closed. Click the panel button to see the ' +
        'current track, cover art, and playback controls.',
    });
    page.add(group);

    const versionRow = new Adw.ActionRow({
      title: 'Version',
      subtitle: '1.0.0',
    });
    group.add(versionRow);

    const authorRow = new Adw.ActionRow({
      title: 'Author',
      subtitle: 'psousa13',
    });
    group.add(authorRow);

    const sourceRow = new Adw.ActionRow({
      title: 'Source Code',
      subtitle: 'github.com/psousa13/gnomify',
    });
    group.add(sourceRow);
  }
}

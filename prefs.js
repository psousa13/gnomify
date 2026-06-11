// prefs.js — Gnomify preferences (GNOME 45+)

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class GnomifyPrefs extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings();

    // ── Appearance page ───────────────────────────────────────────────────
    const appearancePage = new Adw.PreferencesPage({
      title: 'Appearance',
      icon_name: 'applications-graphics-symbolic',
    });
    window.add(appearancePage);

    const styleGroup = new Adw.PreferencesGroup({
      title: 'Popup Style',
      description: 'Choose between the system theme or a frosted glass look.',
    });
    appearancePage.add(styleGroup);

    // Style toggle row
    const styleRow = new Adw.ActionRow({
      title: 'Transparent',
      subtitle: 'Frosted glass style inspired by macOS',
    });

    const styleSwitch = new Gtk.Switch({
      active: settings.get_string('popup-style') === 'transparent',
      valign: Gtk.Align.CENTER,
    });
    styleRow.add_suffix(styleSwitch);
    styleRow.activatable_widget = styleSwitch;
    styleGroup.add(styleRow);

    // Transparency slider row
    const sliderRow = new Adw.ActionRow({
      title: 'Opacity',
      subtitle: 'Adjust the background opacity in transparent mode',
      sensitive: settings.get_string('popup-style') === 'transparent',
    });

    const sliderBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 8,
      valign: Gtk.Align.CENTER,
      width_request: 200,
    });

    const slider = new Gtk.Scale({
      orientation: Gtk.Orientation.HORIZONTAL,
      adjustment: new Gtk.Adjustment({
        lower: 0.1,
        upper: 0.95,
        step_increment: 0.05,
        value: settings.get_double('transparency'),
      }),
      draw_value: true,
      value_pos: Gtk.PositionType.RIGHT,
      digits: 2,
      hexpand: true,
    });

    sliderBox.append(slider);
    sliderRow.add_suffix(sliderBox);
    styleGroup.add(sliderRow);

    // Wire up style switch → enable/disable slider, update setting
    styleSwitch.connect('notify::active', () => {
      const isTransparent = styleSwitch.active;
      settings.set_string('popup-style', isTransparent ? 'transparent' : 'solid');
      sliderRow.sensitive = isTransparent;
    });

    // Wire up slider → update setting
    slider.connect('value-changed', () => {
      settings.set_double('transparency', slider.get_value());
    });

    // ── About page ────────────────────────────────────────────────────────
    const aboutPage = new Adw.PreferencesPage({
      title: 'About',
      icon_name: 'help-about-symbolic',
    });
    window.add(aboutPage);

    const aboutGroup = new Adw.PreferencesGroup({ title: 'Gnomify' });
    aboutPage.add(aboutGroup);

    aboutGroup.add(new Adw.ActionRow({ title: 'Version',     subtitle: '1.0.0' }));
    aboutGroup.add(new Adw.ActionRow({ title: 'Author',      subtitle: 'psousa13' }));
    aboutGroup.add(new Adw.ActionRow({ title: 'Source Code', subtitle: 'github.com/psousa13/gnomify' }));
  }
}

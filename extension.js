// extension.js — Gnomify (GNOME 45-50)
// Spotify panel controls: track label, cover art, playback buttons.
// Hides entirely when Spotify is not running.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { MprisManager } from './mpris.js';

const ART_SIZE = 48;

function loadArtAsync(url, callback) {
  if (!url) { callback(null); return; }
  try {
    const file = Gio.File.new_for_uri(url);
    file.load_contents_async(null, (f, res) => {
      try {
        const [, data] = f.load_contents_finish(res);
        const bytes = GLib.Bytes.new(data);
        callback(Gio.BytesIcon.new(bytes));
      } catch (_) { callback(null); }
    });
  } catch (_) { callback(null); }
}

const GnomifyIndicator = GObject.registerClass(
  class GnomifyIndicator extends PanelMenu.Button {
    _init() {
      super._init(0.5, 'Gnomify');
      this._lastArtUrl = null;

      // ── Panel bar ─────────────────────────────────────────────────────────
      this._box = new St.BoxLayout({
        style_class: 'panel-status-menu-box spotify-panel-box',
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
      });
      this.add_child(this._box);

      this._icon = new St.Icon({
        icon_name: 'audio-x-generic-symbolic',
        style_class: 'system-status-icon',
      });
      this._box.add_child(this._icon);

      this._panelLabel = new St.Label({
        text: '',
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'spotify-panel-label',
      });
      this._box.add_child(this._panelLabel);

      // ── Popup menu ────────────────────────────────────────────────────────
      this._buildMenu();

      // ── MPRIS ─────────────────────────────────────────────────────────────
      this._manager = new MprisManager();
      this._managerId = this._manager.connect('player-changed', () => this._sync());

      this._sync();
    }

    _buildMenu() {
      this._topItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false });
      const topBox = new St.BoxLayout({ style_class: 'spotify-top-box' });

      this._artTexture = new St.Icon({
        icon_name: 'audio-x-generic-symbolic',
        style_class: 'spotify-art',
        icon_size: ART_SIZE,
      });
      topBox.add_child(this._artTexture);

      const infoBox = new St.BoxLayout({ vertical: true, style_class: 'spotify-info-box' });
      this._titleLabel  = new St.Label({ text: '—', style_class: 'spotify-title' });
      this._artistLabel = new St.Label({ text: '',  style_class: 'spotify-artist' });
      infoBox.add_child(this._titleLabel);
      infoBox.add_child(this._artistLabel);
      topBox.add_child(infoBox);

      this._topItem.add_child(topBox);
      this.menu.addMenuItem(this._topItem);
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      this._controlsItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false });
      const controlsBox = new St.BoxLayout({
        x_expand: true,
        x_align: Clutter.ActorAlign.CENTER,
        style_class: 'spotify-controls-box',
      });

      this._menuPrev = this._makeBtn('media-skip-backward-symbolic', () => this._withPlayer(p => p.previous()));
      this._menuPlay = this._makeBtn('media-playback-start-symbolic', () => this._withPlayer(p => p.playPause()));
      this._menuNext = this._makeBtn('media-skip-forward-symbolic',  () => this._withPlayer(p => p.next()));

      controlsBox.add_child(this._menuPrev);
      controlsBox.add_child(this._menuPlay);
      controlsBox.add_child(this._menuNext);
      this._controlsItem.add_child(controlsBox);
      this.menu.addMenuItem(this._controlsItem);
    }

    _makeBtn(iconName, onClick) {
      const btn = new St.Button({
        style_class: 'spotify-menu-control',
        child: new St.Icon({ icon_name: iconName, icon_size: 20 }),
        can_focus: true,
      });
      btn.connect('clicked', () => { onClick(); return Clutter.EVENT_STOP; });
      return btn;
    }

    _withPlayer(fn) {
      const p = this._manager?.activePlayer;
      if (p?.available) fn(p);
    }

    _sync() {
      const player = this._manager?.activePlayer;

      if (!player || !player.available) {
        this.hide();
        return;
      }
      this.show();

      const { title, artist, artUrl } = player.metadata;
      const isPlaying = player.status === 'Playing';

      const panelText = artist ? `${title} — ${artist}` : title;
      this._panelLabel.text    = panelText;
      this._panelLabel.visible = panelText.length > 0;

      this._titleLabel.text     = title  || '—';
      this._artistLabel.text    = artist || '';
      this._artistLabel.visible = !!artist;

      this._menuPlay.child.icon_name = isPlaying
        ? 'media-playback-pause-symbolic'
        : 'media-playback-start-symbolic';

      const canNext = player.canGoNext;
      const canPrev = player.canGoPrevious;
      const canPlay = player.canPlay || player.canPause;
      this._menuPrev.reactive = canPrev; this._menuPrev.opacity = canPrev ? 255 : 80;
      this._menuNext.reactive = canNext; this._menuNext.opacity = canNext ? 255 : 80;
      this._menuPlay.reactive = canPlay; this._menuPlay.opacity = canPlay ? 255 : 80;

      if (artUrl !== this._lastArtUrl) {
        this._lastArtUrl = artUrl;
        this._artTexture.gicon     = null;
        this._artTexture.icon_name = 'audio-x-generic-symbolic';
        loadArtAsync(artUrl, (gicon) => {
          if (gicon && this._artTexture) {
            this._artTexture.gicon     = gicon;
            this._artTexture.icon_name = null;
          }
        });
      }
    }

    destroy() {
      if (this._managerId && this._manager) {
        this._manager.disconnect(this._managerId);
        this._managerId = null;
      }
      if (this._manager) {
        this._manager.destroy();
        this._manager = null;
      }
      super.destroy();
    }
  }
);

export default class GnomifyExtension extends Extension {
  enable() {
    this._indicator = new GnomifyIndicator();
    Main.panel.addToStatusArea(this.uuid, this._indicator);
  }

  disable() {
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
  }
}

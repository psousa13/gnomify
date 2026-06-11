// mpris.js
// MPRIS2 D-Bus wrapper — Spotify-focused, GNOME 45+ (GJS ES modules).
//
// Fix summary vs the original:
//  1. Use Gio.DBusProxy.makeProxyWrapper() so the proxy is fully typed and
//     g_name_owner is populated correctly on GNOME 45-50.
//  2. Proxy init is synchronous-ish via makeProxyWrapper (it still goes async
//     internally but the returned object is immediately usable once the
//     callback fires).
//  3. MprisManager re-emits player-changed when the player itself fires
//     'changed', so the UI updates as soon as the proxy is live.
//  4. Spotify-only focus: no fallback to arbitrary MPRIS players unless you
//     want to keep the generic fallback (it's still there but clearly opt-in).

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

const MPRIS_PREFIX    = 'org.mpris.MediaPlayer2.';
const MPRIS_PATH      = '/org/mpris/MediaPlayer2';
const PLAYER_IFACE    = 'org.mpris.MediaPlayer2.Player';
const SPOTIFY_BUS     = 'org.mpris.MediaPlayer2.spotify';

// Full MPRIS Player interface XML — lets makeProxyWrapper expose every prop
// and method with correct types so get_cached_property works reliably.
const PLAYER_IFACE_XML = `
<node>
  <interface name="org.mpris.MediaPlayer2.Player">
    <method name="PlayPause"/>
    <method name="Play"/>
    <method name="Pause"/>
    <method name="Stop"/>
    <method name="Next"/>
    <method name="Previous"/>
    <method name="Seek">
      <arg direction="in"  type="x" name="Offset"/>
    </method>
    <method name="SetPosition">
      <arg direction="in"  type="o" name="TrackId"/>
      <arg direction="in"  type="x" name="Position"/>
    </method>
    <property name="PlaybackStatus" type="s"  access="read"/>
    <property name="LoopStatus"     type="s"  access="readwrite"/>
    <property name="Rate"           type="d"  access="readwrite"/>
    <property name="Shuffle"        type="b"  access="readwrite"/>
    <property name="Metadata"       type="a{sv}" access="read"/>
    <property name="Volume"         type="d"  access="readwrite"/>
    <property name="Position"       type="x"  access="read"/>
    <property name="MinimumRate"    type="d"  access="read"/>
    <property name="MaximumRate"    type="d"  access="read"/>
    <property name="CanGoNext"      type="b"  access="read"/>
    <property name="CanGoPrevious"  type="b"  access="read"/>
    <property name="CanPlay"        type="b"  access="read"/>
    <property name="CanPause"       type="b"  access="read"/>
    <property name="CanSeek"        type="b"  access="read"/>
    <property name="CanControl"     type="b"  access="read"/>
    <signal name="Seeked">
      <arg type="x" name="Position"/>
    </signal>
  </interface>
</node>`;

// This XML covers the root MediaPlayer2 interface (for Raise()).
const ROOT_IFACE_XML = `
<node>
  <interface name="org.mpris.MediaPlayer2">
    <method name="Raise"/>
    <method name="Quit"/>
    <property name="CanRaise" type="b" access="read"/>
    <property name="CanQuit"  type="b" access="read"/>
    <property name="Identity" type="s" access="read"/>
    <property name="DesktopEntry" type="s" access="read"/>
  </interface>
</node>`;

// Build typed proxy wrappers once.
const PlayerProxy = Gio.DBusProxy.makeProxyWrapper(PLAYER_IFACE_XML);
const RootProxy   = Gio.DBusProxy.makeProxyWrapper(ROOT_IFACE_XML);

// ---------------------------------------------------------------------------
// MprisPlayer — wraps a single bus name
// ---------------------------------------------------------------------------
export const MprisPlayer = GObject.registerClass(
  { Signals: { changed: {}, closed: {} } },
  class MprisPlayer extends GObject.Object {
    _init(busName) {
      super._init();
      this._busName   = busName;
      this._proxy     = null;
      this._rootProxy = null;
      this._propsId   = null;
      this._ready     = false;

      // makeProxyWrapper callback fires on the main loop once the proxy is
      // initialised (or on error). 'this' is the created proxy instance.
      this._proxy = new PlayerProxy(
        Gio.DBus.session,
        busName,
        MPRIS_PATH,
        (proxy, error) => {
          if (error) {
            logError(error, `[spotify-controls] PlayerProxy failed for ${busName}`);
            return;
          }
          this._ready = true;
          // Watch for property updates (play/pause, track changes, etc.)
          this._propsId = proxy.connect('g-properties-changed', () => {
            this.emit('changed');
          });
          this.emit('changed');
        }
      );

      // Root proxy for Raise() — fire-and-forget, no signal needed.
      this._rootProxy = new RootProxy(
        Gio.DBus.session,
        busName,
        MPRIS_PATH,
        (proxy, error) => {
          if (error) {
            // Non-fatal — Raise just won't work.
            logError(error, `[spotify-controls] RootProxy failed for ${busName}`);
          }
        }
      );
    }

    get busName() { return this._busName; }

    // available = proxy exists, has an owner, and has finished init.
    get available() {
      return this._ready && this._proxy != null && this._proxy.g_name_owner != null;
    }

    _getProp(name) {
      const v = this._proxy?.get_cached_property(name);
      return v ? v.deep_unpack() : null;
    }

    get status()        { return this._getProp('PlaybackStatus') ?? 'Stopped'; }
    get canControl()    { return this._getProp('CanControl')     ?? false; }
    get canGoNext()     { return this._getProp('CanGoNext')      ?? false; }
    get canGoPrevious() { return this._getProp('CanGoPrevious')  ?? false; }
    get canPlay()       { return this._getProp('CanPlay')        ?? false; }
    get canPause()      { return this._getProp('CanPause')       ?? false; }

    get metadata() {
      const meta = this._getProp('Metadata');
      if (!meta) return { title: '', artist: '', album: '', artUrl: '' };

      const get = (key) => {
        if (meta[key] == null) return null;
        // deep_unpack already called by _getProp → meta values are plain JS.
        const val = meta[key];
        // Some values are still GVariants if the outer unpack was shallow.
        return (val && typeof val.deep_unpack === 'function')
          ? val.deep_unpack()
          : val;
      };

      const title     = get('xesam:title') || '';
      const artistRaw = get('xesam:artist');
      const artist    = Array.isArray(artistRaw)
        ? artistRaw.join(', ')
        : (artistRaw || '');
      const album  = get('xesam:album') || '';
      const artUrl = get('mpris:artUrl') || '';

      return { title, artist, album, artUrl };
    }

    playPause() { this._call('PlayPause'); }
    play()      { this._call('Play'); }
    pause()     { this._call('Pause'); }
    next()      { this._call('Next'); }
    previous()  { this._call('Previous'); }

    raise() {
      this._rootProxy?.RaiseRemote?.(() => {});
    }

    _call(method) {
      // makeProxyWrapper exposes methods as <MethodName>Remote(callback).
      // Calling without a callback is fire-and-forget.
      try {
        this._proxy?.[`${method}Remote`]?.(() => {});
      } catch (e) {
        // Ignore — player may have disappeared mid-call.
      }
    }

    destroy() {
      if (this._propsId && this._proxy) {
        this._proxy.disconnect(this._propsId);
        this._propsId = null;
      }
      this._proxy     = null;
      this._rootProxy = null;
      this._ready     = false;
    }
  }
);

// ---------------------------------------------------------------------------
// MprisManager — watches the session bus for players appearing / disappearing
// ---------------------------------------------------------------------------
export const MprisManager = GObject.registerClass(
  { Signals: { 'player-changed': {} } },
  class MprisManager extends GObject.Object {
    _init() {
      super._init();
      this._players        = new Map(); // busName → MprisPlayer
      this._active         = null;
      this._playerSignals  = new Map(); // busName → signal id
      this._nameWatchId    = 0;
      this._nameAppearedId = 0;

      // Watch for any org.mpris.MediaPlayer2.* name appearing or vanishing.
      // Gio.bus_watch_name_on_connection would only watch one name, so we
      // use a low-level NameOwnerChanged subscription instead.
      this._initNameWatcher();
      this._scanExistingPlayers();
    }

    get activePlayer() { return this._active; }

    // -----------------------------------------------------------------------
    // Initialise the NameOwnerChanged watcher
    // -----------------------------------------------------------------------
    _initNameWatcher() {
      // Subscribe to the NameOwnerChanged signal on the session bus.
      this._nameWatchId = Gio.DBus.session.signal_subscribe(
        'org.freedesktop.DBus',          // sender
        'org.freedesktop.DBus',          // interface
        'NameOwnerChanged',              // member
        '/org/freedesktop/DBus',         // object path
        null,                            // arg0 filter (null = all)
        Gio.DBusSignalFlags.NONE,
        (connection, senderName, objectPath, interfaceName, signalName, params) => {
          const [name, oldOwner, newOwner] = params.deep_unpack();
          if (!name.startsWith(MPRIS_PREFIX)) return;
          if (newOwner && !oldOwner) {
            this._addPlayer(name);
          } else if (!newOwner && oldOwner) {
            this._removePlayer(name);
          }
        }
      );
    }

    // -----------------------------------------------------------------------
    // Find players already running when the extension loads
    // -----------------------------------------------------------------------
    _scanExistingPlayers() {
      Gio.DBus.session.call(
        'org.freedesktop.DBus',
        '/org/freedesktop/DBus',
        'org.freedesktop.DBus',
        'ListNames',
        null,
        new GLib.VariantType('(as)'),
        Gio.DBusCallFlags.NONE,
        -1,
        null,
        (connection, res) => {
          try {
            const result = connection.call_finish(res);
            const [names] = result.deep_unpack();
            const mpris = names.filter(n => n.startsWith(MPRIS_PREFIX));
            for (const name of mpris) this._addPlayer(name);
          } catch (e) {
            logError(e, '[spotify-controls] ListNames failed');
          }
        }
      );
    }

    _addPlayer(busName) {
      if (this._players.has(busName)) return;
      const player = new MprisPlayer(busName);
      this._players.set(busName, player);

      // When the player's proxy fires 'changed' (including the first time
      // after init), re-evaluate the active player and notify the extension.
      const id = player.connect('changed', () => {
        this._chooseActive();
        this.emit('player-changed');
      });
      this._playerSignals.set(busName, id);

      // Also choose immediately (will be unavailable until proxy inits, but
      // sets up the preference order).
      this._chooseActive();
    }

    _removePlayer(busName) {
      const sigId = this._playerSignals.get(busName);
      const player = this._players.get(busName);
      if (player) {
        if (sigId) player.disconnect(sigId);
        player.destroy();
      }
      this._players.delete(busName);
      this._playerSignals.delete(busName);
      this._chooseActive();
      this.emit('player-changed');
    }

    _chooseActive() {
      // Always prefer Spotify.
      const spotify = this._players.get(SPOTIFY_BUS);
      if (spotify && spotify.available) {
        this._active = spotify;
        return;
      }
      // Fallback: first available MPRIS player.
      for (const player of this._players.values()) {
        if (player.available) {
          this._active = player;
          return;
        }
      }
      // Nothing available yet (proxy not initialised, or nothing running).
      this._active = null;
    }

    destroy() {
      if (this._nameWatchId) {
        Gio.DBus.session.signal_unsubscribe(this._nameWatchId);
        this._nameWatchId = 0;
      }
      for (const [busName, player] of this._players) {
        const sigId = this._playerSignals.get(busName);
        if (sigId) player.disconnect(sigId);
        player.destroy();
      }
      this._players.clear();
      this._playerSignals.clear();
      this._active = null;
    }
  }
);

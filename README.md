<h1 align="center">Fishtank Live Extended SDK (ftl-ext-sdk)</h1>

<div align="center">

General-purpose SDK for building browser extensions and Tampermonkey/Greasemonkey userscripts for [fishtank.live](https://fishtank.live).

📚 **[Full documentation on the wiki](https://github.com/BarryThePirate/ftl-ext-sdk/wiki)**

</div>

## Installation

### Browser Extension (npm)

```bash
npm install ftl-ext-sdk
```

```js
import { site, chat, ui, socket } from 'ftl-ext-sdk';
```

### Tampermonkey / Greasemonkey

The SDK ships a pre-built UMD bundle that exposes `window.FTL`. All socket dependencies (`socket.io-client` and `socket.io-msgpack-parser`) are bundled in — no separate `@require` entries needed.

**Prerequisites**

- [Tampermonkey](https://tampermonkey.net/) (Chrome, Edge, Firefox, Opera, Safari) or Greasemonkey 4+
- Firefox note: the bundle includes a cross-realm `ArrayBuffer` fix so chat decoding works correctly in Firefox content-script context

**Installation options**

Option A — Direct `@require` (recommended):

```javascript
// ==UserScript==
// @name         My Fishtank Script
// @namespace    https://fishtank.live
// @match        https://fishtank.live/*
// @grant        none
// @require      https://raw.githubusercontent.com/TeapoyY/ftl-ext-sdk/v1.0.0/dist/ftl-ext-sdk.bundle.min.js
// ==/UserScript==

(function () {
  const { socket, chat, ui } = window.FTL;

  socket.connect({ token: null }).then(() => {
    chat.messages.onMessage((msg) => {
      console.log(`[${msg.username}]: ${msg.message}`);
      ui.toasts.notify(`${msg.username}: ${msg.message}`, { duration: 3000 });
    });
  });
})();
```

Option B — Build your own bundle:

```bash
git clone https://github.com/TeapoyY/ftl-ext-sdk.git
cd ftl-ext-sdk
npm install
npm run build   # outputs dist/ftl-ext-sdk.bundle.js and .min.js
```

Then host the bundle somewhere and reference it via `@require`. The example userscript is at [`userscript-example.js`](userscript-example.js).

**UMD bundle contents**

| Module | Exported as |
|--------|-------------|
| `core/socket.js` | `FTL.socket` |
| `core/events.js` | `FTL.events` |
| `core/dom.js` | `FTL.dom` |
| `core/site-detect.js` | `FTL.site` |
| `core/storage.js` | `FTL.storage` |
| `chat/index.js` | `FTL.chat` |
| `player/index.js` | `FTL.player` |
| `ui/index.js` | `FTL.ui` |

## Quick Start

```js
import { site, chat, ui, socket, events } from 'ftl-ext-sdk';
import { io } from 'socket.io-client';
import * as msgpackParser from 'socket.io-msgpack-parser';

site.whenReady(async () => {

    // Connect to the chat WebSocket (token: null = anonymous)
    await socket.connect(io, msgpackParser, { token: null });

    // Log all chat messages
    chat.messages.onMessage((msg) => {
        console.log(`[${msg.role || 'user'}] ${msg.username}: ${msg.message}`);
    });

    // React to modal events
    events.onModalEvent((action, detail) => {
        console.log(`Modal ${action}:`, detail?.modal);
    });

    ui.toasts.notify('Extension loaded!', { type: 'success' });
});
```

Socket listeners start automatically when you register a callback — no manual setup step needed.

## Modules

| Module | Description |
|--------|-------------|
| [`site`](https://github.com/BarryThePirate/ftl-ext-sdk/wiki/Site) | Detect site version, ready state, and the logged-in user |
| [`socket`](https://github.com/BarryThePirate/ftl-ext-sdk/wiki/Socket) | Socket.IO connection to the fishtank.live WebSocket server |
| [`chat.messages`](https://github.com/BarryThePirate/ftl-ext-sdk/wiki/Chat-Messages) | Normalised chat, TTS, and SFX events from Socket.IO |
| [`chat.rooms`](https://github.com/BarryThePirate/ftl-ext-sdk/wiki/Chat-Rooms) | Subscribe to Season Pass and Season Pass XL rooms |
| [`chat.input`](https://github.com/BarryThePirate/ftl-ext-sdk/wiki/Chat-Input) | Helpers for the chat input field |
| [`events`](https://github.com/BarryThePirate/ftl-ext-sdk/wiki/Events) | Open, close, and observe site modals |
| [`ui.modals`](https://github.com/BarryThePirate/ftl-ext-sdk/wiki/Ui-Modals) | Inject content into site modals |
| [`ui.keyboard`](https://github.com/BarryThePirate/ftl-ext-sdk/wiki/Ui-Keyboard) | Register keyboard shortcuts that respect input focus |
| [`ui.toasts`](https://github.com/BarryThePirate/ftl-ext-sdk/wiki/Ui-Toasts) | Show your own toast notifications |
| [`ui.toastObserver`](https://github.com/BarryThePirate/ftl-ext-sdk/wiki/Ui-Toast-Observer) | Watch the site's own toasts (admin messages, item drops) |
| [`ui.download`](https://github.com/BarryThePirate/ftl-ext-sdk/wiki/Ui-Download) | Trigger browser file downloads |
| [`player`](https://github.com/BarryThePirate/ftl-ext-sdk/wiki/Player) | Video element and stream/room name resolution |
| [`dom`](https://github.com/BarryThePirate/ftl-ext-sdk/wiki/Dom) | Stable element selectors and DOM observation helpers |
| [`storage`](https://github.com/BarryThePirate/ftl-ext-sdk/wiki/Storage) | Namespaced localStorage wrapper |
| [`transport`](https://github.com/BarryThePirate/ftl-ext-sdk/wiki/Transport) | Cross-origin fetch layer (used by `ui.download`) |
| [`react`](https://github.com/BarryThePirate/ftl-ext-sdk/wiki/React) | Walk the React fiber tree (advanced) |
| [`debug`](https://github.com/BarryThePirate/ftl-ext-sdk/wiki/Debug) | Toggle SDK lifecycle logging |

See also:

- [Firefox Compatibility](https://github.com/BarryThePirate/ftl-ext-sdk/wiki/Firefox-Compatibility) — required reading if you target Firefox
- [Raw Socket Data](https://github.com/BarryThePirate/ftl-ext-sdk/wiki/Raw-Socket-Data) — quirks of the underlying socket events if you bypass `chat.messages`

## Building

```bash
npm install
npm run build    # Builds dist/ftl-ext-sdk.bundle.js
npm run watch    # Rebuild on changes
```

## Architecture

```
src/
├── core/           — Low-level: React fiber, Socket.IO, DOM, events, storage, transport
├── chat/           — Chat observation (DOM + Socket.IO), input helpers
├── player/         — Video player, stream/room name resolution
├── ui/             — Keyboard shortcuts, modals, toasts, toast observer, downloads
└── adapters/       — Site-version-specific configuration (current + classic stub)
```

### Design Principles

- **Non-destructive** — Never modify the site's own connections, state, or event handlers
- **Extension-store friendly** — No monkey-patching, no remote code, no eval
- **Fail silently** — Missing elements return null, never throw in production paths
- **Namespaced DOM** — All injected elements use `data-ftl-sdk` attributes
- **Performance-aware** — No persistent body-level MutationObservers (the site generates thousands of chat mutations per second)

## License

MIT
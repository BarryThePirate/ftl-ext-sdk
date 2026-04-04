# ftl-ext-sdk

General-purpose SDK for building browser extensions and Tampermonkey/Greasemonkey userscripts for [fishtank.live](https://fishtank.live).

## Installation

### Browser Extension (npm)

```bash
npm install ftl-ext-sdk
```

```js
import { site, chat, ui, socket } from 'ftl-ext-sdk';
```

### Tampermonkey / Greasemonkey

**Now Supported!** See [docs/USERSCRIPT.md](docs/USERSCRIPT.md) for Tampermonkey/Greasemonkey usage.

The SDK now provides an IIFE bundle (`dist/ftl-ext-sdk.userscript.js`) that exposes `window.FTL` for userscript environments, with Firefox compatibility fixes included.

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

### `site` — Environment Detection

```js
import { site } from 'ftl-ext-sdk';

site.getSiteVersion();   // 'current' | 'classic' | 'unknown'
site.isCurrent();        // true on fishtank.live
site.isClassic();        // true on classic.fishtank.live
site.isMobile();         // true on small screens
site.isSiteReady();      // true when key elements are present

// Wait for site to be ready before initialising
site.whenReady(() => {
  console.log('Site is ready!');
});

// Detect the logged-in user
site.getCurrentUsername();  // string or null
site.onUserDetected((username) => {
  console.log('Logged in as:', username);
});

// Detect the logged-in user's UUID (from auth cookie)
site.getCurrentUserId();   // string or null
site.onUserIdDetected((userId) => {
  console.log('User ID:', userId);
});
```

### `socket` — Socket.IO Connection

```js
import { socket } from 'ftl-ext-sdk';
import { io } from 'socket.io-client';
import * as msgpackParser from 'socket.io-msgpack-parser';

// Connect (pass the socket.io-client and msgpack parser)
// token: null = unauthenticated, undefined = auto-detect from cookie
await socket.connect(io, msgpackParser, { token: null });

// Room constants
socket.ROOMS.GLOBAL;          // 'Global'
socket.ROOMS.SEASON_PASS;     // 'Season Pass'
socket.ROOMS.SEASON_PASS_XL;  // 'Season Pass XL'

// Listen for any raw event
const unsub = socket.on('chat:message', (data) => {
  console.log(data);
});

// Later: unsubscribe
unsub();

// Check connection status
socket.isConnected();      // true/false
socket.isAuthenticated();  // true/false

// Force a reconnect (e.g. after detecting stale connection)
socket.forceReconnect();

// Disconnect
socket.disconnect();

// Access the raw socket instance
socket.getSocket();
```

#### Known Events

| Constant | Event Name | Description |
|----------|-----------|-------------|
| `EVENTS.CHAT_MESSAGE` | `chat:message` | Chat messages (including happenings) |
| `EVENTS.CHAT_ROOM` | `chat:room` | Room change events |
| `EVENTS.CHAT_PRESENCE` | `chat:presence` | Chat presence updates |
| `EVENTS.TTS_INSERT` | `tts:insert` | TTS submissions |
| `EVENTS.TTS_UPDATE` | `tts:update` | TTS status changes |
| `EVENTS.SFX_INSERT` | `sfx:insert` | SFX submissions |
| `EVENTS.SFX_UPDATE` | `sfx:update` | SFX status changes |
| `EVENTS.CRAFTING_RECIPE_LEARNED` | `items:crafting-recipe:learned` | New crafting recipe discovered |
| `EVENTS.NOTIFICATION_GLOBAL` | `notification:global` | Global notifications / admin messages |
| `EVENTS.PRESENCE` | `presence` | User presence updates |

> **Note:** The server sends TTS and SFX events inconsistently — sometimes `:insert`, sometimes `:update`, sometimes both. If you use `chat.messages.onTTS()` / `chat.messages.onSFX()` (recommended), the SDK listens on both and deduplicates automatically. If you use raw `socket.on()`, you'll need to handle this yourself.

### `chat.messages` — Socket.IO Chat (Normalised)

The recommended way to receive chat messages, TTS, and SFX events. The SDK normalises the raw socket data into clean objects, handles array unwrapping, resolves role priority from metadata flags, and deduplicates TTS/SFX events.

Socket listeners start automatically on the first callback registration — no setup step needed.

```js
import { chat } from 'ftl-ext-sdk';

// Chat messages
chat.messages.onMessage((msg) => {
  console.log(`${msg.username}: ${msg.message}`);
  console.log('Role:', msg.role);       // 'staff' | 'mod' | 'fish' | 'grandMarshal' | 'epic' | null
  console.log('Colour:', msg.colour);   // custom username colour or null
  console.log('Avatar:', msg.avatar);   // filename, e.g. "rchl.png"
  console.log('Clan:', msg.clan);
  console.log('Mentions:', msg.mentions); // [{displayName, userId}]

  // Raw socket data is always available if you need it
  console.log('Raw:', msg.raw);
});

// TTS (deduplicated across tts:insert and tts:update)
chat.messages.onTTS((tts) => {
  console.log(`[TTS] ${tts.username} in ${tts.room}: ${tts.message} (${tts.voice})`);
  console.log('Audio ID:', tts.audioId);  // for CDN URL construction
  console.log('Clan:', tts.clanTag);
});

// SFX (deduplicated across sfx:insert and sfx:update)
chat.messages.onSFX((sfx) => {
  console.log(`[SFX] ${sfx.username} in ${sfx.room}: ${sfx.message}`);
  console.log('Audio file:', sfx.audioFile);  // filename from CDN URL
  console.log('Clan:', sfx.clanTag);
});

// Convenience helpers (work on normalised objects)
chat.messages.isStaffMessage(msg);          // boolean
chat.messages.isFishMessage(msg);           // boolean
chat.messages.isModMessage(msg);            // boolean
chat.messages.isHappening(msg);             // boolean
chat.messages.mentionsUser(msg, 'username'); // boolean
```

#### Normalised Message Shape

```js
{
  username: "BarryThePirate",       // display name
  message: "Hello world",           // message text
  role: "staff",                    // 'staff' | 'mod' | 'fish' | 'grandMarshal' | 'epic' | null
  colour: "#966b9e",               // custom username colour or null
  avatar: "rchl.png",              // avatar filename (extracted from CDN URL)
  clan: null,                       // clan tag or null
  endorsement: null,                // endorsement badge text or null
  chatRoom: "Global",              // 'Global' | 'Season Pass' | 'Season Pass XL'
  mentions: [                       // normalised mention objects
    { displayName: "someuser", userId: "uuid-..." }
  ],
  raw: { /* original socket data */ },
}
```

#### Normalised TTS Shape

```js
{
  username: "SomeUser",
  message: "Hello from TTS",
  voice: "Brainrot",                // voice name
  room: "brrr-5",                   // room code (use player.streams.roomName() to resolve)
  audioId: "abc123",                // TTS ID (CDN URL: https://cdn.fishtank.live/tts/{audioId}.mp3)
  clanTag: null,
  raw: { /* original socket data */ },
}
```

#### Normalised SFX Shape

```js
{
  username: "SomeUser",
  message: "Airhorn",               // sound name
  room: "brrr-5",
  audioFile: "Airhorn-123456.mp3",  // filename (CDN URL: https://cdn.fishtank.live/sfx/{audioFile})
  clanTag: null,
  raw: { /* original socket data */ },
}
```

#### Role Priority

The SDK resolves the highest-priority role from the socket metadata flags:

`staff` > `mod` > `fish` > `grandMarshal` > `epic` > `null`

A user with both `isAdmin` and `isFish` set to true will have `role: 'staff'`.

### `chat.rooms` — Multi-Room Monitoring

By default, the primary socket receives Global chat only. Use `chat.rooms` to subscribe to Season Pass and Season Pass XL rooms. Messages from all subscribed rooms flow through the same `chat.messages.onMessage()` callbacks — each message includes a `chatRoom` field indicating its source.

Room subscriptions require authentication (the server silently ignores room switches from anonymous sockets). The SDK auto-detects the auth token from the site's cookie.

```js
import { chat } from 'ftl-ext-sdk';

// Subscribe to additional rooms
await chat.rooms.subscribe('Season Pass');
await chat.rooms.subscribe('Season Pass XL');

// Or subscribe to all extra rooms at once
await chat.rooms.subscribeAll();

// Messages now include chatRoom field
chat.messages.onMessage((msg) => {
  console.log(`[${msg.chatRoom}] ${msg.username}: ${msg.message}`);
});

// Check subscriptions
chat.rooms.getSubscribed();                // ['Season Pass', 'Season Pass XL']
chat.rooms.isSubscribed('Season Pass');    // true

// Unsubscribe
chat.rooms.unsubscribe('Season Pass XL');
chat.rooms.unsubscribeAll();
```

> **Note:** Each room subscription opens a separate authenticated WebSocket connection. Global is always handled by the primary socket and cannot be unsubscribed.

### `chat.observer` — DOM-Based Chat Observation (Lightweight)

The simplest way to watch chat. No auth, no extra connections. Observes the chat DOM for new messages and parses them.

```js
import { chat } from 'ftl-ext-sdk';

// Watch for new messages in the DOM
chat.observer.onMessage((msg) => {
  console.log(`${msg.username}: ${msg.message}`);

  // The raw DOM element is available for visual modifications
  if (msg.role === 'staff') {
    msg.element.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
  }
});

// Start observing (call after site is ready)
chat.observer.startObserving();

// Or wait for chat to appear, then start
await chat.observer.waitAndObserve();

// Convenience helpers
chat.observer.isStaffMessage(msg);
chat.observer.isFishMessage(msg);
chat.observer.isModMessage(msg);
chat.observer.isTTSMessage(msg);
chat.observer.isSFXMessage(msg);
chat.observer.isChatMessage(msg);
chat.observer.mentionsUser(msg, 'username');

// Stop observing
chat.observer.stopObserving();
```

> **Reliability warning:** The site uses react-window to virtualise chat, keeping only ~17 messages
> in the DOM at any time. React-window frequently replaces DOM nodes during re-renders, which can
> cause the observer to lose its connection. For reliable, long-running message capture, use
> `chat.messages` (Socket.IO) instead. The DOM observer is best suited for UI modifications where
> you need access to the rendered elements.

#### Observer vs Socket — Which to use?

| | `chat.observer` (DOM) | `chat.messages` (Socket.IO) |
|---|---|---|
| Auth required | No | Optional |
| Extra connections | None | 1 WebSocket |
| Data | Text, username, avatar, level | Full normalised data + raw socket data |
| Reliability | May miss messages during re-renders | Captures every message |
| DOM access | Yes (element ref) | No (data only) |
| TTS/SFX | Only if rendered in chat | Dedicated events with deduplication |
| **Best for** | UI modifications, visual tweaks | Logging, analytics, bots |

### `chat.input` — Chat Input

```js
import { chat } from 'ftl-ext-sdk';

chat.input.focus();                      // Focus the input
chat.input.insertText('Hello world');    // Insert text
chat.input.mentionUser('username');      // Insert @mention
chat.input.getText();                    // Get current input text
chat.input.clear();                      // Clear the input
chat.input.getInputElement();            // Get the raw DOM element
```

### `events` — Modal Events

```js
import { events } from 'ftl-ext-sdk';

// Open/close modals
events.openModal('craftItem', { someData: true });
events.closeModal();
events.isModalOpen();

// Watch for specific modals
const unsub = events.onModalOpen('craftItem', (modalElement, data) => {
  // Inject your content into the modal
});

// Watch all modal events
events.onModalEvent((action, detail) => {
  // action: 'open' | 'close' | 'confirm'
});
```

### `ui.modals` — Modal Helpers

```js
import { ui } from 'ftl-ext-sdk';

// Inject content into the current modal
ui.modals.injectIntoModal(myElement, { position: 'append' });
ui.modals.injectIntoModal('<p>Hello</p>', { position: 'prepend', id: 'my-content' });

// Wait for modal to close
await ui.modals.waitForClose();
```

### `ui.keyboard` — Keyboard Shortcuts

```js
import { ui } from 'ftl-ext-sdk';

// Register a shortcut (auto-skips when user is typing)
const unsub = ui.keyboard.register('my-shortcut', { key: 'e' }, () => {
  console.log('E pressed!');
});

// With modifiers
ui.keyboard.register('save', { key: 's', ctrl: true }, () => {
  console.log('Ctrl+S pressed!');
});

// Stop the event from reaching other handlers
ui.keyboard.register('intercept-t', { key: 't', stopPropagation: true }, () => {
  console.log('T intercepted — site handler will not fire');
});

// The callback receives the keyboard event for conditional logic
ui.keyboard.register('conditional', { key: 'x' }, (e) => {
  if (someCondition) {
    e.stopImmediatePropagation();
  }
});

// Unregister
unsub();
ui.keyboard.unregister('my-shortcut');
ui.keyboard.getRegistered();  // list all
ui.keyboard.unregisterAll();  // remove all
```

| Option | Default | Description |
|--------|---------|-------------|
| `key` | *(required)* | Key to listen for (e.g. `'e'`, `'escape'`, `'f'`) |
| `ctrl` | `false` | Require Ctrl key |
| `alt` | `false` | Require Alt key |
| `shift` | `false` | Require Shift key |
| `meta` | `false` | Require Meta/Cmd key |
| `skipInputs` | `true` | Don't fire when user is typing in an input/textarea |
| `preventDefault` | `true` | Call `e.preventDefault()` on match |
| `stopPropagation` | `false` | Call `e.stopImmediatePropagation()` on match |

### `ui.toasts` — Toast Notifications

```js
import { ui } from 'ftl-ext-sdk';

const id = ui.toasts.notify('Hello!', {
  description: 'This is a toast',
  type: 'success',    // 'default' | 'success' | 'error' | 'info'
  duration: 5000,     // ms (0 for persistent)
});

ui.toasts.dismiss(id);
```

### `ui.toastObserver` — Site Toast Observation

Watch for the site's own toast notifications (admin messages, item drops, crafting alerts).

```js
import { ui } from 'ftl-ext-sdk';

// Wait for the toast container, then start observing
await ui.toastObserver.waitAndObserve();

ui.toastObserver.onToast((toast) => {
  console.log('Title:', toast.title);
  console.log('Description:', toast.description);
  console.log('Image:', toast.imageUrl);
});

ui.toastObserver.isObserving();
ui.toastObserver.stopObserving();
```

### `player` — Video Player & Streams

```js
import { player } from 'ftl-ext-sdk';

// Room names
player.streams.fetchRoomNames();             // fetch from API (cached in localStorage)
player.streams.roomName('brrr-5');           // 'Bar' (human-readable)
player.streams.getRoomMap();                 // full map
player.streams.isPlayerOpen();
player.streams.getPlayerElement();

// Video
player.video.getElement();
player.video.toggleFullscreen();
player.video.isFullscreen();
```

### `dom` — DOM Helpers

```js
import { dom } from 'ftl-ext-sdk';

// Stable element access
dom.byId('chat-input');
dom.getChatContainer();
dom.getChatScrollContainer();
dom.getVideoElement();
dom.getVisibleChatMessages();

// Wait for elements
const el = await dom.waitForElement('#modal');

// Observe an element (returns disconnect function)
const disconnect = dom.observe(someElement, (mutations) => {
    // ...
}, { childList: true, subtree: true });

// Inject content (tagged with data-ftl-sdk for cleanup)
dom.inject(myElement, targetElement, 'append', 'my-injection');
dom.removeInjected('my-injection');  // remove specific
dom.removeInjected();                // remove all SDK injections
```

### `storage` — Local Storage

```js
import { storage } from 'ftl-ext-sdk';

// All keys are prefixed with 'ftl-sdk:' to avoid collisions
storage.set('myKey', { some: 'data' });
storage.get('myKey');          // { some: 'data' }
storage.get('missing', []);    // [] (default value)
storage.remove('myKey');
storage.keys();                // ['myKey', ...]
storage.clear();               // clears only SDK keys
```

### `react` — React Fiber Access (Advanced)

```js
import { react } from 'ftl-ext-sdk';

react.isAvailable();
react.getReactFiberKey();
react.getFiber(someElement);
react.getProps(someElement);

// Walk the fiber tree
react.walkFiberUp(element, (fiber) => fiber.memoizedProps?.someProp);
react.walkFiberDown(fiber, (fiber) => fiber.type === 'SomeComponent');

// Find hook state
react.findHookState(fiber, (state) => state?.someField === 'value');

// Search the entire tree from root
react.findInTree((fiber) => fiber.memoizedProps?.targetProp);
```

## Firefox Compatibility

Firefox content scripts run in a separate JavaScript realm from the page. This causes three issues:

### 1. Socket.IO Binary Data (ArrayBuffer cross-realm failure)

WebSocket binary data arrives as an `ArrayBuffer` from the page's realm. Libraries like `engine.io-parser` and `notepack.io` use `instanceof ArrayBuffer` checks, which fail across realms.

**Symptoms:** Socket connects briefly then disconnects with `parse error` in a loop.

**Fix:** Add this Rollup plugin to patch `instanceof` checks at bundle time:

```js
function firefoxArrayBufferFix() {
    return {
        name: 'firefox-arraybuffer-fix',
        renderChunk(code) {
            let patched = code;
            let patchCount = 0;

            patched = patched.replace(
                /if \(data instanceof ArrayBuffer\) \{\s*\/\/ from HTTP long-polling \(base64\) or WebSocket \+ binaryType "arraybuffer"/g,
                (match) => { patchCount++; return 'if (data instanceof ArrayBuffer || Object.prototype.toString.call(data) === "[object ArrayBuffer]") {\n                // from HTTP long-polling (base64) or WebSocket + binaryType "arraybuffer"'; }
            );

            patched = patched.replace(
                /if \(buffer instanceof ArrayBuffer\) \{/g,
                (match) => { patchCount++; return 'if (buffer instanceof ArrayBuffer || Object.prototype.toString.call(buffer) === "[object ArrayBuffer]") {'; }
            );

            if (patchCount > 0) {
                console.log(`[firefox-arraybuffer-fix] Applied ${patchCount} patches`);
                return { code: patched, map: null };
            }

            console.warn('[firefox-arraybuffer-fix] WARNING: No patterns found!');
            return null;
        },
    };
}
```

No effect on Chrome where `instanceof` works across realms.

### 2. CustomEvent Detail (cross-realm property access)

The page's JavaScript can't read `detail` on a `CustomEvent` created in the content script's realm.

**Dispatching events:**

```js
function dispatchPageEvent(eventName, detail = {}) {
    const safeDetail = typeof cloneInto === 'function'
        ? cloneInto(detail, document.defaultView)
        : detail;
    document.dispatchEvent(new CustomEvent(eventName, { detail: safeDetail }));
}
```

**Reading events:**

```js
document.addEventListener('modalOpen', (e) => {
    let detail;
    try {
        detail = e.detail ? JSON.parse(JSON.stringify(e.detail)) : {};
    } catch {
        detail = {};
    }
});
```

### 3. Socket Connect Timeout

Wrap the connect call with a timeout so a failed socket doesn't block the rest of your extension:

```js
try {
    await Promise.race([
        socket.connect(io, msgpackParser, { token: null }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
    ]);
} catch (err) {
    console.warn('Socket failed:', err.message);
}
```

## Raw Socket Data

If you use `socket.on()` directly instead of `chat.messages`, be aware of these quirks:

- **`chat:message` is array-wrapped:** The data arrives as `[{...}]` not `{...}`. Unwrap with `const msg = Array.isArray(data) ? data[0] : data;`
- **`mentions` contains objects**, not strings: `[{ displayName: "user", userId: "uuid" }]`
- **TTS/SFX events fire on both `:insert` and `:update`**, inconsistently. Listen on both and deduplicate by ID.
- **Role is split across metadata flags** (`isAdmin`, `isMod`, `isFish`, `isGrandMarshall`, `isEpic`). Multiple can be true — resolve by priority.

The `chat.messages` module handles all of this automatically.

## Building

```bash
npm install
npm run build    # Builds dist/ftl-ext-sdk.bundle.js
npm run watch    # Rebuild on changes
```

## Architecture

```
src/
├── core/           — Low-level: React fiber, Socket.IO, DOM, events, storage
├── chat/           — Chat observation (DOM + Socket.IO), input helpers
├── player/         — Video player, stream/room name resolution
├── ui/             — Keyboard shortcuts, modals, toasts, toast observer
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
# ftl-ext-sdk Userscript Support

This document describes how to use ftl-ext-sdk in Tampermonkey/Greasemonkey userscripts.

## Installation

### Option 1: CDN (Recommended)

Add these `@require` directives to your userscript header:

```javascript
// @require https://cdn.jsdelivr.net/npm/socket.io-client@4.8.3/dist/socket.io.min.js
// @require https://cdn.jsdelivr.net/gh/BarryThePirate/ftl-ext-sdk@main/dist/ftl-ext-sdk.userscript.min.js
```

### Option 2: Self-hosted

Build the userscript bundle and host it yourself:

```bash
npm install
npm run build
# Upload dist/ftl-ext-sdk.userscript.js to your server
```

## Quick Start

```javascript
// ==UserScript==
// @name         My Fishtank Script
// @namespace    https://fishtank.live/
// @version      1.0.0
// @match        https://fishtank.live/*
// @match        https://classic.fishtank.live/*
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/socket.io-client@4.8.3/dist/socket.io.min.js
// @require      https://cdn.jsdelivr.net/gh/BarryThePirate/ftl-ext-sdk@main/dist/ftl-ext-sdk.userscript.min.js
// ==/UserScript==

(function() {
    'use strict';

    // Wait for SDK to be available
    function waitForSDK(callback) {
        if (window.FTL) {
            callback(window.FTL);
        } else {
            setTimeout(() => waitForSDK(callback), 100);
        }
    }

    waitForSDK(async (FTL) => {
        const { site, chat, ui, socket } = FTL;

        await site.whenReady();
        
        // Connect to chat (anonymous)
        await socket.connect(window.io, null, { token: null });

        // Listen to chat messages
        chat.messages.onMessage((msg) => {
            console.log(`${msg.username}: ${msg.message}`);
        });

        // Show notification
        ui.toasts.notify('Script loaded!', { type: 'success' });
    });
})();
```

## Firefox Compatibility

The userscript bundle includes a Firefox compatibility fix that patches `instanceof ArrayBuffer` checks to use `Object.prototype.toString.call()` which works across JavaScript realms.

**Symptoms without fix:** Socket connects briefly then disconnects with "parse error" in a loop.

**Fixed:** The Rollup plugin `firefoxArrayBufferFix()` automatically patches the bundled code.

## Bundle Formats

| File | Format | Use Case |
|------|--------|----------|
| `ftl-ext-sdk.bundle.js` | UMD | Browser extensions, Node.js |
| `ftl-ext-sdk.bundle.min.js` | UMD (minified) | Production browser extensions |
| `ftl-ext-sdk.userscript.js` | IIFE (minified) | Tampermonkey/Greasemonkey |

## API Reference

The SDK is exposed as `window.FTL` with the following exports:

```javascript
const { 
    site,      // Site detection and ready state
    chat,      // Chat messages, TTS, SFX
    ui,        // Toasts, notifications
    socket,    // WebSocket connection
    events,    // Modal events
    player,    // Stream information
    storage,   // LocalStorage helpers
    dom        // DOM utilities
} = window.FTL;
```

See [README.md](./README.md) for full API documentation.

## Example Scripts

See [examples/](./examples/) for complete userscript examples:

- `userscript-example.js` - Basic chat monitoring and notifications
- `chat-logger.js` - Advanced chat logging with filtering
- `tts-announcer.js` - TTS announcements with audio playback
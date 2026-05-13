// ==UserScript==
// @name         Fishtank Live SDK Chat Toast Example
// @namespace    https://github.com/BarryThePirate/ftl-ext-sdk
// @version      0.1.0
// @description  Connect to fishtank.live chat with ftl-ext-sdk and show a toast.
// @match        https://fishtank.live/*
// @match        https://www.fishtank.live/*
// @match        https://classic.fishtank.live/*
// @require      https://cdn.jsdelivr.net/npm/ftl-ext-sdk/dist/ftl-ext-sdk.bundle.min.js
// @grant        none
// ==/UserScript==

(async function () {
  'use strict';

  const { site, chat, socket, ui } = window.FTL;

  site.whenReady(async () => {
    try {
      chat.messages.onMessage((msg) => {
        console.log(`[FTL chat:${msg.chatRoom}] ${msg.username}: ${msg.message}`);
      });

      await socket.connect({ token: null });

      ui.toasts.notify('FTL SDK connected', {
        description: 'Chat messages are being logged to the console.',
        type: 'success',
      });
    } catch (error) {
      console.error('[ftl-ext-sdk example] Failed to connect:', error);
      ui.toasts.notify('FTL SDK connection failed', {
        description: error?.message || String(error),
        type: 'error',
      });
    }
  });
})();

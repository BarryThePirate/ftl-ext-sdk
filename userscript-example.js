// ==UserScript==
// @name         FTL Chat Monitor
// @namespace    https://fishtank.live
// @version      1.0.0
// @description  Connects to fishtank.live via the FTL SDK, logs all chat messages, and shows toast notifications.
// @author       YourName
// @match        https://fishtank.live/*
// @grant        none
// @require      https://raw.githubusercontent.com/TeapoyY/ftl-ext-sdk/v1.0.0/dist/ftl-ext-sdk.bundle.min.js
// ==/UserScript==

(function () {
  'use strict';

  // ── Wait for the FTL SDK to be available ──────────────────────────
  const POLL_INTERVAL = 500;
  const MAX_WAIT = 30000; // 30 seconds

  let waited = 0;

  function waitForFTL() {
    if (waited >= MAX_WAIT) {
      console.error('[FTL Userscript] FTL SDK did not load within 30 seconds.');
      return;
    }
    if (typeof window.FTL === 'undefined') {
      waited += POLL_INTERVAL;
      setTimeout(waitForFTL, POLL_INTERVAL);
      return;
    }
    init();
  }

  function init() {
    const { socket, chat, ui } = window.FTL;

    // ── Connect anonymously ────────────────────────────────────────
    socket
      .connect({ token: null })
      .then((sock) => {
        console.log('[FTL Userscript] Connected to fishtank.live');

        // ── Listen for incoming chat messages ──────────────────────
        chat.messages.onMessage((msg) => {
          const tag = msg.username || msg.role || 'unknown';
          const text = msg.message || '';

          // Log to console with a prefix for easy filtering
          console.log(`[FTL Chat] ${tag}: ${text}`);

          // Show a brief toast notification for each message
          ui.toasts.notify(`${tag}: ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`, {
            duration: 3000,
            type: 'info',
          });
        });

        // ── Handle disconnection ───────────────────────────────────
        sock.on('disconnect', (reason) => {
          console.warn('[FTL Userscript] Disconnected:', reason);
          ui.toasts.notify('Disconnected from fishtank.live', { type: 'error' });
        });

        sock.on('connect_error', (err) => {
          console.error('[FTL Userscript] Connection error:', err.message);
          ui.toasts.notify('Connection error: ' + err.message, { type: 'error' });
        });
      })
      .catch((err) => {
        console.error('[FTL Userscript] Failed to connect:', err);
      });
  }

  // ── Boot ──────────────────────────────────────────────────────────
  waitForFTL();
})();

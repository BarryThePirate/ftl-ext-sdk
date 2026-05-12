// ==UserScript==
// @name         Fishtank Live SDK chat logger
// @namespace    https://github.com/BarryThePirate/ftl-ext-sdk
// @version      0.1.0
// @description  Example Tampermonkey/Greasemonkey script using ftl-ext-sdk.
// @match        https://fishtank.live/*
// @match        https://www.fishtank.live/*
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/BarryThePirate/ftl-ext-sdk@main/dist/ftl-ext-sdk.bundle.min.js
// ==/UserScript==

(async () => {
  const FTL = window.FTL;

  if (!FTL) {
    console.error('[ftl-userscript] window.FTL was not loaded');
    return;
  }

  await FTL.site.whenReady();
  await FTL.socket.connect({ token: null });

  FTL.chat.messages.onMessage((message) => {
    const user = message.username || message.displayName || 'unknown';
    const text = message.message || message.text || '';
    console.log(`[fishtank.live] ${user}: ${text}`, message);
  });

  FTL.ui.toasts.notify('FTL userscript connected', { type: 'success' });
})();

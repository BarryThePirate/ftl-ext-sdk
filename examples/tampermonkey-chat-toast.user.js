// ==UserScript==
// @name         Fishtank Live SDK Chat Toast Example
// @namespace    https://github.com/BarryThePirate/ftl-ext-sdk
// @version      0.1.0
// @description  Connect to fishtank.live chat with ftl-ext-sdk and show a toast.
// @match        https://www.fishtank.live/*
// @match        https://fishtank.live/*
// @require      https://cdn.jsdelivr.net/gh/BarryThePirate/ftl-ext-sdk@main/dist/ftl-ext-sdk.bundle.min.js
// @grant        none
// ==/UserScript==

(async () => {
    'use strict';

    const { site, chat, socket, ui } = window.FTL;

    await site.whenReady();
    await socket.connect({ token: null });

    chat.messages.onMessage((msg) => {
        const username = msg.username || msg.name || 'chat';
        const message = msg.message || msg.text || '';
        console.log(`[FTL chat] ${username}: ${message}`, msg);
    });

    ui.toasts.notify('FTL userscript connected', { type: 'success' });
})();

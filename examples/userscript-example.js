// ==UserScript==
// @name         FTL Ext SDK Example
// @namespace    https://fishtank.live/
// @version      1.0.0
// @description  Example userscript using ftl-ext-sdk for fishtank.live
// @author       geldbert-ai
// @match        https://fishtank.live/*
// @match        https://classic.fishtank.live/*
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/socket.io-client@4.8.3/dist/socket.io.min.js
// @require      https://cdn.jsdelivr.net/gh/geldbert/ftl-ext-sdk@main/dist/ftl-ext-sdk.userscript.min.js
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
        const { site, chat, ui, socket, events } = FTL;

        console.log('[FTL-Example] SDK loaded');

        // Wait for site to be ready
        await site.whenReady();
        console.log('[FTL-Example] Site ready, version:', site.getSiteVersion());

        // Show notification when loaded
        ui.toasts.notify('🦑 FTL Example loaded!', { type: 'success' });

        // Connect to chat WebSocket (anonymous mode)
        // Note: For authenticated mode, omit the token option
        try {
            // For userscripts, we use window.io from @require
            // msgpack parser is bundled in the userscript build
            await socket.connect(window.io, null, { token: null });
            console.log('[FTL-Example] Connected to chat');

            // Log all chat messages
            chat.messages.onMessage((msg) => {
                const role = msg.role ? `[${msg.role}]` : '';
                const clan = msg.clan ? `<${msg.clan}>` : '';
                console.log(`[Chat] ${role}${clan} ${msg.username}: ${msg.message}`);
            });

            // Log TTS events
            chat.messages.onTTS((tts) => {
                console.log(`[TTS] ${tts.username} in ${tts.room}: ${tts.message} (${tts.voice})`);
            });

            // Log SFX events
            chat.messages.onSFX((sfx) => {
                console.log(`[SFX] ${sfx.username} played ${sfx.message}`);
            });

        } catch (err) {
            console.error('[FTL-Example] Connection error:', err);
            ui.toasts.notify('❌ Connection failed', { type: 'error' });
        }

        // React to modal events
        events.onModalEvent((action, detail) => {
            console.log(`[Modal] ${action}:`, detail?.modal);
        });

        // Detect logged-in user
        site.onUserDetected((username) => {
            console.log('[FTL-Example] Logged in as:', username);
            ui.toasts.notify(`Welcome, ${username}!`, { type: 'success' });
        });

        // Log when user ID is detected
        site.onUserIdDetected((userId) => {
            console.log('[FTL-Example] User ID:', userId);
        });
    });
})();
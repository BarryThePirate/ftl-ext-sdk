/**
 * ftl-ext-sdk — Main Entry Point
 *
 * General-purpose SDK for building browser extensions and
 * userscripts for fishtank.live.
 *
 * Usage (ES Modules):
 *   import { site, chat, ui, socket } from 'ftl-ext-sdk';
 *
 * Usage (UMD/Tampermonkey):
 *   const { site, chat, ui, socket } = window.FTL;
 */

// Core
export * as react from './core/react.js';
export * as socket from './core/socket.js';
export * as events from './core/events.js';
export * as dom from './core/dom.js';
export * as site from './core/site-detect.js';
export * as storage from './core/storage.js';
export * as transport from './core/transport.js';
export * as debug from './core/debug.js';

// Feature Modules
export * as archives from './archives/index.js';
export * as chat from './chat/index.js';
export * as player from './player/index.js';
export * as ui from './ui/index.js';
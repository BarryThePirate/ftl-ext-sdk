/**
 * core/dom.js — DOM Query Helpers
 * 
 * Provides reliable ways to find elements on the new site.
 * Since the site uses Tailwind (no unique class names), we rely on:
 * - Stable element IDs
 * - Data attributes (e.g. data-react-window-index)
 * - Structural selectors as a last resort
 */

/**
 * Known stable element IDs that persist across site builds.
 */
export const IDS = {
  CHAT_INPUT: 'chat-input',
  MODAL: 'modal',
  LIVE_STREAM_PLAYER: 'live-stream-player',
};

/**
 * Known stable selectors (non-ID) that persist across site builds.
 */
export const SELECTORS = {
  /** react-window virtualised chat message items */
  CHAT_MESSAGE_ITEM: '[data-react-window-index]',
  /** Sonner toast notification container — always present after site load */
  TOAST_CONTAINER: 'section[aria-label^="Notifications"]',
  /** Sonner toast list elements */
  TOAST_LIST: 'ol[data-sonner-toaster]',
  /** Individual Sonner toast items */
  TOAST_ITEM: 'li[data-sonner-toast]',
};

/**
 * Get an element by its stable ID.
 * 
 * @param {string} id - Element ID (use IDS constants)
 * @returns {HTMLElement|null}
 */
export function byId(id) {
  return document.getElementById(id);
}

/**
 * Find the chat messages container element.
 * 
 * The chat uses react-window, which renders virtualised items with
 * data-react-window-index attributes. The container is their parent.
 * Only ~17 messages are in the DOM at any time.
 * 
 * @returns {HTMLElement|null}
 */
export function getChatContainer() {
  const firstMessage = document.querySelector('[data-react-window-index]');
  return firstMessage?.parentElement || null;
}

/**
 * Find the scrollable chat wrapper (the overflow-y-auto ancestor).
 * This is the element you'd scroll or inject sibling content into.
 * 
 * @returns {HTMLElement|null}
 */
export function getChatScrollContainer() {
  const container = getChatContainer();
  if (!container) return null;
  
  // Walk up to find the scrollable wrapper
  let el = container.parentElement;
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el);
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

/**
 * Get the currently focused player's video element.
 *
 * Live (HLS): the <video> inside #live-stream-player.
 * VOD/archive: no #live-stream-player exists — the site promotes the
 * clicked tile's <video> into an id-less fixed wrapper (grid tile videos
 * sit in static wrappers, so a .fixed ancestor uniquely identifies it).
 * Videos owned by extension UIs (data-ftl-sdk) are never returned.
 *
 * @returns {HTMLVideoElement|null}
 */
export function getVideoElement() {
  const player = byId(IDS.LIVE_STREAM_PLAYER);
  const live = player?.querySelector('video');
  if (live) return live;
  for (const v of document.querySelectorAll('video')) {
    if (v.closest('[data-ftl-sdk]')) continue;
    if (v.closest('.fixed')) return v;
  }
  return null;
}

/**
 * Get all currently rendered chat message elements.
 * Note: only returns the ~17 messages currently in the DOM due to virtualisation.
 * 
 * @returns {HTMLElement[]}
 */
export function getVisibleChatMessages() {
  return [...document.querySelectorAll('[data-react-window-index]')];
}

/**
 * Observe a DOM element for mutations.
 * Returns a cleanup function that disconnects the observer.
 * 
 * @param {HTMLElement} element - Element to observe
 * @param {Function} callback - MutationObserver callback
 * @param {Object} options - MutationObserver options
 * @returns {Function} Disconnect function
 */
export function observe(element, callback, options = {}) {
  const config = {
    childList: options.childList !== false,
    subtree: options.subtree || false,
    attributes: options.attributes || false,
    characterData: options.characterData || false,
  };
  if (options.attributeFilter) {
    config.attributeFilter = options.attributeFilter;
  }
  
  const observer = new MutationObserver(callback);
  observer.observe(element, config);
  
  return () => observer.disconnect();
}

/**
 * Wait for an element matching a selector to appear in the DOM.
 * Returns a promise that resolves with the element.
 * 
 * @param {string} selector - CSS selector to wait for
 * @param {number} timeout - Max wait time in ms (default 30s)
 * @returns {Promise<HTMLElement>}
 */
export function waitForElement(selector, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);
    
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`[ftl-ext-sdk] Timeout waiting for "${selector}"`));
    }, timeout);
    
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearTimeout(timer);
        observer.disconnect();
        resolve(el);
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

/**
 * Inject a DOM element into a target location.
 * All injected elements get a data-ftl-sdk attribute for easy identification and cleanup.
 * 
 * @param {HTMLElement} element - Element to inject
 * @param {HTMLElement} target - Where to inject
 * @param {string} position - 'before' | 'after' | 'prepend' | 'append' (default: 'append')
 * @param {string} id - Optional identifier for this injection (for later removal)
 */
export function inject(element, target, position = 'append', id = null) {
  element.setAttribute('data-ftl-sdk', id || 'injected');
  
  switch (position) {
    case 'before':
      target.parentElement?.insertBefore(element, target);
      break;
    case 'after':
      target.parentElement?.insertBefore(element, target.nextSibling);
      break;
    case 'prepend':
      target.insertBefore(element, target.firstChild);
      break;
    case 'append':
    default:
      target.appendChild(element);
      break;
  }
}

/**
 * Remove all SDK-injected elements, optionally filtered by ID.
 * 
 * @param {string|null} id - If provided, only remove elements with this ID
 */
export function removeInjected(id = null) {
  const selector = id
    ? `[data-ftl-sdk="${id}"]`
    : '[data-ftl-sdk]';
  
  document.querySelectorAll(selector).forEach(el => el.remove());
}

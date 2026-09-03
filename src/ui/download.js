/**
 * ui/download.js — Browser Download Helpers
 *
 * Triggers a real file download in the user's browser. Uses an
 * in-memory blob URL so the download attribute is honoured and
 * custom filenames work regardless of the source URL's origin.
 *
 * `fromUrl` uses the SDK's transport layer (core/transport.js)
 * to fetch cross-origin resources. The consumer must register
 * a transport first — see core/transport.js for details.
 */

import { fetchBytes, isRegistered } from '../core/transport.js';

function isArrayBuffer(data) {
    return Object.prototype.toString.call(data) === '[object ArrayBuffer]';
}

function isUint8Array(data) {
    return Object.prototype.toString.call(data) === '[object Uint8Array]';
}

function isBlob(data) {
    return typeof Blob !== 'undefined' && data instanceof Blob;
}

/**
 * Trigger a browser download for a chunk of bytes.
 *
 * Wraps the bytes in a Blob, creates a same-origin blob: URL,
 * and programmatically clicks a hidden <a download> to trigger
 * the save dialog. The blob URL is revoked after the click so
 * we don't leak memory.
 *
 * @param {Uint8Array|ArrayBuffer|Blob} data - Bytes to download
 * @param {string} filename - Suggested filename for the save dialog
 * @param {string} [mimeType='application/octet-stream'] - MIME type for the blob
 */
function saveBytes(data, filename, mimeType = 'application/octet-stream') {
    let blob;
    if (isBlob(data)) {
        blob = data;
    } else if (isUint8Array(data) || isArrayBuffer(data)) {
        blob = new Blob([data], { type: mimeType });
    } else {
        throw new Error('[ftl-ext-sdk] download.saveBytes requires Uint8Array, ArrayBuffer, or Blob');
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Revoke after a short delay so the browser has time to start
    // the download — revoking synchronously sometimes cancels it.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Download a file from a URL using the registered transport.
 *
 * Fetches the bytes via transport.fetchBytes (which bypasses CORS
 * in extension/userscript contexts) and triggers a browser save
 * dialog with the given filename.
 *
 * Throws if no transport is registered or if the fetch fails.
 *
 * @param {string} url - Absolute URL to download
 * @param {string} filename - Suggested filename for the save dialog
 * @param {string} [mimeType] - MIME type for the blob. Defaults to 'application/octet-stream'.
 * @returns {Promise<void>}
 */
async function fromUrl(url, filename, mimeType) {
    if (!isRegistered()) {
        throw new Error('[ftl-ext-sdk] download.fromUrl requires a transport. Call transport.register(fn) first.');
    }
    const bytes = await fetchBytes(url);
    saveBytes(bytes, filename, mimeType);
}

export { saveBytes, fromUrl };

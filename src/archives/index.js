/**
 * archives/index.js — Season Archive API
 *
 * Wraps the fishtank.live archive endpoints that power the /archives
 * page: room/day/video listings and signed watch URLs, plus pure
 * helpers for parsing archive filenames and resolving what's "on air"
 * at a given moment in the season timeline.
 *
 * The archive is stored as ~15-minute mp4 chunks per room per day.
 * Filenames encode their own schedule (e.g. "s03_bar_24-10-27_17-39-31.mp4"
 * starts at 17:39:31 show time on 2024-10-27). There is no duration
 * field — a chunk is bounded by the next chunk's startsAt, and its
 * exact playable length comes from the video element's metadata.
 * Gaps between chunks are genuine downtime ("No Signal").
 *
 * TIMESTAMPS: archive filenames/listings are stamped in UTC — verified
 * empirically (2026-08-18) by matching sunrise/sunset visible in the
 * footage against Rhode Island sun times; e.g. darkness falls at stamp
 * 21:2x on 2024-11-15, which is 16:2x EST — the real local sunset.
 * (The site's own re-run clock displays stamp time as if it were
 * Eastern, which is why its clock reads ~4-5h ahead of the visible
 * time of day.) parseShowTime() parses stamps as the UTC they are;
 * the "house" helpers convert to true America/New_York local time,
 * DST-aware — season 3 spans the Nov 2024 clock change.
 *
 * AUTH: watching archives requires being logged in to fishtank.live
 * with a season pass (the site's FREE_ARCHIVE_SEASONS marks s01 as
 * free). Requests send cookies; on failure everything here fails
 * silently (null / empty array).
 *
 * Watch URLs are signed per-file (Bunny CDN token + expiry, hours-scale
 * TTL) — never cache them long-term; re-request on playback error.
 *
 * Usage:
 *   import { archives } from 'ftl-ext-sdk';
 *
 *   const rooms  = await archives.getRooms('s03');            // ['bar', ...]
 *   const days   = await archives.getDays('s03', 'bar');      // ['2024-10-27', ...]
 *   const videos = await archives.getVideos('s03', 'bar', '2024-10-27');
 *
 *   const t = archives.parseShowTime('2024-10-27T18:00:00');
 *   const chunk = archives.findChunkAt(videos, t);
 *   if (chunk) {
 *     const url = await archives.getWatchUrl('s03', 'bar', '2024-10-27', chunk.video.fileName);
 *     // play url, seek to chunk.offsetSeconds
 *   }
 */

import { debugLog } from '../core/debug.js';

const API_BASE = 'https://api.fishtank.live/v1';

// Archive stamps are UTC (see module header). House time is the show
// location's real local time.
const HOUSE_TZ = 'America/New_York';

// ── Listing cache ───────────────────────────────────────────────────
// Listings are immutable historical data, so promises are memoized
// in-memory. Failed fetches are evicted so they can be retried.

const listingCache = new Map();

function cachedFetch(key, fetcher) {
  if (listingCache.has(key)) return listingCache.get(key);
  const promise = fetcher().catch(() => null).then((result) => {
    // Don't memoize failures (null / empty) — allow retry later
    if (result === null || (Array.isArray(result) && result.length === 0)) {
      listingCache.delete(key);
      return Array.isArray(result) ? result : null;
    }
    return result;
  });
  listingCache.set(key, promise);
  return promise;
}

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * Clear the in-memory listing cache.
 */
export function clearCache() {
  listingCache.clear();
}

// ── API wrapper ─────────────────────────────────────────────────────

/**
 * List rooms that have archive footage for a season.
 *
 * @param {string} season - e.g. 's03'
 * @returns {Promise<string[]>} Room codes (e.g. 'bar', 'den-ptz'), or [] on failure
 */
export function getRooms(season) {
  return cachedFetch(`rooms:${season}`, async () => {
    const data = await apiGet(`/archives/${season}/rooms`);
    return data?.rooms || [];
  }).then(r => r || []);
}

/**
 * List days with footage for a room in a season.
 *
 * @param {string} season - e.g. 's03'
 * @param {string} room - e.g. 'bar'
 * @returns {Promise<string[]>} ISO dates (e.g. '2024-10-27'), or [] on failure
 */
export function getDays(season, room) {
  return cachedFetch(`days:${season}/${room}`, async () => {
    const data = await apiGet(`/archives/${season}/${room}/days`);
    return data?.days || [];
  }).then(r => r || []);
}

/**
 * List video chunks for a room on a given day, sorted by start time.
 *
 * @param {string} season - e.g. 's03'
 * @param {string} room - e.g. 'bar'
 * @param {string} day - ISO date, e.g. '2024-10-27'
 * @returns {Promise<Array<{fileName: string, startsAt: string, hour: number, size: number}>>}
 *   Chunk listing, or [] on failure. startsAt is naive show time
 *   (e.g. '2024-10-27T17:39:31') — parse with parseShowTime().
 */
export function getVideos(season, room, day) {
  return cachedFetch(`videos:${season}/${room}/${day}`, async () => {
    const data = await apiGet(`/archives/${season}/${room}/${day}/videos`);
    const videos = data?.videos || [];
    return videos.slice().sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
  }).then(r => r || []);
}

/**
 * Request a signed playback URL for an archive video.
 *
 * URLs are signed per-file with an hours-scale expiry — request at
 * play time and re-request if playback errors (expired token).
 * NOT cached. Requires being logged in with a season pass (s01 is
 * marked free by the site).
 *
 * @param {string} season - e.g. 's03'
 * @param {string} room - e.g. 'bar'
 * @param {string} day - ISO date, e.g. '2024-10-27'
 * @param {string} fileName - e.g. 's03_bar_24-10-27_17-39-31.mp4'
 * @returns {Promise<string|null>} Signed URL, or null on failure
 */
export async function getWatchUrl(season, room, day, fileName) {
  try {
    const response = await fetch(`${API_BASE}/archives/watch`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season, room, day, fileName }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data?.url || null;
  } catch (err) {
    debugLog('archives.getWatchUrl failed:', err.message);
    return null;
  }
}

// ── Filename / label helpers ────────────────────────────────────────

const VIDEO_ID_PATTERN = /^(s\d{2})_([a-z0-9-]+)_(\d{2})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/i;

/**
 * Parse an archive video ID or filename into its parts.
 *
 * @param {string} idOrFileName - e.g. 's03_bar_24-10-27_17-39-31' or with '.mp4'
 * @returns {{season: string, room: string, day: string, fileName: string, startsAt: string}|null}
 */
export function parseVideoId(idOrFileName) {
  if (!idOrFileName) return null;
  const id = String(idOrFileName).replace(/\.mp4$/i, '');
  const m = id.match(VIDEO_ID_PATTERN);
  if (!m) return null;
  const [, season, room, yy, mo, dd, hh, mi, ss] = m;
  const day = `20${yy}-${mo}-${dd}`;
  return {
    season,
    room,
    day,
    fileName: `${id}.mp4`,
    startsAt: `${day}T${hh}:${mi}:${ss}`,
  };
}

const THUMBNAIL_BASE = 'https://cdn.fishtank.live/archive-thumbnails/primary';
const THUMBNAIL_INTERVAL_S = 5;

/**
 * Build the public thumbnail URL for a moment within an archive chunk.
 *
 * Thumbnails are pre-generated JPEG frames on the public CDN — no auth,
 * no token — one frame per 5 seconds of footage, indexed from 0:
 *   {base}/{room}/{day}/{videoId}/{N}.jpg
 * (The site uses them as tile previews and video posters.)
 *
 * Coverage is not guaranteed for every chunk (frames appear to be
 * generated as the site's re-run replays footage) — always attach an
 * onerror fallback when displaying.
 *
 * @param {string} idOrFileName - e.g. 's03_bar_24-10-27_17-39-31.mp4'
 * @param {number} [offsetSeconds=0] - Moment within the chunk
 * @returns {string|null} Thumbnail URL, or null if the ID is unparseable
 */
export function thumbnailUrl(idOrFileName, offsetSeconds = 0) {
  const parsed = parseVideoId(idOrFileName);
  if (!parsed) return null;
  const n = Math.max(0, Math.floor(offsetSeconds / THUMBNAIL_INTERVAL_S));
  const id = parsed.fileName.replace(/\.mp4$/i, '');
  return `${THUMBNAIL_BASE}/${parsed.room}/${parsed.day}/${id}/${n}.jpg`;
}

/**
 * Convert a room code to a display label ('den-ptz' → 'Den PTZ').
 *
 * @param {string} room
 * @returns {string}
 */
export function formatRoomLabel(room) {
  if (!room) return '?';
  return room
    .split('-')
    .map(part => (part === 'ptz' ? 'PTZ' : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

// ── Time helpers ────────────────────────────────────────────────────
// Two frames:
//  - STAMP frame: the UTC timestamps encoded in filenames/listings.
//    Used for all scheduling math and day-folder lookups.
//  - HOUSE frame: real America/New_York local time (DST-aware).
//    Used for anything shown to a human.

/**
 * Parse a naive archive timestamp ('2024-10-27T17:39:31') to epoch ms.
 * Stamps are UTC (see module header).
 *
 * @param {string} timestamp
 * @returns {number} Epoch ms (NaN if unparseable)
 */
export function parseShowTime(timestamp) {
  return Date.parse(`${timestamp}Z`);
}

/**
 * Format an epoch-ms moment as a stamp-frame (UTC) clock 'HH:MM:SS'.
 * Matches the filename/listing timestamps and the site's own clock.
 *
 * @param {number} ms - Epoch ms
 * @returns {string}
 */
export function formatShowClock(ms) {
  return new Date(ms).toISOString().slice(11, 19);
}

/**
 * Format an epoch-ms moment as a stamp-frame (UTC) ISO date
 * '2024-10-27'. This is the frame the archive's day folders use —
 * always use this (not the house date) to pick a day listing.
 *
 * @param {number} ms - Epoch ms
 * @returns {string}
 */
export function formatShowDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

// 'sv' locale reliably formats as 'YYYY-MM-DD HH:mm:ss'.
function houseWallString(ms) {
  return new Date(ms).toLocaleString('sv', { timeZone: HOUSE_TZ }).replace(' ', 'T');
}

/**
 * Parse a naive HOUSE-local timestamp ('2024-11-15T18:00:00' meaning
 * 6pm at the show location) to epoch ms, DST-aware.
 *
 * @param {string} timestamp
 * @returns {number} Epoch ms (NaN if unparseable)
 */
export function parseHouseTime(timestamp) {
  const utcGuess = Date.parse(`${timestamp}Z`);
  if (Number.isNaN(utcGuess)) return NaN;
  // Two-pass zone conversion: correct the guess by the house offset at
  // the guessed moment, then re-check at the corrected moment in case
  // the guess straddled a DST transition.
  let ms = utcGuess + (utcGuess - Date.parse(`${houseWallString(utcGuess)}Z`));
  ms += utcGuess - Date.parse(`${houseWallString(ms)}Z`);
  return ms;
}

/**
 * Format an epoch-ms moment as a house-local clock — 'HH:MM:SS' by
 * default, or 'H:MM:SS AM/PM' with hour12.
 *
 * @param {number} ms - Epoch ms
 * @param {boolean} [hour12=false] - 12-hour clock with AM/PM suffix
 * @returns {string}
 */
export function formatHouseClock(ms, hour12 = false) {
  const t = houseWallString(ms).slice(11, 19);
  if (!hour12) return t;
  const h = Number(t.slice(0, 2));
  return `${((h + 11) % 12) + 1}${t.slice(2)} ${h >= 12 ? 'PM' : 'AM'}`;
}

/**
 * Format an epoch-ms moment as a house-local ISO date '2024-11-15'.
 *
 * @param {number} ms - Epoch ms
 * @returns {string}
 */
export function formatHouseDate(ms) {
  return houseWallString(ms).slice(0, 10);
}

// ── Share codes ─────────────────────────────────────────────────────
// A share code pins a moment in a season to a compact, human-readable
// string that means the same real moment for everyone:
//
//   FTL1-s03-D11-1817-kitchen
//   └┬─┘ └┬┘ └┬┘ └┬─┘ └──┬──┘
// version season day HHMM  room (optional)
//
// Day and time are HOUSE time (see above), so a code reads naturally
// in chat AND resolves to the same absolute moment for every user.
// Codes also travel as links via the URL fragment:
// https://fishtank.live/#FTL1-s03-D11-1817-kitchen (fragments never
// reach the server; extensions pick them up client-side).

const SHARE_CODE_RE = /^FTL1-(s\d{2})-D(\d{1,2})-(\d{2})(\d{2})(?:-([a-z0-9-]+))?$/i;

/**
 * Build a share code from structured fields.
 *
 * @param {{season: string, day: number, time: string, room?: string|null}} parts
 *   - season e.g. 's03'; day 1-based; time 'HH:MM' house-local 24h;
 *     room code or null for "land on the grid"
 * @returns {string} e.g. 'FTL1-s03-D11-1817-kitchen'
 */
export function buildShareCode({ season, day, time, room }) {
  return `FTL1-${season}-D${day}-${time.replace(':', '')}${room ? `-${room}` : ''}`;
}

/**
 * Parse a share code or share link. Accepts bare codes, full URLs, and
 * '#'-prefixed fragments; case-insensitive; whitespace-tolerant.
 *
 * @param {string} input
 * @returns {{season: string, day: number, time: string, room: string|null}|null}
 *   null if the input isn't a valid code
 */
export function parseShareCode(input) {
  if (typeof input !== 'string') return null;
  let str = input.trim();
  const hashIdx = str.indexOf('#');
  if (hashIdx !== -1) str = str.slice(hashIdx + 1);
  const m = str.match(SHARE_CODE_RE);
  if (!m) return null;
  const day = parseInt(m[2], 10);
  const hh = parseInt(m[3], 10);
  const mm = parseInt(m[4], 10);
  if (day < 1 || hh > 23 || mm > 59) return null;
  return {
    season: m[1].toLowerCase(),
    day,
    time: `${m[3]}:${m[4]}`,
    room: m[5] ? m[5].toLowerCase() : null,
  };
}

/**
 * The clickable-link form of a share code.
 *
 * @param {string} code
 * @returns {string}
 */
export function shareUrl(code) {
  return `https://fishtank.live/#${code}`;
}

// ── Schedule helpers ────────────────────────────────────────────────

/**
 * Find the chunk that covers a given moment, from a day's video listing.
 *
 * Returns the latest chunk whose startsAt is <= timeMs, with the seek
 * offset into it. The offset may exceed the chunk's real duration when
 * the moment falls in a gap — the player must validate against the
 * video element's duration once metadata loads (and treat overshoot
 * as "No Signal"). nextStartsAtMs is the following chunk's start
 * (null if this is the last chunk of the listing).
 *
 * @param {Array<{fileName: string, startsAt: string}>} videos - Sorted day listing
 * @param {number} timeMs - Epoch ms (use parseShowTime / a virtual clock)
 * @returns {{video: object, offsetSeconds: number, nextStartsAtMs: number|null}|null}
 *   null if the listing is empty or timeMs is before the first chunk
 */
export function findChunkAt(videos, timeMs) {
  if (!Array.isArray(videos) || videos.length === 0) return null;
  let found = null;
  let nextStartsAtMs = null;
  for (let i = videos.length - 1; i >= 0; i--) {
    const startMs = parseShowTime(videos[i].startsAt);
    if (startMs <= timeMs) {
      found = videos[i];
      nextStartsAtMs = i + 1 < videos.length
        ? parseShowTime(videos[i + 1].startsAt)
        : null;
      return {
        video: found,
        offsetSeconds: (timeMs - startMs) / 1000,
        nextStartsAtMs,
      };
    }
  }
  return null;
}

/**
 * Find the first chunk starting after a given moment, from a day's
 * video listing. Useful for "No Signal" countdowns.
 *
 * @param {Array<{fileName: string, startsAt: string}>} videos - Sorted day listing
 * @param {number} timeMs - Epoch ms
 * @returns {object|null} The next chunk, or null if none starts after timeMs
 */
export function nextChunkAfter(videos, timeMs) {
  if (!Array.isArray(videos)) return null;
  for (const video of videos) {
    if (parseShowTime(video.startsAt) > timeMs) return video;
  }
  return null;
}

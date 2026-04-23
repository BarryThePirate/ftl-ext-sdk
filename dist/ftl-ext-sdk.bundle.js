(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.FTL = {}));
})(this, (function (exports) { 'use strict';

  function _mergeNamespaces(n, m) {
    m.forEach(function (e) {
      e && typeof e !== 'string' && !Array.isArray(e) && Object.keys(e).forEach(function (k) {
        if (k !== 'default' && !(k in n)) {
          var d = Object.getOwnPropertyDescriptor(e, k);
          Object.defineProperty(n, k, d.get ? d : {
            enumerable: true,
            get: function () { return e[k]; }
          });
        }
      });
    });
    return Object.freeze(n);
  }

  /**
   * core/react.js — React Fiber Tree Access
   * 
   * Provides access to React's internal fiber tree, which lets us
   * find components and their state without depending on DOM structure.
   */

  // Cache the fiber key for the session (changes per build, stable per page load)
  let _fiberKey = null;

  /**
   * Get the React fiber key suffix for this page load.
   * Returns the hash portion, e.g. "z62ix5tx60a"
   */
  function getReactFiberKey() {
    if (_fiberKey) return _fiberKey;
    
    const key = Object.keys(document.body).find(k => k.startsWith('__reactFiber$'));
    if (key) {
      _fiberKey = key.replace('__reactFiber$', '');
    }
    return _fiberKey;
  }

  /**
   * Get the React fiber node for a DOM element.
   * Returns the fiber object or null.
   */
  function getFiber(element) {
    const key = getReactFiberKey();
    if (!key) return null;
    return element[`__reactFiber$${key}`] || null;
  }

  /**
   * Get React props for a DOM element.
   * Returns the props object or null.
   */
  function getProps(element) {
    const key = getReactFiberKey();
    if (!key) return null;
    return element[`__reactProps$${key}`] || null;
  }

  /**
   * Walk up the fiber tree from a DOM element.
   * Calls `test(fiber)` on each fiber node going upward.
   * Returns the first fiber where `test` returns true, or null.
   */
  function walkFiberUp(element, test, maxDepth = 50) {
    let fiber = getFiber(element);
    let depth = 0;
    
    while (fiber && depth < maxDepth) {
      if (test(fiber)) return fiber;
      fiber = fiber.return;
      depth++;
    }
    
    return null;
  }

  /**
   * Walk down the fiber tree (child → sibling).
   * Calls `test(fiber)` on each node.
   * Returns the first fiber where `test` returns true, or null.
   */
  function walkFiberDown(fiber, test, maxDepth = 50) {
    if (!fiber || maxDepth <= 0) return null;
    if (test(fiber)) return fiber;
    
    let result = walkFiberDown(fiber.child, test, maxDepth - 1);
    if (result) return result;
    
    return walkFiberDown(fiber.sibling, test, maxDepth - 1);
  }

  /**
   * Find a hook value in a fiber's memoizedState chain.
   * `test` receives the memoizedState value and returns true if it matches.
   * Returns the matching state value or null.
   */
  function findHookState(fiber, test) {
    let state = fiber?.memoizedState;
    
    while (state) {
      try {
        if (state.memoizedState && test(state.memoizedState)) {
          return state.memoizedState;
        }
      } catch {}
      state = state.next;
    }
    
    return null;
  }

  /**
   * Search the fiber tree starting from document.body for a hook state
   * matching the test function.
   * Returns the matching state value or null.
   */
  function findInTree(test, maxDepth = 100) {
    const rootFiber = getFiber(document.body);
    if (!rootFiber) return null;
    
    let result = null;
    
    function search(fiber, depth) {
      if (!fiber || depth > maxDepth || result) return;
      
      const found = findHookState(fiber, test);
      if (found) {
        result = found;
        return;
      }
      
      search(fiber.child, depth + 1);
      search(fiber.sibling, depth + 1);
    }
    
    search(rootFiber, 0);
    return result;
  }

  /**
   * Check if React fiber access is available on this page.
   */
  function isAvailable() {
    return getReactFiberKey() !== null;
  }

  var react = /*#__PURE__*/Object.freeze({
    __proto__: null,
    findHookState: findHookState,
    findInTree: findInTree,
    getFiber: getFiber,
    getProps: getProps,
    getReactFiberKey: getReactFiberKey,
    isAvailable: isAvailable,
    walkFiberDown: walkFiberDown,
    walkFiberUp: walkFiberUp
  });

  const PACKET_TYPES = Object.create(null); // no Map = no polyfill
  PACKET_TYPES["open"] = "0";
  PACKET_TYPES["close"] = "1";
  PACKET_TYPES["ping"] = "2";
  PACKET_TYPES["pong"] = "3";
  PACKET_TYPES["message"] = "4";
  PACKET_TYPES["upgrade"] = "5";
  PACKET_TYPES["noop"] = "6";
  const PACKET_TYPES_REVERSE = Object.create(null);
  Object.keys(PACKET_TYPES).forEach((key) => {
      PACKET_TYPES_REVERSE[PACKET_TYPES[key]] = key;
  });
  const ERROR_PACKET = { type: "error", data: "parser error" };

  const withNativeBlob$1 = typeof Blob === "function" ||
      (typeof Blob !== "undefined" &&
          Object.prototype.toString.call(Blob) === "[object BlobConstructor]");
  const withNativeArrayBuffer$2 = typeof ArrayBuffer === "function";
  // ArrayBuffer.isView method is not defined in IE10
  const isView$1 = (obj) => {
      return typeof ArrayBuffer.isView === "function"
          ? ArrayBuffer.isView(obj)
          : obj && obj.buffer instanceof ArrayBuffer;
  };
  const encodePacket = ({ type, data }, supportsBinary, callback) => {
      if (withNativeBlob$1 && data instanceof Blob) {
          if (supportsBinary) {
              return callback(data);
          }
          else {
              return encodeBlobAsBase64(data, callback);
          }
      }
      else if (withNativeArrayBuffer$2 &&
          (data instanceof ArrayBuffer || isView$1(data))) {
          if (supportsBinary) {
              return callback(data);
          }
          else {
              return encodeBlobAsBase64(new Blob([data]), callback);
          }
      }
      // plain string
      return callback(PACKET_TYPES[type] + (data || ""));
  };
  const encodeBlobAsBase64 = (data, callback) => {
      const fileReader = new FileReader();
      fileReader.onload = function () {
          const content = fileReader.result.split(",")[1];
          callback("b" + (content || ""));
      };
      return fileReader.readAsDataURL(data);
  };
  function toArray(data) {
      if (data instanceof Uint8Array) {
          return data;
      }
      else if (data instanceof ArrayBuffer) {
          return new Uint8Array(data);
      }
      else {
          return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      }
  }
  let TEXT_ENCODER;
  function encodePacketToBinary(packet, callback) {
      if (withNativeBlob$1 && packet.data instanceof Blob) {
          return packet.data.arrayBuffer().then(toArray).then(callback);
      }
      else if (withNativeArrayBuffer$2 &&
          (packet.data instanceof ArrayBuffer || isView$1(packet.data))) {
          return callback(toArray(packet.data));
      }
      encodePacket(packet, false, (encoded) => {
          if (!TEXT_ENCODER) {
              TEXT_ENCODER = new TextEncoder();
          }
          callback(TEXT_ENCODER.encode(encoded));
      });
  }

  // imported from https://github.com/socketio/base64-arraybuffer
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  // Use a lookup table to find the index.
  const lookup$1 = typeof Uint8Array === 'undefined' ? [] : new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
      lookup$1[chars.charCodeAt(i)] = i;
  }
  const decode$2 = (base64) => {
      let bufferLength = base64.length * 0.75, len = base64.length, i, p = 0, encoded1, encoded2, encoded3, encoded4;
      if (base64[base64.length - 1] === '=') {
          bufferLength--;
          if (base64[base64.length - 2] === '=') {
              bufferLength--;
          }
      }
      const arraybuffer = new ArrayBuffer(bufferLength), bytes = new Uint8Array(arraybuffer);
      for (i = 0; i < len; i += 4) {
          encoded1 = lookup$1[base64.charCodeAt(i)];
          encoded2 = lookup$1[base64.charCodeAt(i + 1)];
          encoded3 = lookup$1[base64.charCodeAt(i + 2)];
          encoded4 = lookup$1[base64.charCodeAt(i + 3)];
          bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
          bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
          bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
      }
      return arraybuffer;
  };

  const withNativeArrayBuffer$1 = typeof ArrayBuffer === "function";
  const decodePacket = (encodedPacket, binaryType) => {
      if (typeof encodedPacket !== "string") {
          return {
              type: "message",
              data: mapBinary(encodedPacket, binaryType),
          };
      }
      const type = encodedPacket.charAt(0);
      if (type === "b") {
          return {
              type: "message",
              data: decodeBase64Packet(encodedPacket.substring(1), binaryType),
          };
      }
      const packetType = PACKET_TYPES_REVERSE[type];
      if (!packetType) {
          return ERROR_PACKET;
      }
      return encodedPacket.length > 1
          ? {
              type: PACKET_TYPES_REVERSE[type],
              data: encodedPacket.substring(1),
          }
          : {
              type: PACKET_TYPES_REVERSE[type],
          };
  };
  const decodeBase64Packet = (data, binaryType) => {
      if (withNativeArrayBuffer$1) {
          const decoded = decode$2(data);
          return mapBinary(decoded, binaryType);
      }
      else {
          return { base64: true, data }; // fallback for old browsers
      }
  };
  const mapBinary = (data, binaryType) => {
      switch (binaryType) {
          case "blob":
              if (data instanceof Blob) {
                  // from WebSocket + binaryType "blob"
                  return data;
              }
              else {
                  // from HTTP long-polling or WebTransport
                  return new Blob([data]);
              }
          case "arraybuffer":
          default:
              if (data instanceof ArrayBuffer) {
                  // from HTTP long-polling (base64) or WebSocket + binaryType "arraybuffer"
                  return data;
              }
              else {
                  // from WebTransport (Uint8Array)
                  return data.buffer;
              }
      }
  };

  const SEPARATOR = String.fromCharCode(30); // see https://en.wikipedia.org/wiki/Delimiter#ASCII_delimited_text
  const encodePayload = (packets, callback) => {
      // some packets may be added to the array while encoding, so the initial length must be saved
      const length = packets.length;
      const encodedPackets = new Array(length);
      let count = 0;
      packets.forEach((packet, i) => {
          // force base64 encoding for binary packets
          encodePacket(packet, false, (encodedPacket) => {
              encodedPackets[i] = encodedPacket;
              if (++count === length) {
                  callback(encodedPackets.join(SEPARATOR));
              }
          });
      });
  };
  const decodePayload = (encodedPayload, binaryType) => {
      const encodedPackets = encodedPayload.split(SEPARATOR);
      const packets = [];
      for (let i = 0; i < encodedPackets.length; i++) {
          const decodedPacket = decodePacket(encodedPackets[i], binaryType);
          packets.push(decodedPacket);
          if (decodedPacket.type === "error") {
              break;
          }
      }
      return packets;
  };
  function createPacketEncoderStream() {
      return new TransformStream({
          transform(packet, controller) {
              encodePacketToBinary(packet, (encodedPacket) => {
                  const payloadLength = encodedPacket.length;
                  let header;
                  // inspired by the WebSocket format: https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers#decoding_payload_length
                  if (payloadLength < 126) {
                      header = new Uint8Array(1);
                      new DataView(header.buffer).setUint8(0, payloadLength);
                  }
                  else if (payloadLength < 65536) {
                      header = new Uint8Array(3);
                      const view = new DataView(header.buffer);
                      view.setUint8(0, 126);
                      view.setUint16(1, payloadLength);
                  }
                  else {
                      header = new Uint8Array(9);
                      const view = new DataView(header.buffer);
                      view.setUint8(0, 127);
                      view.setBigUint64(1, BigInt(payloadLength));
                  }
                  // first bit indicates whether the payload is plain text (0) or binary (1)
                  if (packet.data && typeof packet.data !== "string") {
                      header[0] |= 0x80;
                  }
                  controller.enqueue(header);
                  controller.enqueue(encodedPacket);
              });
          },
      });
  }
  let TEXT_DECODER;
  function totalLength(chunks) {
      return chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  }
  function concatChunks(chunks, size) {
      if (chunks[0].length === size) {
          return chunks.shift();
      }
      const buffer = new Uint8Array(size);
      let j = 0;
      for (let i = 0; i < size; i++) {
          buffer[i] = chunks[0][j++];
          if (j === chunks[0].length) {
              chunks.shift();
              j = 0;
          }
      }
      if (chunks.length && j < chunks[0].length) {
          chunks[0] = chunks[0].slice(j);
      }
      return buffer;
  }
  function createPacketDecoderStream(maxPayload, binaryType) {
      if (!TEXT_DECODER) {
          TEXT_DECODER = new TextDecoder();
      }
      const chunks = [];
      let state = 0 /* State.READ_HEADER */;
      let expectedLength = -1;
      let isBinary = false;
      return new TransformStream({
          transform(chunk, controller) {
              chunks.push(chunk);
              while (true) {
                  if (state === 0 /* State.READ_HEADER */) {
                      if (totalLength(chunks) < 1) {
                          break;
                      }
                      const header = concatChunks(chunks, 1);
                      isBinary = (header[0] & 0x80) === 0x80;
                      expectedLength = header[0] & 0x7f;
                      if (expectedLength < 126) {
                          state = 3 /* State.READ_PAYLOAD */;
                      }
                      else if (expectedLength === 126) {
                          state = 1 /* State.READ_EXTENDED_LENGTH_16 */;
                      }
                      else {
                          state = 2 /* State.READ_EXTENDED_LENGTH_64 */;
                      }
                  }
                  else if (state === 1 /* State.READ_EXTENDED_LENGTH_16 */) {
                      if (totalLength(chunks) < 2) {
                          break;
                      }
                      const headerArray = concatChunks(chunks, 2);
                      expectedLength = new DataView(headerArray.buffer, headerArray.byteOffset, headerArray.length).getUint16(0);
                      state = 3 /* State.READ_PAYLOAD */;
                  }
                  else if (state === 2 /* State.READ_EXTENDED_LENGTH_64 */) {
                      if (totalLength(chunks) < 8) {
                          break;
                      }
                      const headerArray = concatChunks(chunks, 8);
                      const view = new DataView(headerArray.buffer, headerArray.byteOffset, headerArray.length);
                      const n = view.getUint32(0);
                      if (n > Math.pow(2, 53 - 32) - 1) {
                          // the maximum safe integer in JavaScript is 2^53 - 1
                          controller.enqueue(ERROR_PACKET);
                          break;
                      }
                      expectedLength = n * Math.pow(2, 32) + view.getUint32(4);
                      state = 3 /* State.READ_PAYLOAD */;
                  }
                  else {
                      if (totalLength(chunks) < expectedLength) {
                          break;
                      }
                      const data = concatChunks(chunks, expectedLength);
                      controller.enqueue(decodePacket(isBinary ? data : TEXT_DECODER.decode(data), binaryType));
                      state = 0 /* State.READ_HEADER */;
                  }
                  if (expectedLength === 0 || expectedLength > maxPayload) {
                      controller.enqueue(ERROR_PACKET);
                      break;
                  }
              }
          },
      });
  }
  const protocol$1 = 4;

  /**
   * Initialize a new `Emitter`.
   *
   * @api public
   */

  function Emitter$1(obj) {
    if (obj) return mixin(obj);
  }

  /**
   * Mixin the emitter properties.
   *
   * @param {Object} obj
   * @return {Object}
   * @api private
   */

  function mixin(obj) {
    for (var key in Emitter$1.prototype) {
      obj[key] = Emitter$1.prototype[key];
    }
    return obj;
  }

  /**
   * Listen on the given `event` with `fn`.
   *
   * @param {String} event
   * @param {Function} fn
   * @return {Emitter}
   * @api public
   */

  Emitter$1.prototype.on =
  Emitter$1.prototype.addEventListener = function(event, fn){
    this._callbacks = this._callbacks || {};
    (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
      .push(fn);
    return this;
  };

  /**
   * Adds an `event` listener that will be invoked a single
   * time then automatically removed.
   *
   * @param {String} event
   * @param {Function} fn
   * @return {Emitter}
   * @api public
   */

  Emitter$1.prototype.once = function(event, fn){
    function on() {
      this.off(event, on);
      fn.apply(this, arguments);
    }

    on.fn = fn;
    this.on(event, on);
    return this;
  };

  /**
   * Remove the given callback for `event` or all
   * registered callbacks.
   *
   * @param {String} event
   * @param {Function} fn
   * @return {Emitter}
   * @api public
   */

  Emitter$1.prototype.off =
  Emitter$1.prototype.removeListener =
  Emitter$1.prototype.removeAllListeners =
  Emitter$1.prototype.removeEventListener = function(event, fn){
    this._callbacks = this._callbacks || {};

    // all
    if (0 == arguments.length) {
      this._callbacks = {};
      return this;
    }

    // specific event
    var callbacks = this._callbacks['$' + event];
    if (!callbacks) return this;

    // remove all handlers
    if (1 == arguments.length) {
      delete this._callbacks['$' + event];
      return this;
    }

    // remove specific handler
    var cb;
    for (var i = 0; i < callbacks.length; i++) {
      cb = callbacks[i];
      if (cb === fn || cb.fn === fn) {
        callbacks.splice(i, 1);
        break;
      }
    }

    // Remove event specific arrays for event types that no
    // one is subscribed for to avoid memory leak.
    if (callbacks.length === 0) {
      delete this._callbacks['$' + event];
    }

    return this;
  };

  /**
   * Emit `event` with the given args.
   *
   * @param {String} event
   * @param {Mixed} ...
   * @return {Emitter}
   */

  Emitter$1.prototype.emit = function(event){
    this._callbacks = this._callbacks || {};

    var args = new Array(arguments.length - 1)
      , callbacks = this._callbacks['$' + event];

    for (var i = 1; i < arguments.length; i++) {
      args[i - 1] = arguments[i];
    }

    if (callbacks) {
      callbacks = callbacks.slice(0);
      for (var i = 0, len = callbacks.length; i < len; ++i) {
        callbacks[i].apply(this, args);
      }
    }

    return this;
  };

  // alias used for reserved events (protected method)
  Emitter$1.prototype.emitReserved = Emitter$1.prototype.emit;

  /**
   * Return array of callbacks for `event`.
   *
   * @param {String} event
   * @return {Array}
   * @api public
   */

  Emitter$1.prototype.listeners = function(event){
    this._callbacks = this._callbacks || {};
    return this._callbacks['$' + event] || [];
  };

  /**
   * Check if this emitter has `event` handlers.
   *
   * @param {String} event
   * @return {Boolean}
   * @api public
   */

  Emitter$1.prototype.hasListeners = function(event){
    return !! this.listeners(event).length;
  };

  const nextTick = (() => {
      const isPromiseAvailable = typeof Promise === "function" && typeof Promise.resolve === "function";
      if (isPromiseAvailable) {
          return (cb) => Promise.resolve().then(cb);
      }
      else {
          return (cb, setTimeoutFn) => setTimeoutFn(cb, 0);
      }
  })();
  const globalThisShim = (() => {
      if (typeof self !== "undefined") {
          return self;
      }
      else if (typeof window !== "undefined") {
          return window;
      }
      else {
          return Function("return this")();
      }
  })();
  const defaultBinaryType = "arraybuffer";
  function createCookieJar() { }

  function pick(obj, ...attr) {
      return attr.reduce((acc, k) => {
          if (obj.hasOwnProperty(k)) {
              acc[k] = obj[k];
          }
          return acc;
      }, {});
  }
  // Keep a reference to the real timeout functions so they can be used when overridden
  const NATIVE_SET_TIMEOUT = globalThisShim.setTimeout;
  const NATIVE_CLEAR_TIMEOUT = globalThisShim.clearTimeout;
  function installTimerFunctions(obj, opts) {
      if (opts.useNativeTimers) {
          obj.setTimeoutFn = NATIVE_SET_TIMEOUT.bind(globalThisShim);
          obj.clearTimeoutFn = NATIVE_CLEAR_TIMEOUT.bind(globalThisShim);
      }
      else {
          obj.setTimeoutFn = globalThisShim.setTimeout.bind(globalThisShim);
          obj.clearTimeoutFn = globalThisShim.clearTimeout.bind(globalThisShim);
      }
  }
  // base64 encoded buffers are about 33% bigger (https://en.wikipedia.org/wiki/Base64)
  const BASE64_OVERHEAD = 1.33;
  // we could also have used `new Blob([obj]).size`, but it isn't supported in IE9
  function byteLength(obj) {
      if (typeof obj === "string") {
          return utf8Length$1(obj);
      }
      // arraybuffer or blob
      return Math.ceil((obj.byteLength || obj.size) * BASE64_OVERHEAD);
  }
  function utf8Length$1(str) {
      let c = 0, length = 0;
      for (let i = 0, l = str.length; i < l; i++) {
          c = str.charCodeAt(i);
          if (c < 0x80) {
              length += 1;
          }
          else if (c < 0x800) {
              length += 2;
          }
          else if (c < 0xd800 || c >= 0xe000) {
              length += 3;
          }
          else {
              i++;
              length += 4;
          }
      }
      return length;
  }
  /**
   * Generates a random 8-characters string.
   */
  function randomString() {
      return (Date.now().toString(36).substring(3) +
          Math.random().toString(36).substring(2, 5));
  }

  // imported from https://github.com/galkn/querystring
  /**
   * Compiles a querystring
   * Returns string representation of the object
   *
   * @param {Object}
   * @api private
   */
  function encode$1(obj) {
      let str = '';
      for (let i in obj) {
          if (obj.hasOwnProperty(i)) {
              if (str.length)
                  str += '&';
              str += encodeURIComponent(i) + '=' + encodeURIComponent(obj[i]);
          }
      }
      return str;
  }
  /**
   * Parses a simple querystring into an object
   *
   * @param {String} qs
   * @api private
   */
  function decode$1(qs) {
      let qry = {};
      let pairs = qs.split('&');
      for (let i = 0, l = pairs.length; i < l; i++) {
          let pair = pairs[i].split('=');
          qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
      }
      return qry;
  }

  class TransportError extends Error {
      constructor(reason, description, context) {
          super(reason);
          this.description = description;
          this.context = context;
          this.type = "TransportError";
      }
  }
  class Transport extends Emitter$1 {
      /**
       * Transport abstract constructor.
       *
       * @param {Object} opts - options
       * @protected
       */
      constructor(opts) {
          super();
          this.writable = false;
          installTimerFunctions(this, opts);
          this.opts = opts;
          this.query = opts.query;
          this.socket = opts.socket;
          this.supportsBinary = !opts.forceBase64;
      }
      /**
       * Emits an error.
       *
       * @param {String} reason
       * @param description
       * @param context - the error context
       * @return {Transport} for chaining
       * @protected
       */
      onError(reason, description, context) {
          super.emitReserved("error", new TransportError(reason, description, context));
          return this;
      }
      /**
       * Opens the transport.
       */
      open() {
          this.readyState = "opening";
          this.doOpen();
          return this;
      }
      /**
       * Closes the transport.
       */
      close() {
          if (this.readyState === "opening" || this.readyState === "open") {
              this.doClose();
              this.onClose();
          }
          return this;
      }
      /**
       * Sends multiple packets.
       *
       * @param {Array} packets
       */
      send(packets) {
          if (this.readyState === "open") {
              this.write(packets);
          }
      }
      /**
       * Called upon open
       *
       * @protected
       */
      onOpen() {
          this.readyState = "open";
          this.writable = true;
          super.emitReserved("open");
      }
      /**
       * Called with data.
       *
       * @param {String} data
       * @protected
       */
      onData(data) {
          const packet = decodePacket(data, this.socket.binaryType);
          this.onPacket(packet);
      }
      /**
       * Called with a decoded packet.
       *
       * @protected
       */
      onPacket(packet) {
          super.emitReserved("packet", packet);
      }
      /**
       * Called upon close.
       *
       * @protected
       */
      onClose(details) {
          this.readyState = "closed";
          super.emitReserved("close", details);
      }
      /**
       * Pauses the transport, in order not to lose packets during an upgrade.
       *
       * @param onPause
       */
      pause(onPause) { }
      createUri(schema, query = {}) {
          return (schema +
              "://" +
              this._hostname() +
              this._port() +
              this.opts.path +
              this._query(query));
      }
      _hostname() {
          const hostname = this.opts.hostname;
          return hostname.indexOf(":") === -1 ? hostname : "[" + hostname + "]";
      }
      _port() {
          if (this.opts.port &&
              ((this.opts.secure && Number(this.opts.port) !== 443) ||
                  (!this.opts.secure && Number(this.opts.port) !== 80))) {
              return ":" + this.opts.port;
          }
          else {
              return "";
          }
      }
      _query(query) {
          const encodedQuery = encode$1(query);
          return encodedQuery.length ? "?" + encodedQuery : "";
      }
  }

  class Polling extends Transport {
      constructor() {
          super(...arguments);
          this._polling = false;
      }
      get name() {
          return "polling";
      }
      /**
       * Opens the socket (triggers polling). We write a PING message to determine
       * when the transport is open.
       *
       * @protected
       */
      doOpen() {
          this._poll();
      }
      /**
       * Pauses polling.
       *
       * @param {Function} onPause - callback upon buffers are flushed and transport is paused
       * @package
       */
      pause(onPause) {
          this.readyState = "pausing";
          const pause = () => {
              this.readyState = "paused";
              onPause();
          };
          if (this._polling || !this.writable) {
              let total = 0;
              if (this._polling) {
                  total++;
                  this.once("pollComplete", function () {
                      --total || pause();
                  });
              }
              if (!this.writable) {
                  total++;
                  this.once("drain", function () {
                      --total || pause();
                  });
              }
          }
          else {
              pause();
          }
      }
      /**
       * Starts polling cycle.
       *
       * @private
       */
      _poll() {
          this._polling = true;
          this.doPoll();
          this.emitReserved("poll");
      }
      /**
       * Overloads onData to detect payloads.
       *
       * @protected
       */
      onData(data) {
          const callback = (packet) => {
              // if its the first message we consider the transport open
              if ("opening" === this.readyState && packet.type === "open") {
                  this.onOpen();
              }
              // if its a close packet, we close the ongoing requests
              if ("close" === packet.type) {
                  this.onClose({ description: "transport closed by the server" });
                  return false;
              }
              // otherwise bypass onData and handle the message
              this.onPacket(packet);
          };
          // decode payload
          decodePayload(data, this.socket.binaryType).forEach(callback);
          // if an event did not trigger closing
          if ("closed" !== this.readyState) {
              // if we got data we're not polling
              this._polling = false;
              this.emitReserved("pollComplete");
              if ("open" === this.readyState) {
                  this._poll();
              }
          }
      }
      /**
       * For polling, send a close packet.
       *
       * @protected
       */
      doClose() {
          const close = () => {
              this.write([{ type: "close" }]);
          };
          if ("open" === this.readyState) {
              close();
          }
          else {
              // in case we're trying to close while
              // handshaking is in progress (GH-164)
              this.once("open", close);
          }
      }
      /**
       * Writes a packets payload.
       *
       * @param {Array} packets - data packets
       * @protected
       */
      write(packets) {
          this.writable = false;
          encodePayload(packets, (data) => {
              this.doWrite(data, () => {
                  this.writable = true;
                  this.emitReserved("drain");
              });
          });
      }
      /**
       * Generates uri for connection.
       *
       * @private
       */
      uri() {
          const schema = this.opts.secure ? "https" : "http";
          const query = this.query || {};
          // cache busting is forced
          if (false !== this.opts.timestampRequests) {
              query[this.opts.timestampParam] = randomString();
          }
          if (!this.supportsBinary && !query.sid) {
              query.b64 = 1;
          }
          return this.createUri(schema, query);
      }
  }

  // imported from https://github.com/component/has-cors
  let value = false;
  try {
      value = typeof XMLHttpRequest !== 'undefined' &&
          'withCredentials' in new XMLHttpRequest();
  }
  catch (err) {
      // if XMLHttp support is disabled in IE then it will throw
      // when trying to create
  }
  const hasCORS = value;

  function empty() { }
  class BaseXHR extends Polling {
      /**
       * XHR Polling constructor.
       *
       * @param {Object} opts
       * @package
       */
      constructor(opts) {
          super(opts);
          if (typeof location !== "undefined") {
              const isSSL = "https:" === location.protocol;
              let port = location.port;
              // some user agents have empty `location.port`
              if (!port) {
                  port = isSSL ? "443" : "80";
              }
              this.xd =
                  (typeof location !== "undefined" &&
                      opts.hostname !== location.hostname) ||
                      port !== opts.port;
          }
      }
      /**
       * Sends data.
       *
       * @param {String} data to send.
       * @param {Function} called upon flush.
       * @private
       */
      doWrite(data, fn) {
          const req = this.request({
              method: "POST",
              data: data,
          });
          req.on("success", fn);
          req.on("error", (xhrStatus, context) => {
              this.onError("xhr post error", xhrStatus, context);
          });
      }
      /**
       * Starts a poll cycle.
       *
       * @private
       */
      doPoll() {
          const req = this.request();
          req.on("data", this.onData.bind(this));
          req.on("error", (xhrStatus, context) => {
              this.onError("xhr poll error", xhrStatus, context);
          });
          this.pollXhr = req;
      }
  }
  class Request extends Emitter$1 {
      /**
       * Request constructor
       *
       * @param {Object} options
       * @package
       */
      constructor(createRequest, uri, opts) {
          super();
          this.createRequest = createRequest;
          installTimerFunctions(this, opts);
          this._opts = opts;
          this._method = opts.method || "GET";
          this._uri = uri;
          this._data = undefined !== opts.data ? opts.data : null;
          this._create();
      }
      /**
       * Creates the XHR object and sends the request.
       *
       * @private
       */
      _create() {
          var _a;
          const opts = pick(this._opts, "agent", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "autoUnref");
          opts.xdomain = !!this._opts.xd;
          const xhr = (this._xhr = this.createRequest(opts));
          try {
              xhr.open(this._method, this._uri, true);
              try {
                  if (this._opts.extraHeaders) {
                      // @ts-ignore
                      xhr.setDisableHeaderCheck && xhr.setDisableHeaderCheck(true);
                      for (let i in this._opts.extraHeaders) {
                          if (this._opts.extraHeaders.hasOwnProperty(i)) {
                              xhr.setRequestHeader(i, this._opts.extraHeaders[i]);
                          }
                      }
                  }
              }
              catch (e) { }
              if ("POST" === this._method) {
                  try {
                      xhr.setRequestHeader("Content-type", "text/plain;charset=UTF-8");
                  }
                  catch (e) { }
              }
              try {
                  xhr.setRequestHeader("Accept", "*/*");
              }
              catch (e) { }
              (_a = this._opts.cookieJar) === null || _a === void 0 ? void 0 : _a.addCookies(xhr);
              // ie6 check
              if ("withCredentials" in xhr) {
                  xhr.withCredentials = this._opts.withCredentials;
              }
              if (this._opts.requestTimeout) {
                  xhr.timeout = this._opts.requestTimeout;
              }
              xhr.onreadystatechange = () => {
                  var _a;
                  if (xhr.readyState === 3) {
                      (_a = this._opts.cookieJar) === null || _a === void 0 ? void 0 : _a.parseCookies(
                      // @ts-ignore
                      xhr.getResponseHeader("set-cookie"));
                  }
                  if (4 !== xhr.readyState)
                      return;
                  if (200 === xhr.status || 1223 === xhr.status) {
                      this._onLoad();
                  }
                  else {
                      // make sure the `error` event handler that's user-set
                      // does not throw in the same tick and gets caught here
                      this.setTimeoutFn(() => {
                          this._onError(typeof xhr.status === "number" ? xhr.status : 0);
                      }, 0);
                  }
              };
              xhr.send(this._data);
          }
          catch (e) {
              // Need to defer since .create() is called directly from the constructor
              // and thus the 'error' event can only be only bound *after* this exception
              // occurs.  Therefore, also, we cannot throw here at all.
              this.setTimeoutFn(() => {
                  this._onError(e);
              }, 0);
              return;
          }
          if (typeof document !== "undefined") {
              this._index = Request.requestsCount++;
              Request.requests[this._index] = this;
          }
      }
      /**
       * Called upon error.
       *
       * @private
       */
      _onError(err) {
          this.emitReserved("error", err, this._xhr);
          this._cleanup(true);
      }
      /**
       * Cleans up house.
       *
       * @private
       */
      _cleanup(fromError) {
          if ("undefined" === typeof this._xhr || null === this._xhr) {
              return;
          }
          this._xhr.onreadystatechange = empty;
          if (fromError) {
              try {
                  this._xhr.abort();
              }
              catch (e) { }
          }
          if (typeof document !== "undefined") {
              delete Request.requests[this._index];
          }
          this._xhr = null;
      }
      /**
       * Called upon load.
       *
       * @private
       */
      _onLoad() {
          const data = this._xhr.responseText;
          if (data !== null) {
              this.emitReserved("data", data);
              this.emitReserved("success");
              this._cleanup();
          }
      }
      /**
       * Aborts the request.
       *
       * @package
       */
      abort() {
          this._cleanup();
      }
  }
  Request.requestsCount = 0;
  Request.requests = {};
  /**
   * Aborts pending requests when unloading the window. This is needed to prevent
   * memory leaks (e.g. when using IE) and to ensure that no spurious error is
   * emitted.
   */
  if (typeof document !== "undefined") {
      // @ts-ignore
      if (typeof attachEvent === "function") {
          // @ts-ignore
          attachEvent("onunload", unloadHandler);
      }
      else if (typeof addEventListener === "function") {
          const terminationEvent = "onpagehide" in globalThisShim ? "pagehide" : "unload";
          addEventListener(terminationEvent, unloadHandler, false);
      }
  }
  function unloadHandler() {
      for (let i in Request.requests) {
          if (Request.requests.hasOwnProperty(i)) {
              Request.requests[i].abort();
          }
      }
  }
  const hasXHR2 = (function () {
      const xhr = newRequest({
          xdomain: false,
      });
      return xhr && xhr.responseType !== null;
  })();
  /**
   * HTTP long-polling based on the built-in `XMLHttpRequest` object.
   *
   * Usage: browser
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
   */
  class XHR extends BaseXHR {
      constructor(opts) {
          super(opts);
          const forceBase64 = opts && opts.forceBase64;
          this.supportsBinary = hasXHR2 && !forceBase64;
      }
      request(opts = {}) {
          Object.assign(opts, { xd: this.xd }, this.opts);
          return new Request(newRequest, this.uri(), opts);
      }
  }
  function newRequest(opts) {
      const xdomain = opts.xdomain;
      // XMLHttpRequest can be disabled on IE
      try {
          if ("undefined" !== typeof XMLHttpRequest && (!xdomain || hasCORS)) {
              return new XMLHttpRequest();
          }
      }
      catch (e) { }
      if (!xdomain) {
          try {
              return new globalThisShim[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP");
          }
          catch (e) { }
      }
  }

  // detect ReactNative environment
  const isReactNative = typeof navigator !== "undefined" &&
      typeof navigator.product === "string" &&
      navigator.product.toLowerCase() === "reactnative";
  class BaseWS extends Transport {
      get name() {
          return "websocket";
      }
      doOpen() {
          const uri = this.uri();
          const protocols = this.opts.protocols;
          // React Native only supports the 'headers' option, and will print a warning if anything else is passed
          const opts = isReactNative
              ? {}
              : pick(this.opts, "agent", "perMessageDeflate", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "localAddress", "protocolVersion", "origin", "maxPayload", "family", "checkServerIdentity");
          if (this.opts.extraHeaders) {
              opts.headers = this.opts.extraHeaders;
          }
          try {
              this.ws = this.createSocket(uri, protocols, opts);
          }
          catch (err) {
              return this.emitReserved("error", err);
          }
          this.ws.binaryType = this.socket.binaryType;
          this.addEventListeners();
      }
      /**
       * Adds event listeners to the socket
       *
       * @private
       */
      addEventListeners() {
          this.ws.onopen = () => {
              if (this.opts.autoUnref) {
                  this.ws._socket.unref();
              }
              this.onOpen();
          };
          this.ws.onclose = (closeEvent) => this.onClose({
              description: "websocket connection closed",
              context: closeEvent,
          });
          this.ws.onmessage = (ev) => this.onData(ev.data);
          this.ws.onerror = (e) => this.onError("websocket error", e);
      }
      write(packets) {
          this.writable = false;
          // encodePacket efficient as it uses WS framing
          // no need for encodePayload
          for (let i = 0; i < packets.length; i++) {
              const packet = packets[i];
              const lastPacket = i === packets.length - 1;
              encodePacket(packet, this.supportsBinary, (data) => {
                  // Sometimes the websocket has already been closed but the browser didn't
                  // have a chance of informing us about it yet, in that case send will
                  // throw an error
                  try {
                      this.doWrite(packet, data);
                  }
                  catch (e) {
                  }
                  if (lastPacket) {
                      // fake drain
                      // defer to next tick to allow Socket to clear writeBuffer
                      nextTick(() => {
                          this.writable = true;
                          this.emitReserved("drain");
                      }, this.setTimeoutFn);
                  }
              });
          }
      }
      doClose() {
          if (typeof this.ws !== "undefined") {
              this.ws.onerror = () => { };
              this.ws.close();
              this.ws = null;
          }
      }
      /**
       * Generates uri for connection.
       *
       * @private
       */
      uri() {
          const schema = this.opts.secure ? "wss" : "ws";
          const query = this.query || {};
          // append timestamp to URI
          if (this.opts.timestampRequests) {
              query[this.opts.timestampParam] = randomString();
          }
          // communicate binary support capabilities
          if (!this.supportsBinary) {
              query.b64 = 1;
          }
          return this.createUri(schema, query);
      }
  }
  const WebSocketCtor = globalThisShim.WebSocket || globalThisShim.MozWebSocket;
  /**
   * WebSocket transport based on the built-in `WebSocket` object.
   *
   * Usage: browser, Node.js (since v21), Deno, Bun
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
   * @see https://caniuse.com/mdn-api_websocket
   * @see https://nodejs.org/api/globals.html#websocket
   */
  class WS extends BaseWS {
      createSocket(uri, protocols, opts) {
          return !isReactNative
              ? protocols
                  ? new WebSocketCtor(uri, protocols)
                  : new WebSocketCtor(uri)
              : new WebSocketCtor(uri, protocols, opts);
      }
      doWrite(_packet, data) {
          this.ws.send(data);
      }
  }

  /**
   * WebTransport transport based on the built-in `WebTransport` object.
   *
   * Usage: browser, Node.js (with the `@fails-components/webtransport` package)
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebTransport
   * @see https://caniuse.com/webtransport
   */
  class WT extends Transport {
      get name() {
          return "webtransport";
      }
      doOpen() {
          try {
              // @ts-ignore
              this._transport = new WebTransport(this.createUri("https"), this.opts.transportOptions[this.name]);
          }
          catch (err) {
              return this.emitReserved("error", err);
          }
          this._transport.closed
              .then(() => {
              this.onClose();
          })
              .catch((err) => {
              this.onError("webtransport error", err);
          });
          // note: we could have used async/await, but that would require some additional polyfills
          this._transport.ready.then(() => {
              this._transport.createBidirectionalStream().then((stream) => {
                  const decoderStream = createPacketDecoderStream(Number.MAX_SAFE_INTEGER, this.socket.binaryType);
                  const reader = stream.readable.pipeThrough(decoderStream).getReader();
                  const encoderStream = createPacketEncoderStream();
                  encoderStream.readable.pipeTo(stream.writable);
                  this._writer = encoderStream.writable.getWriter();
                  const read = () => {
                      reader
                          .read()
                          .then(({ done, value }) => {
                          if (done) {
                              return;
                          }
                          this.onPacket(value);
                          read();
                      })
                          .catch((err) => {
                      });
                  };
                  read();
                  const packet = { type: "open" };
                  if (this.query.sid) {
                      packet.data = `{"sid":"${this.query.sid}"}`;
                  }
                  this._writer.write(packet).then(() => this.onOpen());
              });
          });
      }
      write(packets) {
          this.writable = false;
          for (let i = 0; i < packets.length; i++) {
              const packet = packets[i];
              const lastPacket = i === packets.length - 1;
              this._writer.write(packet).then(() => {
                  if (lastPacket) {
                      nextTick(() => {
                          this.writable = true;
                          this.emitReserved("drain");
                      }, this.setTimeoutFn);
                  }
              });
          }
      }
      doClose() {
          var _a;
          (_a = this._transport) === null || _a === void 0 ? void 0 : _a.close();
      }
  }

  const transports = {
      websocket: WS,
      webtransport: WT,
      polling: XHR,
  };

  // imported from https://github.com/galkn/parseuri
  /**
   * Parses a URI
   *
   * Note: we could also have used the built-in URL object, but it isn't supported on all platforms.
   *
   * See:
   * - https://developer.mozilla.org/en-US/docs/Web/API/URL
   * - https://caniuse.com/url
   * - https://www.rfc-editor.org/rfc/rfc3986#appendix-B
   *
   * History of the parse() method:
   * - first commit: https://github.com/socketio/socket.io-client/commit/4ee1d5d94b3906a9c052b459f1a818b15f38f91c
   * - export into its own module: https://github.com/socketio/engine.io-client/commit/de2c561e4564efeb78f1bdb1ba39ef81b2822cb3
   * - reimport: https://github.com/socketio/engine.io-client/commit/df32277c3f6d622eec5ed09f493cae3f3391d242
   *
   * @author Steven Levithan <stevenlevithan.com> (MIT license)
   * @api private
   */
  const re = /^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;
  const parts = [
      'source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'
  ];
  function parse(str) {
      if (str.length > 8000) {
          throw "URI too long";
      }
      const src = str, b = str.indexOf('['), e = str.indexOf(']');
      if (b != -1 && e != -1) {
          str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ';') + str.substring(e, str.length);
      }
      let m = re.exec(str || ''), uri = {}, i = 14;
      while (i--) {
          uri[parts[i]] = m[i] || '';
      }
      if (b != -1 && e != -1) {
          uri.source = src;
          uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ':');
          uri.authority = uri.authority.replace('[', '').replace(']', '').replace(/;/g, ':');
          uri.ipv6uri = true;
      }
      uri.pathNames = pathNames(uri, uri['path']);
      uri.queryKey = queryKey(uri, uri['query']);
      return uri;
  }
  function pathNames(obj, path) {
      const regx = /\/{2,9}/g, names = path.replace(regx, "/").split("/");
      if (path.slice(0, 1) == '/' || path.length === 0) {
          names.splice(0, 1);
      }
      if (path.slice(-1) == '/') {
          names.splice(names.length - 1, 1);
      }
      return names;
  }
  function queryKey(uri, query) {
      const data = {};
      query.replace(/(?:^|&)([^&=]*)=?([^&]*)/g, function ($0, $1, $2) {
          if ($1) {
              data[$1] = $2;
          }
      });
      return data;
  }

  const withEventListeners = typeof addEventListener === "function" &&
      typeof removeEventListener === "function";
  const OFFLINE_EVENT_LISTENERS = [];
  if (withEventListeners) {
      // within a ServiceWorker, any event handler for the 'offline' event must be added on the initial evaluation of the
      // script, so we create one single event listener here which will forward the event to the socket instances
      addEventListener("offline", () => {
          OFFLINE_EVENT_LISTENERS.forEach((listener) => listener());
      }, false);
  }
  /**
   * This class provides a WebSocket-like interface to connect to an Engine.IO server. The connection will be established
   * with one of the available low-level transports, like HTTP long-polling, WebSocket or WebTransport.
   *
   * This class comes without upgrade mechanism, which means that it will keep the first low-level transport that
   * successfully establishes the connection.
   *
   * In order to allow tree-shaking, there are no transports included, that's why the `transports` option is mandatory.
   *
   * @example
   * import { SocketWithoutUpgrade, WebSocket } from "engine.io-client";
   *
   * const socket = new SocketWithoutUpgrade({
   *   transports: [WebSocket]
   * });
   *
   * socket.on("open", () => {
   *   socket.send("hello");
   * });
   *
   * @see SocketWithUpgrade
   * @see Socket
   */
  class SocketWithoutUpgrade extends Emitter$1 {
      /**
       * Socket constructor.
       *
       * @param {String|Object} uri - uri or options
       * @param {Object} opts - options
       */
      constructor(uri, opts) {
          super();
          this.binaryType = defaultBinaryType;
          this.writeBuffer = [];
          this._prevBufferLen = 0;
          this._pingInterval = -1;
          this._pingTimeout = -1;
          this._maxPayload = -1;
          /**
           * The expiration timestamp of the {@link _pingTimeoutTimer} object is tracked, in case the timer is throttled and the
           * callback is not fired on time. This can happen for example when a laptop is suspended or when a phone is locked.
           */
          this._pingTimeoutTime = Infinity;
          if (uri && "object" === typeof uri) {
              opts = uri;
              uri = null;
          }
          if (uri) {
              const parsedUri = parse(uri);
              opts.hostname = parsedUri.host;
              opts.secure =
                  parsedUri.protocol === "https" || parsedUri.protocol === "wss";
              opts.port = parsedUri.port;
              if (parsedUri.query)
                  opts.query = parsedUri.query;
          }
          else if (opts.host) {
              opts.hostname = parse(opts.host).host;
          }
          installTimerFunctions(this, opts);
          this.secure =
              null != opts.secure
                  ? opts.secure
                  : typeof location !== "undefined" && "https:" === location.protocol;
          if (opts.hostname && !opts.port) {
              // if no port is specified manually, use the protocol default
              opts.port = this.secure ? "443" : "80";
          }
          this.hostname =
              opts.hostname ||
                  (typeof location !== "undefined" ? location.hostname : "localhost");
          this.port =
              opts.port ||
                  (typeof location !== "undefined" && location.port
                      ? location.port
                      : this.secure
                          ? "443"
                          : "80");
          this.transports = [];
          this._transportsByName = {};
          opts.transports.forEach((t) => {
              const transportName = t.prototype.name;
              this.transports.push(transportName);
              this._transportsByName[transportName] = t;
          });
          this.opts = Object.assign({
              path: "/engine.io",
              agent: false,
              withCredentials: false,
              upgrade: true,
              timestampParam: "t",
              rememberUpgrade: false,
              addTrailingSlash: true,
              rejectUnauthorized: true,
              perMessageDeflate: {
                  threshold: 1024,
              },
              transportOptions: {},
              closeOnBeforeunload: false,
          }, opts);
          this.opts.path =
              this.opts.path.replace(/\/$/, "") +
                  (this.opts.addTrailingSlash ? "/" : "");
          if (typeof this.opts.query === "string") {
              this.opts.query = decode$1(this.opts.query);
          }
          if (withEventListeners) {
              if (this.opts.closeOnBeforeunload) {
                  // Firefox closes the connection when the "beforeunload" event is emitted but not Chrome. This event listener
                  // ensures every browser behaves the same (no "disconnect" event at the Socket.IO level when the page is
                  // closed/reloaded)
                  this._beforeunloadEventListener = () => {
                      if (this.transport) {
                          // silently close the transport
                          this.transport.removeAllListeners();
                          this.transport.close();
                      }
                  };
                  addEventListener("beforeunload", this._beforeunloadEventListener, false);
              }
              if (this.hostname !== "localhost") {
                  this._offlineEventListener = () => {
                      this._onClose("transport close", {
                          description: "network connection lost",
                      });
                  };
                  OFFLINE_EVENT_LISTENERS.push(this._offlineEventListener);
              }
          }
          if (this.opts.withCredentials) {
              this._cookieJar = createCookieJar();
          }
          this._open();
      }
      /**
       * Creates transport of the given type.
       *
       * @param {String} name - transport name
       * @return {Transport}
       * @private
       */
      createTransport(name) {
          const query = Object.assign({}, this.opts.query);
          // append engine.io protocol identifier
          query.EIO = protocol$1;
          // transport name
          query.transport = name;
          // session id if we already have one
          if (this.id)
              query.sid = this.id;
          const opts = Object.assign({}, this.opts, {
              query,
              socket: this,
              hostname: this.hostname,
              secure: this.secure,
              port: this.port,
          }, this.opts.transportOptions[name]);
          return new this._transportsByName[name](opts);
      }
      /**
       * Initializes transport to use and starts probe.
       *
       * @private
       */
      _open() {
          if (this.transports.length === 0) {
              // Emit error on next tick so it can be listened to
              this.setTimeoutFn(() => {
                  this.emitReserved("error", "No transports available");
              }, 0);
              return;
          }
          const transportName = this.opts.rememberUpgrade &&
              SocketWithoutUpgrade.priorWebsocketSuccess &&
              this.transports.indexOf("websocket") !== -1
              ? "websocket"
              : this.transports[0];
          this.readyState = "opening";
          const transport = this.createTransport(transportName);
          transport.open();
          this.setTransport(transport);
      }
      /**
       * Sets the current transport. Disables the existing one (if any).
       *
       * @private
       */
      setTransport(transport) {
          if (this.transport) {
              this.transport.removeAllListeners();
          }
          // set up transport
          this.transport = transport;
          // set up transport listeners
          transport
              .on("drain", this._onDrain.bind(this))
              .on("packet", this._onPacket.bind(this))
              .on("error", this._onError.bind(this))
              .on("close", (reason) => this._onClose("transport close", reason));
      }
      /**
       * Called when connection is deemed open.
       *
       * @private
       */
      onOpen() {
          this.readyState = "open";
          SocketWithoutUpgrade.priorWebsocketSuccess =
              "websocket" === this.transport.name;
          this.emitReserved("open");
          this.flush();
      }
      /**
       * Handles a packet.
       *
       * @private
       */
      _onPacket(packet) {
          if ("opening" === this.readyState ||
              "open" === this.readyState ||
              "closing" === this.readyState) {
              this.emitReserved("packet", packet);
              // Socket is live - any packet counts
              this.emitReserved("heartbeat");
              switch (packet.type) {
                  case "open":
                      this.onHandshake(JSON.parse(packet.data));
                      break;
                  case "ping":
                      this._sendPacket("pong");
                      this.emitReserved("ping");
                      this.emitReserved("pong");
                      this._resetPingTimeout();
                      break;
                  case "error":
                      const err = new Error("server error");
                      // @ts-ignore
                      err.code = packet.data;
                      this._onError(err);
                      break;
                  case "message":
                      this.emitReserved("data", packet.data);
                      this.emitReserved("message", packet.data);
                      break;
              }
          }
      }
      /**
       * Called upon handshake completion.
       *
       * @param {Object} data - handshake obj
       * @private
       */
      onHandshake(data) {
          this.emitReserved("handshake", data);
          this.id = data.sid;
          this.transport.query.sid = data.sid;
          this._pingInterval = data.pingInterval;
          this._pingTimeout = data.pingTimeout;
          this._maxPayload = data.maxPayload;
          this.onOpen();
          // In case open handler closes socket
          if ("closed" === this.readyState)
              return;
          this._resetPingTimeout();
      }
      /**
       * Sets and resets ping timeout timer based on server pings.
       *
       * @private
       */
      _resetPingTimeout() {
          this.clearTimeoutFn(this._pingTimeoutTimer);
          const delay = this._pingInterval + this._pingTimeout;
          this._pingTimeoutTime = Date.now() + delay;
          this._pingTimeoutTimer = this.setTimeoutFn(() => {
              this._onClose("ping timeout");
          }, delay);
          if (this.opts.autoUnref) {
              this._pingTimeoutTimer.unref();
          }
      }
      /**
       * Called on `drain` event
       *
       * @private
       */
      _onDrain() {
          this.writeBuffer.splice(0, this._prevBufferLen);
          // setting prevBufferLen = 0 is very important
          // for example, when upgrading, upgrade packet is sent over,
          // and a nonzero prevBufferLen could cause problems on `drain`
          this._prevBufferLen = 0;
          if (0 === this.writeBuffer.length) {
              this.emitReserved("drain");
          }
          else {
              this.flush();
          }
      }
      /**
       * Flush write buffers.
       *
       * @private
       */
      flush() {
          if ("closed" !== this.readyState &&
              this.transport.writable &&
              !this.upgrading &&
              this.writeBuffer.length) {
              const packets = this._getWritablePackets();
              this.transport.send(packets);
              // keep track of current length of writeBuffer
              // splice writeBuffer and callbackBuffer on `drain`
              this._prevBufferLen = packets.length;
              this.emitReserved("flush");
          }
      }
      /**
       * Ensure the encoded size of the writeBuffer is below the maxPayload value sent by the server (only for HTTP
       * long-polling)
       *
       * @private
       */
      _getWritablePackets() {
          const shouldCheckPayloadSize = this._maxPayload &&
              this.transport.name === "polling" &&
              this.writeBuffer.length > 1;
          if (!shouldCheckPayloadSize) {
              return this.writeBuffer;
          }
          let payloadSize = 1; // first packet type
          for (let i = 0; i < this.writeBuffer.length; i++) {
              const data = this.writeBuffer[i].data;
              if (data) {
                  payloadSize += byteLength(data);
              }
              if (i > 0 && payloadSize > this._maxPayload) {
                  return this.writeBuffer.slice(0, i);
              }
              payloadSize += 2; // separator + packet type
          }
          return this.writeBuffer;
      }
      /**
       * Checks whether the heartbeat timer has expired but the socket has not yet been notified.
       *
       * Note: this method is private for now because it does not really fit the WebSocket API, but if we put it in the
       * `write()` method then the message would not be buffered by the Socket.IO client.
       *
       * @return {boolean}
       * @private
       */
      /* private */ _hasPingExpired() {
          if (!this._pingTimeoutTime)
              return true;
          const hasExpired = Date.now() > this._pingTimeoutTime;
          if (hasExpired) {
              this._pingTimeoutTime = 0;
              nextTick(() => {
                  this._onClose("ping timeout");
              }, this.setTimeoutFn);
          }
          return hasExpired;
      }
      /**
       * Sends a message.
       *
       * @param {String} msg - message.
       * @param {Object} options.
       * @param {Function} fn - callback function.
       * @return {Socket} for chaining.
       */
      write(msg, options, fn) {
          this._sendPacket("message", msg, options, fn);
          return this;
      }
      /**
       * Sends a message. Alias of {@link Socket#write}.
       *
       * @param {String} msg - message.
       * @param {Object} options.
       * @param {Function} fn - callback function.
       * @return {Socket} for chaining.
       */
      send(msg, options, fn) {
          this._sendPacket("message", msg, options, fn);
          return this;
      }
      /**
       * Sends a packet.
       *
       * @param {String} type: packet type.
       * @param {String} data.
       * @param {Object} options.
       * @param {Function} fn - callback function.
       * @private
       */
      _sendPacket(type, data, options, fn) {
          if ("function" === typeof data) {
              fn = data;
              data = undefined;
          }
          if ("function" === typeof options) {
              fn = options;
              options = null;
          }
          if ("closing" === this.readyState || "closed" === this.readyState) {
              return;
          }
          options = options || {};
          options.compress = false !== options.compress;
          const packet = {
              type: type,
              data: data,
              options: options,
          };
          this.emitReserved("packetCreate", packet);
          this.writeBuffer.push(packet);
          if (fn)
              this.once("flush", fn);
          this.flush();
      }
      /**
       * Closes the connection.
       */
      close() {
          const close = () => {
              this._onClose("forced close");
              this.transport.close();
          };
          const cleanupAndClose = () => {
              this.off("upgrade", cleanupAndClose);
              this.off("upgradeError", cleanupAndClose);
              close();
          };
          const waitForUpgrade = () => {
              // wait for upgrade to finish since we can't send packets while pausing a transport
              this.once("upgrade", cleanupAndClose);
              this.once("upgradeError", cleanupAndClose);
          };
          if ("opening" === this.readyState || "open" === this.readyState) {
              this.readyState = "closing";
              if (this.writeBuffer.length) {
                  this.once("drain", () => {
                      if (this.upgrading) {
                          waitForUpgrade();
                      }
                      else {
                          close();
                      }
                  });
              }
              else if (this.upgrading) {
                  waitForUpgrade();
              }
              else {
                  close();
              }
          }
          return this;
      }
      /**
       * Called upon transport error
       *
       * @private
       */
      _onError(err) {
          SocketWithoutUpgrade.priorWebsocketSuccess = false;
          if (this.opts.tryAllTransports &&
              this.transports.length > 1 &&
              this.readyState === "opening") {
              this.transports.shift();
              return this._open();
          }
          this.emitReserved("error", err);
          this._onClose("transport error", err);
      }
      /**
       * Called upon transport close.
       *
       * @private
       */
      _onClose(reason, description) {
          if ("opening" === this.readyState ||
              "open" === this.readyState ||
              "closing" === this.readyState) {
              // clear timers
              this.clearTimeoutFn(this._pingTimeoutTimer);
              // stop event from firing again for transport
              this.transport.removeAllListeners("close");
              // ensure transport won't stay open
              this.transport.close();
              // ignore further transport communication
              this.transport.removeAllListeners();
              if (withEventListeners) {
                  if (this._beforeunloadEventListener) {
                      removeEventListener("beforeunload", this._beforeunloadEventListener, false);
                  }
                  if (this._offlineEventListener) {
                      const i = OFFLINE_EVENT_LISTENERS.indexOf(this._offlineEventListener);
                      if (i !== -1) {
                          OFFLINE_EVENT_LISTENERS.splice(i, 1);
                      }
                  }
              }
              // set ready state
              this.readyState = "closed";
              // clear session id
              this.id = null;
              // emit close event
              this.emitReserved("close", reason, description);
              // clean buffers after, so users can still
              // grab the buffers on `close` event
              this.writeBuffer = [];
              this._prevBufferLen = 0;
          }
      }
  }
  SocketWithoutUpgrade.protocol = protocol$1;
  /**
   * This class provides a WebSocket-like interface to connect to an Engine.IO server. The connection will be established
   * with one of the available low-level transports, like HTTP long-polling, WebSocket or WebTransport.
   *
   * This class comes with an upgrade mechanism, which means that once the connection is established with the first
   * low-level transport, it will try to upgrade to a better transport.
   *
   * In order to allow tree-shaking, there are no transports included, that's why the `transports` option is mandatory.
   *
   * @example
   * import { SocketWithUpgrade, WebSocket } from "engine.io-client";
   *
   * const socket = new SocketWithUpgrade({
   *   transports: [WebSocket]
   * });
   *
   * socket.on("open", () => {
   *   socket.send("hello");
   * });
   *
   * @see SocketWithoutUpgrade
   * @see Socket
   */
  class SocketWithUpgrade extends SocketWithoutUpgrade {
      constructor() {
          super(...arguments);
          this._upgrades = [];
      }
      onOpen() {
          super.onOpen();
          if ("open" === this.readyState && this.opts.upgrade) {
              for (let i = 0; i < this._upgrades.length; i++) {
                  this._probe(this._upgrades[i]);
              }
          }
      }
      /**
       * Probes a transport.
       *
       * @param {String} name - transport name
       * @private
       */
      _probe(name) {
          let transport = this.createTransport(name);
          let failed = false;
          SocketWithoutUpgrade.priorWebsocketSuccess = false;
          const onTransportOpen = () => {
              if (failed)
                  return;
              transport.send([{ type: "ping", data: "probe" }]);
              transport.once("packet", (msg) => {
                  if (failed)
                      return;
                  if ("pong" === msg.type && "probe" === msg.data) {
                      this.upgrading = true;
                      this.emitReserved("upgrading", transport);
                      if (!transport)
                          return;
                      SocketWithoutUpgrade.priorWebsocketSuccess =
                          "websocket" === transport.name;
                      this.transport.pause(() => {
                          if (failed)
                              return;
                          if ("closed" === this.readyState)
                              return;
                          cleanup();
                          this.setTransport(transport);
                          transport.send([{ type: "upgrade" }]);
                          this.emitReserved("upgrade", transport);
                          transport = null;
                          this.upgrading = false;
                          this.flush();
                      });
                  }
                  else {
                      const err = new Error("probe error");
                      // @ts-ignore
                      err.transport = transport.name;
                      this.emitReserved("upgradeError", err);
                  }
              });
          };
          function freezeTransport() {
              if (failed)
                  return;
              // Any callback called by transport should be ignored since now
              failed = true;
              cleanup();
              transport.close();
              transport = null;
          }
          // Handle any error that happens while probing
          const onerror = (err) => {
              const error = new Error("probe error: " + err);
              // @ts-ignore
              error.transport = transport.name;
              freezeTransport();
              this.emitReserved("upgradeError", error);
          };
          function onTransportClose() {
              onerror("transport closed");
          }
          // When the socket is closed while we're probing
          function onclose() {
              onerror("socket closed");
          }
          // When the socket is upgraded while we're probing
          function onupgrade(to) {
              if (transport && to.name !== transport.name) {
                  freezeTransport();
              }
          }
          // Remove all listeners on the transport and on self
          const cleanup = () => {
              transport.removeListener("open", onTransportOpen);
              transport.removeListener("error", onerror);
              transport.removeListener("close", onTransportClose);
              this.off("close", onclose);
              this.off("upgrading", onupgrade);
          };
          transport.once("open", onTransportOpen);
          transport.once("error", onerror);
          transport.once("close", onTransportClose);
          this.once("close", onclose);
          this.once("upgrading", onupgrade);
          if (this._upgrades.indexOf("webtransport") !== -1 &&
              name !== "webtransport") {
              // favor WebTransport
              this.setTimeoutFn(() => {
                  if (!failed) {
                      transport.open();
                  }
              }, 200);
          }
          else {
              transport.open();
          }
      }
      onHandshake(data) {
          this._upgrades = this._filterUpgrades(data.upgrades);
          super.onHandshake(data);
      }
      /**
       * Filters upgrades, returning only those matching client transports.
       *
       * @param {Array} upgrades - server upgrades
       * @private
       */
      _filterUpgrades(upgrades) {
          const filteredUpgrades = [];
          for (let i = 0; i < upgrades.length; i++) {
              if (~this.transports.indexOf(upgrades[i]))
                  filteredUpgrades.push(upgrades[i]);
          }
          return filteredUpgrades;
      }
  }
  /**
   * This class provides a WebSocket-like interface to connect to an Engine.IO server. The connection will be established
   * with one of the available low-level transports, like HTTP long-polling, WebSocket or WebTransport.
   *
   * This class comes with an upgrade mechanism, which means that once the connection is established with the first
   * low-level transport, it will try to upgrade to a better transport.
   *
   * @example
   * import { Socket } from "engine.io-client";
   *
   * const socket = new Socket();
   *
   * socket.on("open", () => {
   *   socket.send("hello");
   * });
   *
   * @see SocketWithoutUpgrade
   * @see SocketWithUpgrade
   */
  let Socket$1 = class Socket extends SocketWithUpgrade {
      constructor(uri, opts = {}) {
          const o = typeof uri === "object" ? uri : opts;
          if (!o.transports ||
              (o.transports && typeof o.transports[0] === "string")) {
              o.transports = (o.transports || ["polling", "websocket", "webtransport"])
                  .map((transportName) => transports[transportName])
                  .filter((t) => !!t);
          }
          super(uri, o);
      }
  };

  /**
   * URL parser.
   *
   * @param uri - url
   * @param path - the request path of the connection
   * @param loc - An object meant to mimic window.location.
   *        Defaults to window.location.
   * @public
   */
  function url(uri, path = "", loc) {
      let obj = uri;
      // default to window.location
      loc = loc || (typeof location !== "undefined" && location);
      if (null == uri)
          uri = loc.protocol + "//" + loc.host;
      // relative path support
      if (typeof uri === "string") {
          if ("/" === uri.charAt(0)) {
              if ("/" === uri.charAt(1)) {
                  uri = loc.protocol + uri;
              }
              else {
                  uri = loc.host + uri;
              }
          }
          if (!/^(https?|wss?):\/\//.test(uri)) {
              if ("undefined" !== typeof loc) {
                  uri = loc.protocol + "//" + uri;
              }
              else {
                  uri = "https://" + uri;
              }
          }
          // parse
          obj = parse(uri);
      }
      // make sure we treat `localhost:80` and `localhost` equally
      if (!obj.port) {
          if (/^(http|ws)$/.test(obj.protocol)) {
              obj.port = "80";
          }
          else if (/^(http|ws)s$/.test(obj.protocol)) {
              obj.port = "443";
          }
      }
      obj.path = obj.path || "/";
      const ipv6 = obj.host.indexOf(":") !== -1;
      const host = ipv6 ? "[" + obj.host + "]" : obj.host;
      // define unique id
      obj.id = obj.protocol + "://" + host + ":" + obj.port + path;
      // define href
      obj.href =
          obj.protocol +
              "://" +
              host +
              (loc && loc.port === obj.port ? "" : ":" + obj.port);
      return obj;
  }

  const withNativeArrayBuffer = typeof ArrayBuffer === "function";
  const isView = (obj) => {
      return typeof ArrayBuffer.isView === "function"
          ? ArrayBuffer.isView(obj)
          : obj.buffer instanceof ArrayBuffer;
  };
  const toString = Object.prototype.toString;
  const withNativeBlob = typeof Blob === "function" ||
      (typeof Blob !== "undefined" &&
          toString.call(Blob) === "[object BlobConstructor]");
  const withNativeFile = typeof File === "function" ||
      (typeof File !== "undefined" &&
          toString.call(File) === "[object FileConstructor]");
  /**
   * Returns true if obj is a Buffer, an ArrayBuffer, a Blob or a File.
   *
   * @private
   */
  function isBinary(obj) {
      return ((withNativeArrayBuffer && (obj instanceof ArrayBuffer || isView(obj))) ||
          (withNativeBlob && obj instanceof Blob) ||
          (withNativeFile && obj instanceof File));
  }
  function hasBinary(obj, toJSON) {
      if (!obj || typeof obj !== "object") {
          return false;
      }
      if (Array.isArray(obj)) {
          for (let i = 0, l = obj.length; i < l; i++) {
              if (hasBinary(obj[i])) {
                  return true;
              }
          }
          return false;
      }
      if (isBinary(obj)) {
          return true;
      }
      if (obj.toJSON &&
          typeof obj.toJSON === "function" &&
          arguments.length === 1) {
          return hasBinary(obj.toJSON(), true);
      }
      for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key) && hasBinary(obj[key])) {
              return true;
          }
      }
      return false;
  }

  /**
   * Replaces every Buffer | ArrayBuffer | Blob | File in packet with a numbered placeholder.
   *
   * @param {Object} packet - socket.io event packet
   * @return {Object} with deconstructed packet and list of buffers
   * @public
   */
  function deconstructPacket(packet) {
      const buffers = [];
      const packetData = packet.data;
      const pack = packet;
      pack.data = _deconstructPacket(packetData, buffers);
      pack.attachments = buffers.length; // number of binary 'attachments'
      return { packet: pack, buffers: buffers };
  }
  function _deconstructPacket(data, buffers) {
      if (!data)
          return data;
      if (isBinary(data)) {
          const placeholder = { _placeholder: true, num: buffers.length };
          buffers.push(data);
          return placeholder;
      }
      else if (Array.isArray(data)) {
          const newData = new Array(data.length);
          for (let i = 0; i < data.length; i++) {
              newData[i] = _deconstructPacket(data[i], buffers);
          }
          return newData;
      }
      else if (typeof data === "object" && !(data instanceof Date)) {
          const newData = {};
          for (const key in data) {
              if (Object.prototype.hasOwnProperty.call(data, key)) {
                  newData[key] = _deconstructPacket(data[key], buffers);
              }
          }
          return newData;
      }
      return data;
  }
  /**
   * Reconstructs a binary packet from its placeholder packet and buffers
   *
   * @param {Object} packet - event packet with placeholders
   * @param {Array} buffers - binary buffers to put in placeholder positions
   * @return {Object} reconstructed packet
   * @public
   */
  function reconstructPacket(packet, buffers) {
      packet.data = _reconstructPacket(packet.data, buffers);
      delete packet.attachments; // no longer useful
      return packet;
  }
  function _reconstructPacket(data, buffers) {
      if (!data)
          return data;
      if (data && data._placeholder === true) {
          const isIndexValid = typeof data.num === "number" &&
              data.num >= 0 &&
              data.num < buffers.length;
          if (isIndexValid) {
              return buffers[data.num]; // appropriate buffer (should be natural order anyway)
          }
          else {
              throw new Error("illegal attachments");
          }
      }
      else if (Array.isArray(data)) {
          for (let i = 0; i < data.length; i++) {
              data[i] = _reconstructPacket(data[i], buffers);
          }
      }
      else if (typeof data === "object") {
          for (const key in data) {
              if (Object.prototype.hasOwnProperty.call(data, key)) {
                  data[key] = _reconstructPacket(data[key], buffers);
              }
          }
      }
      return data;
  }

  /**
   * These strings must not be used as event names, as they have a special meaning.
   */
  const RESERVED_EVENTS$1 = [
      "connect", // used on the client side
      "connect_error", // used on the client side
      "disconnect", // used on both sides
      "disconnecting", // used on the server side
      "newListener", // used by the Node.js EventEmitter
      "removeListener", // used by the Node.js EventEmitter
  ];
  var PacketType$1;
  (function (PacketType) {
      PacketType[PacketType["CONNECT"] = 0] = "CONNECT";
      PacketType[PacketType["DISCONNECT"] = 1] = "DISCONNECT";
      PacketType[PacketType["EVENT"] = 2] = "EVENT";
      PacketType[PacketType["ACK"] = 3] = "ACK";
      PacketType[PacketType["CONNECT_ERROR"] = 4] = "CONNECT_ERROR";
      PacketType[PacketType["BINARY_EVENT"] = 5] = "BINARY_EVENT";
      PacketType[PacketType["BINARY_ACK"] = 6] = "BINARY_ACK";
  })(PacketType$1 || (PacketType$1 = {}));
  /**
   * A socket.io Encoder instance
   */
  let Encoder$1 = class Encoder {
      /**
       * Encoder constructor
       *
       * @param {function} replacer - custom replacer to pass down to JSON.parse
       */
      constructor(replacer) {
          this.replacer = replacer;
      }
      /**
       * Encode a packet as a single string if non-binary, or as a
       * buffer sequence, depending on packet type.
       *
       * @param {Object} obj - packet object
       */
      encode(obj) {
          if (obj.type === PacketType$1.EVENT || obj.type === PacketType$1.ACK) {
              if (hasBinary(obj)) {
                  return this.encodeAsBinary({
                      type: obj.type === PacketType$1.EVENT
                          ? PacketType$1.BINARY_EVENT
                          : PacketType$1.BINARY_ACK,
                      nsp: obj.nsp,
                      data: obj.data,
                      id: obj.id,
                  });
              }
          }
          return [this.encodeAsString(obj)];
      }
      /**
       * Encode packet as string.
       */
      encodeAsString(obj) {
          // first is type
          let str = "" + obj.type;
          // attachments if we have them
          if (obj.type === PacketType$1.BINARY_EVENT ||
              obj.type === PacketType$1.BINARY_ACK) {
              str += obj.attachments + "-";
          }
          // if we have a namespace other than `/`
          // we append it followed by a comma `,`
          if (obj.nsp && "/" !== obj.nsp) {
              str += obj.nsp + ",";
          }
          // immediately followed by the id
          if (null != obj.id) {
              str += obj.id;
          }
          // json data
          if (null != obj.data) {
              str += JSON.stringify(obj.data, this.replacer);
          }
          return str;
      }
      /**
       * Encode packet as 'buffer sequence' by removing blobs, and
       * deconstructing packet into object with placeholders and
       * a list of buffers.
       */
      encodeAsBinary(obj) {
          const deconstruction = deconstructPacket(obj);
          const pack = this.encodeAsString(deconstruction.packet);
          const buffers = deconstruction.buffers;
          buffers.unshift(pack); // add packet info to beginning of data list
          return buffers; // write all the buffers
      }
  };
  /**
   * A socket.io Decoder instance
   *
   * @return {Object} decoder
   */
  let Decoder$2 = class Decoder extends Emitter$1 {
      /**
       * Decoder constructor
       */
      constructor(opts) {
          super();
          this.opts = Object.assign({
              reviver: undefined,
              maxAttachments: 10,
          }, typeof opts === "function" ? { reviver: opts } : opts);
      }
      /**
       * Decodes an encoded packet string into packet JSON.
       *
       * @param {String} obj - encoded packet
       */
      add(obj) {
          let packet;
          if (typeof obj === "string") {
              if (this.reconstructor) {
                  throw new Error("got plaintext data when reconstructing a packet");
              }
              packet = this.decodeString(obj);
              const isBinaryEvent = packet.type === PacketType$1.BINARY_EVENT;
              if (isBinaryEvent || packet.type === PacketType$1.BINARY_ACK) {
                  packet.type = isBinaryEvent ? PacketType$1.EVENT : PacketType$1.ACK;
                  // binary packet's json
                  this.reconstructor = new BinaryReconstructor(packet);
                  // no attachments, labeled binary but no binary data to follow
                  if (packet.attachments === 0) {
                      super.emitReserved("decoded", packet);
                  }
              }
              else {
                  // non-binary full packet
                  super.emitReserved("decoded", packet);
              }
          }
          else if (isBinary(obj) || obj.base64) {
              // raw binary data
              if (!this.reconstructor) {
                  throw new Error("got binary data when not reconstructing a packet");
              }
              else {
                  packet = this.reconstructor.takeBinaryData(obj);
                  if (packet) {
                      // received final buffer
                      this.reconstructor = null;
                      super.emitReserved("decoded", packet);
                  }
              }
          }
          else {
              throw new Error("Unknown type: " + obj);
          }
      }
      /**
       * Decode a packet String (JSON data)
       *
       * @param {String} str
       * @return {Object} packet
       */
      decodeString(str) {
          let i = 0;
          // look up type
          const p = {
              type: Number(str.charAt(0)),
          };
          if (PacketType$1[p.type] === undefined) {
              throw new Error("unknown packet type " + p.type);
          }
          // look up attachments if type binary
          if (p.type === PacketType$1.BINARY_EVENT ||
              p.type === PacketType$1.BINARY_ACK) {
              const start = i + 1;
              while (str.charAt(++i) !== "-" && i != str.length) { }
              const buf = str.substring(start, i);
              if (buf != Number(buf) || str.charAt(i) !== "-") {
                  throw new Error("Illegal attachments");
              }
              const n = Number(buf);
              if (!isInteger$1(n) || n < 0) {
                  throw new Error("Illegal attachments");
              }
              else if (n > this.opts.maxAttachments) {
                  throw new Error("too many attachments");
              }
              p.attachments = n;
          }
          // look up namespace (if any)
          if ("/" === str.charAt(i + 1)) {
              const start = i + 1;
              while (++i) {
                  const c = str.charAt(i);
                  if ("," === c)
                      break;
                  if (i === str.length)
                      break;
              }
              p.nsp = str.substring(start, i);
          }
          else {
              p.nsp = "/";
          }
          // look up id
          const next = str.charAt(i + 1);
          if ("" !== next && Number(next) == next) {
              const start = i + 1;
              while (++i) {
                  const c = str.charAt(i);
                  if (null == c || Number(c) != c) {
                      --i;
                      break;
                  }
                  if (i === str.length)
                      break;
              }
              p.id = Number(str.substring(start, i + 1));
          }
          // look up json data
          if (str.charAt(++i)) {
              const payload = this.tryParse(str.substr(i));
              if (Decoder.isPayloadValid(p.type, payload)) {
                  p.data = payload;
              }
              else {
                  throw new Error("invalid payload");
              }
          }
          return p;
      }
      tryParse(str) {
          try {
              return JSON.parse(str, this.opts.reviver);
          }
          catch (e) {
              return false;
          }
      }
      static isPayloadValid(type, payload) {
          switch (type) {
              case PacketType$1.CONNECT:
                  return isObject$1(payload);
              case PacketType$1.DISCONNECT:
                  return payload === undefined;
              case PacketType$1.CONNECT_ERROR:
                  return typeof payload === "string" || isObject$1(payload);
              case PacketType$1.EVENT:
              case PacketType$1.BINARY_EVENT:
                  return (Array.isArray(payload) &&
                      (typeof payload[0] === "number" ||
                          (typeof payload[0] === "string" &&
                              RESERVED_EVENTS$1.indexOf(payload[0]) === -1)));
              case PacketType$1.ACK:
              case PacketType$1.BINARY_ACK:
                  return Array.isArray(payload);
          }
      }
      /**
       * Deallocates a parser's resources
       */
      destroy() {
          if (this.reconstructor) {
              this.reconstructor.finishedReconstruction();
              this.reconstructor = null;
          }
      }
  };
  /**
   * A manager of a binary event's 'buffer sequence'. Should
   * be constructed whenever a packet of type BINARY_EVENT is
   * decoded.
   *
   * @param {Object} packet
   * @return {BinaryReconstructor} initialized reconstructor
   */
  class BinaryReconstructor {
      constructor(packet) {
          this.packet = packet;
          this.buffers = [];
          this.reconPack = packet;
      }
      /**
       * Method to be called when binary data received from connection
       * after a BINARY_EVENT packet.
       *
       * @param {Buffer | ArrayBuffer} binData - the raw binary data received
       * @return {null | Object} returns null if more binary data is expected or
       *   a reconstructed packet object if all buffers have been received.
       */
      takeBinaryData(binData) {
          this.buffers.push(binData);
          if (this.buffers.length === this.reconPack.attachments) {
              // done with buffer list
              const packet = reconstructPacket(this.reconPack, this.buffers);
              this.finishedReconstruction();
              return packet;
          }
          return null;
      }
      /**
       * Cleans up binary packet reconstruction variables.
       */
      finishedReconstruction() {
          this.reconPack = null;
          this.buffers = [];
      }
  }
  // see https://caniuse.com/mdn-javascript_builtins_number_isinteger
  const isInteger$1 = Number.isInteger ||
      function (value) {
          return (typeof value === "number" &&
              isFinite(value) &&
              Math.floor(value) === value);
      };
  // see https://stackoverflow.com/questions/8511281/check-if-a-value-is-an-object-in-javascript
  function isObject$1(value) {
      return Object.prototype.toString.call(value) === "[object Object]";
  }

  var parser = /*#__PURE__*/Object.freeze({
    __proto__: null,
    Decoder: Decoder$2,
    Encoder: Encoder$1,
    get PacketType () { return PacketType$1; }
  });

  function on$1(obj, ev, fn) {
      obj.on(ev, fn);
      return function subDestroy() {
          obj.off(ev, fn);
      };
  }

  /**
   * Internal events.
   * These events can't be emitted by the user.
   */
  const RESERVED_EVENTS = Object.freeze({
      connect: 1,
      connect_error: 1,
      disconnect: 1,
      disconnecting: 1,
      // EventEmitter reserved events: https://nodejs.org/api/events.html#events_event_newlistener
      newListener: 1,
      removeListener: 1,
  });
  /**
   * A Socket is the fundamental class for interacting with the server.
   *
   * A Socket belongs to a certain Namespace (by default /) and uses an underlying {@link Manager} to communicate.
   *
   * @example
   * const socket = io();
   *
   * socket.on("connect", () => {
   *   console.log("connected");
   * });
   *
   * // send an event to the server
   * socket.emit("foo", "bar");
   *
   * socket.on("foobar", () => {
   *   // an event was received from the server
   * });
   *
   * // upon disconnection
   * socket.on("disconnect", (reason) => {
   *   console.log(`disconnected due to ${reason}`);
   * });
   */
  class Socket extends Emitter$1 {
      /**
       * `Socket` constructor.
       */
      constructor(io, nsp, opts) {
          super();
          /**
           * Whether the socket is currently connected to the server.
           *
           * @example
           * const socket = io();
           *
           * socket.on("connect", () => {
           *   console.log(socket.connected); // true
           * });
           *
           * socket.on("disconnect", () => {
           *   console.log(socket.connected); // false
           * });
           */
          this.connected = false;
          /**
           * Whether the connection state was recovered after a temporary disconnection. In that case, any missed packets will
           * be transmitted by the server.
           */
          this.recovered = false;
          /**
           * Buffer for packets received before the CONNECT packet
           */
          this.receiveBuffer = [];
          /**
           * Buffer for packets that will be sent once the socket is connected
           */
          this.sendBuffer = [];
          /**
           * The queue of packets to be sent with retry in case of failure.
           *
           * Packets are sent one by one, each waiting for the server acknowledgement, in order to guarantee the delivery order.
           * @private
           */
          this._queue = [];
          /**
           * A sequence to generate the ID of the {@link QueuedPacket}.
           * @private
           */
          this._queueSeq = 0;
          this.ids = 0;
          /**
           * A map containing acknowledgement handlers.
           *
           * The `withError` attribute is used to differentiate handlers that accept an error as first argument:
           *
           * - `socket.emit("test", (err, value) => { ... })` with `ackTimeout` option
           * - `socket.timeout(5000).emit("test", (err, value) => { ... })`
           * - `const value = await socket.emitWithAck("test")`
           *
           * From those that don't:
           *
           * - `socket.emit("test", (value) => { ... });`
           *
           * In the first case, the handlers will be called with an error when:
           *
           * - the timeout is reached
           * - the socket gets disconnected
           *
           * In the second case, the handlers will be simply discarded upon disconnection, since the client will never receive
           * an acknowledgement from the server.
           *
           * @private
           */
          this.acks = {};
          this.flags = {};
          this.io = io;
          this.nsp = nsp;
          if (opts && opts.auth) {
              this.auth = opts.auth;
          }
          this._opts = Object.assign({}, opts);
          if (this.io._autoConnect)
              this.open();
      }
      /**
       * Whether the socket is currently disconnected
       *
       * @example
       * const socket = io();
       *
       * socket.on("connect", () => {
       *   console.log(socket.disconnected); // false
       * });
       *
       * socket.on("disconnect", () => {
       *   console.log(socket.disconnected); // true
       * });
       */
      get disconnected() {
          return !this.connected;
      }
      /**
       * Subscribe to open, close and packet events
       *
       * @private
       */
      subEvents() {
          if (this.subs)
              return;
          const io = this.io;
          this.subs = [
              on$1(io, "open", this.onopen.bind(this)),
              on$1(io, "packet", this.onpacket.bind(this)),
              on$1(io, "error", this.onerror.bind(this)),
              on$1(io, "close", this.onclose.bind(this)),
          ];
      }
      /**
       * Whether the Socket will try to reconnect when its Manager connects or reconnects.
       *
       * @example
       * const socket = io();
       *
       * console.log(socket.active); // true
       *
       * socket.on("disconnect", (reason) => {
       *   if (reason === "io server disconnect") {
       *     // the disconnection was initiated by the server, you need to manually reconnect
       *     console.log(socket.active); // false
       *   }
       *   // else the socket will automatically try to reconnect
       *   console.log(socket.active); // true
       * });
       */
      get active() {
          return !!this.subs;
      }
      /**
       * "Opens" the socket.
       *
       * @example
       * const socket = io({
       *   autoConnect: false
       * });
       *
       * socket.connect();
       */
      connect() {
          if (this.connected)
              return this;
          this.subEvents();
          if (!this.io["_reconnecting"])
              this.io.open(); // ensure open
          if ("open" === this.io._readyState)
              this.onopen();
          return this;
      }
      /**
       * Alias for {@link connect()}.
       */
      open() {
          return this.connect();
      }
      /**
       * Sends a `message` event.
       *
       * This method mimics the WebSocket.send() method.
       *
       * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send
       *
       * @example
       * socket.send("hello");
       *
       * // this is equivalent to
       * socket.emit("message", "hello");
       *
       * @return self
       */
      send(...args) {
          args.unshift("message");
          this.emit.apply(this, args);
          return this;
      }
      /**
       * Override `emit`.
       * If the event is in `events`, it's emitted normally.
       *
       * @example
       * socket.emit("hello", "world");
       *
       * // all serializable datastructures are supported (no need to call JSON.stringify)
       * socket.emit("hello", 1, "2", { 3: ["4"], 5: Uint8Array.from([6]) });
       *
       * // with an acknowledgement from the server
       * socket.emit("hello", "world", (val) => {
       *   // ...
       * });
       *
       * @return self
       */
      emit(ev, ...args) {
          var _a, _b, _c;
          if (RESERVED_EVENTS.hasOwnProperty(ev)) {
              throw new Error('"' + ev.toString() + '" is a reserved event name');
          }
          args.unshift(ev);
          if (this._opts.retries && !this.flags.fromQueue && !this.flags.volatile) {
              this._addToQueue(args);
              return this;
          }
          const packet = {
              type: PacketType$1.EVENT,
              data: args,
          };
          packet.options = {};
          packet.options.compress = this.flags.compress !== false;
          // event ack callback
          if ("function" === typeof args[args.length - 1]) {
              const id = this.ids++;
              const ack = args.pop();
              this._registerAckCallback(id, ack);
              packet.id = id;
          }
          const isTransportWritable = (_b = (_a = this.io.engine) === null || _a === void 0 ? void 0 : _a.transport) === null || _b === void 0 ? void 0 : _b.writable;
          const isConnected = this.connected && !((_c = this.io.engine) === null || _c === void 0 ? void 0 : _c._hasPingExpired());
          const discardPacket = this.flags.volatile && !isTransportWritable;
          if (discardPacket) ;
          else if (isConnected) {
              this.notifyOutgoingListeners(packet);
              this.packet(packet);
          }
          else {
              this.sendBuffer.push(packet);
          }
          this.flags = {};
          return this;
      }
      /**
       * @private
       */
      _registerAckCallback(id, ack) {
          var _a;
          const timeout = (_a = this.flags.timeout) !== null && _a !== void 0 ? _a : this._opts.ackTimeout;
          if (timeout === undefined) {
              this.acks[id] = ack;
              return;
          }
          // @ts-ignore
          const timer = this.io.setTimeoutFn(() => {
              delete this.acks[id];
              for (let i = 0; i < this.sendBuffer.length; i++) {
                  if (this.sendBuffer[i].id === id) {
                      this.sendBuffer.splice(i, 1);
                  }
              }
              ack.call(this, new Error("operation has timed out"));
          }, timeout);
          const fn = (...args) => {
              // @ts-ignore
              this.io.clearTimeoutFn(timer);
              ack.apply(this, args);
          };
          fn.withError = true;
          this.acks[id] = fn;
      }
      /**
       * Emits an event and waits for an acknowledgement
       *
       * @example
       * // without timeout
       * const response = await socket.emitWithAck("hello", "world");
       *
       * // with a specific timeout
       * try {
       *   const response = await socket.timeout(1000).emitWithAck("hello", "world");
       * } catch (err) {
       *   // the server did not acknowledge the event in the given delay
       * }
       *
       * @return a Promise that will be fulfilled when the server acknowledges the event
       */
      emitWithAck(ev, ...args) {
          return new Promise((resolve, reject) => {
              const fn = (arg1, arg2) => {
                  return arg1 ? reject(arg1) : resolve(arg2);
              };
              fn.withError = true;
              args.push(fn);
              this.emit(ev, ...args);
          });
      }
      /**
       * Add the packet to the queue.
       * @param args
       * @private
       */
      _addToQueue(args) {
          let ack;
          if (typeof args[args.length - 1] === "function") {
              ack = args.pop();
          }
          const packet = {
              id: this._queueSeq++,
              tryCount: 0,
              pending: false,
              args,
              flags: Object.assign({ fromQueue: true }, this.flags),
          };
          args.push((err, ...responseArgs) => {
              if (packet !== this._queue[0]) ;
              const hasError = err !== null;
              if (hasError) {
                  if (packet.tryCount > this._opts.retries) {
                      this._queue.shift();
                      if (ack) {
                          ack(err);
                      }
                  }
              }
              else {
                  this._queue.shift();
                  if (ack) {
                      ack(null, ...responseArgs);
                  }
              }
              packet.pending = false;
              return this._drainQueue();
          });
          this._queue.push(packet);
          this._drainQueue();
      }
      /**
       * Send the first packet of the queue, and wait for an acknowledgement from the server.
       * @param force - whether to resend a packet that has not been acknowledged yet
       *
       * @private
       */
      _drainQueue(force = false) {
          if (!this.connected || this._queue.length === 0) {
              return;
          }
          const packet = this._queue[0];
          if (packet.pending && !force) {
              return;
          }
          packet.pending = true;
          packet.tryCount++;
          this.flags = packet.flags;
          this.emit.apply(this, packet.args);
      }
      /**
       * Sends a packet.
       *
       * @param packet
       * @private
       */
      packet(packet) {
          packet.nsp = this.nsp;
          this.io._packet(packet);
      }
      /**
       * Called upon engine `open`.
       *
       * @private
       */
      onopen() {
          if (typeof this.auth == "function") {
              this.auth((data) => {
                  this._sendConnectPacket(data);
              });
          }
          else {
              this._sendConnectPacket(this.auth);
          }
      }
      /**
       * Sends a CONNECT packet to initiate the Socket.IO session.
       *
       * @param data
       * @private
       */
      _sendConnectPacket(data) {
          this.packet({
              type: PacketType$1.CONNECT,
              data: this._pid
                  ? Object.assign({ pid: this._pid, offset: this._lastOffset }, data)
                  : data,
          });
      }
      /**
       * Called upon engine or manager `error`.
       *
       * @param err
       * @private
       */
      onerror(err) {
          if (!this.connected) {
              this.emitReserved("connect_error", err);
          }
      }
      /**
       * Called upon engine `close`.
       *
       * @param reason
       * @param description
       * @private
       */
      onclose(reason, description) {
          this.connected = false;
          delete this.id;
          this.emitReserved("disconnect", reason, description);
          this._clearAcks();
      }
      /**
       * Clears the acknowledgement handlers upon disconnection, since the client will never receive an acknowledgement from
       * the server.
       *
       * @private
       */
      _clearAcks() {
          Object.keys(this.acks).forEach((id) => {
              const isBuffered = this.sendBuffer.some((packet) => String(packet.id) === id);
              if (!isBuffered) {
                  // note: handlers that do not accept an error as first argument are ignored here
                  const ack = this.acks[id];
                  delete this.acks[id];
                  if (ack.withError) {
                      ack.call(this, new Error("socket has been disconnected"));
                  }
              }
          });
      }
      /**
       * Called with socket packet.
       *
       * @param packet
       * @private
       */
      onpacket(packet) {
          const sameNamespace = packet.nsp === this.nsp;
          if (!sameNamespace)
              return;
          switch (packet.type) {
              case PacketType$1.CONNECT:
                  if (packet.data && packet.data.sid) {
                      this.onconnect(packet.data.sid, packet.data.pid);
                  }
                  else {
                      this.emitReserved("connect_error", new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));
                  }
                  break;
              case PacketType$1.EVENT:
              case PacketType$1.BINARY_EVENT:
                  this.onevent(packet);
                  break;
              case PacketType$1.ACK:
              case PacketType$1.BINARY_ACK:
                  this.onack(packet);
                  break;
              case PacketType$1.DISCONNECT:
                  this.ondisconnect();
                  break;
              case PacketType$1.CONNECT_ERROR:
                  this.destroy();
                  const err = new Error(packet.data.message);
                  // @ts-ignore
                  err.data = packet.data.data;
                  this.emitReserved("connect_error", err);
                  break;
          }
      }
      /**
       * Called upon a server event.
       *
       * @param packet
       * @private
       */
      onevent(packet) {
          const args = packet.data || [];
          if (null != packet.id) {
              args.push(this.ack(packet.id));
          }
          if (this.connected) {
              this.emitEvent(args);
          }
          else {
              this.receiveBuffer.push(Object.freeze(args));
          }
      }
      emitEvent(args) {
          if (this._anyListeners && this._anyListeners.length) {
              const listeners = this._anyListeners.slice();
              for (const listener of listeners) {
                  listener.apply(this, args);
              }
          }
          super.emit.apply(this, args);
          if (this._pid && args.length && typeof args[args.length - 1] === "string") {
              this._lastOffset = args[args.length - 1];
          }
      }
      /**
       * Produces an ack callback to emit with an event.
       *
       * @private
       */
      ack(id) {
          const self = this;
          let sent = false;
          return function (...args) {
              // prevent double callbacks
              if (sent)
                  return;
              sent = true;
              self.packet({
                  type: PacketType$1.ACK,
                  id: id,
                  data: args,
              });
          };
      }
      /**
       * Called upon a server acknowledgement.
       *
       * @param packet
       * @private
       */
      onack(packet) {
          const ack = this.acks[packet.id];
          if (typeof ack !== "function") {
              return;
          }
          delete this.acks[packet.id];
          // @ts-ignore FIXME ack is incorrectly inferred as 'never'
          if (ack.withError) {
              packet.data.unshift(null);
          }
          // @ts-ignore
          ack.apply(this, packet.data);
      }
      /**
       * Called upon server connect.
       *
       * @private
       */
      onconnect(id, pid) {
          this.id = id;
          this.recovered = pid && this._pid === pid;
          this._pid = pid; // defined only if connection state recovery is enabled
          this.connected = true;
          this.emitBuffered();
          this._drainQueue(true);
          this.emitReserved("connect");
      }
      /**
       * Emit buffered events (received and emitted).
       *
       * @private
       */
      emitBuffered() {
          this.receiveBuffer.forEach((args) => this.emitEvent(args));
          this.receiveBuffer = [];
          this.sendBuffer.forEach((packet) => {
              this.notifyOutgoingListeners(packet);
              this.packet(packet);
          });
          this.sendBuffer = [];
      }
      /**
       * Called upon server disconnect.
       *
       * @private
       */
      ondisconnect() {
          this.destroy();
          this.onclose("io server disconnect");
      }
      /**
       * Called upon forced client/server side disconnections,
       * this method ensures the manager stops tracking us and
       * that reconnections don't get triggered for this.
       *
       * @private
       */
      destroy() {
          if (this.subs) {
              // clean subscriptions to avoid reconnections
              this.subs.forEach((subDestroy) => subDestroy());
              this.subs = undefined;
          }
          this.io["_destroy"](this);
      }
      /**
       * Disconnects the socket manually. In that case, the socket will not try to reconnect.
       *
       * If this is the last active Socket instance of the {@link Manager}, the low-level connection will be closed.
       *
       * @example
       * const socket = io();
       *
       * socket.on("disconnect", (reason) => {
       *   // console.log(reason); prints "io client disconnect"
       * });
       *
       * socket.disconnect();
       *
       * @return self
       */
      disconnect() {
          if (this.connected) {
              this.packet({ type: PacketType$1.DISCONNECT });
          }
          // remove socket from pool
          this.destroy();
          if (this.connected) {
              // fire events
              this.onclose("io client disconnect");
          }
          return this;
      }
      /**
       * Alias for {@link disconnect()}.
       *
       * @return self
       */
      close() {
          return this.disconnect();
      }
      /**
       * Sets the compress flag.
       *
       * @example
       * socket.compress(false).emit("hello");
       *
       * @param compress - if `true`, compresses the sending data
       * @return self
       */
      compress(compress) {
          this.flags.compress = compress;
          return this;
      }
      /**
       * Sets a modifier for a subsequent event emission that the event message will be dropped when this socket is not
       * ready to send messages.
       *
       * @example
       * socket.volatile.emit("hello"); // the server may or may not receive it
       *
       * @returns self
       */
      get volatile() {
          this.flags.volatile = true;
          return this;
      }
      /**
       * Sets a modifier for a subsequent event emission that the callback will be called with an error when the
       * given number of milliseconds have elapsed without an acknowledgement from the server:
       *
       * @example
       * socket.timeout(5000).emit("my-event", (err) => {
       *   if (err) {
       *     // the server did not acknowledge the event in the given delay
       *   }
       * });
       *
       * @returns self
       */
      timeout(timeout) {
          this.flags.timeout = timeout;
          return this;
      }
      /**
       * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
       * callback.
       *
       * @example
       * socket.onAny((event, ...args) => {
       *   console.log(`got ${event}`);
       * });
       *
       * @param listener
       */
      onAny(listener) {
          this._anyListeners = this._anyListeners || [];
          this._anyListeners.push(listener);
          return this;
      }
      /**
       * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
       * callback. The listener is added to the beginning of the listeners array.
       *
       * @example
       * socket.prependAny((event, ...args) => {
       *   console.log(`got event ${event}`);
       * });
       *
       * @param listener
       */
      prependAny(listener) {
          this._anyListeners = this._anyListeners || [];
          this._anyListeners.unshift(listener);
          return this;
      }
      /**
       * Removes the listener that will be fired when any event is emitted.
       *
       * @example
       * const catchAllListener = (event, ...args) => {
       *   console.log(`got event ${event}`);
       * }
       *
       * socket.onAny(catchAllListener);
       *
       * // remove a specific listener
       * socket.offAny(catchAllListener);
       *
       * // or remove all listeners
       * socket.offAny();
       *
       * @param listener
       */
      offAny(listener) {
          if (!this._anyListeners) {
              return this;
          }
          if (listener) {
              const listeners = this._anyListeners;
              for (let i = 0; i < listeners.length; i++) {
                  if (listener === listeners[i]) {
                      listeners.splice(i, 1);
                      return this;
                  }
              }
          }
          else {
              this._anyListeners = [];
          }
          return this;
      }
      /**
       * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
       * e.g. to remove listeners.
       */
      listenersAny() {
          return this._anyListeners || [];
      }
      /**
       * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
       * callback.
       *
       * Note: acknowledgements sent to the server are not included.
       *
       * @example
       * socket.onAnyOutgoing((event, ...args) => {
       *   console.log(`sent event ${event}`);
       * });
       *
       * @param listener
       */
      onAnyOutgoing(listener) {
          this._anyOutgoingListeners = this._anyOutgoingListeners || [];
          this._anyOutgoingListeners.push(listener);
          return this;
      }
      /**
       * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
       * callback. The listener is added to the beginning of the listeners array.
       *
       * Note: acknowledgements sent to the server are not included.
       *
       * @example
       * socket.prependAnyOutgoing((event, ...args) => {
       *   console.log(`sent event ${event}`);
       * });
       *
       * @param listener
       */
      prependAnyOutgoing(listener) {
          this._anyOutgoingListeners = this._anyOutgoingListeners || [];
          this._anyOutgoingListeners.unshift(listener);
          return this;
      }
      /**
       * Removes the listener that will be fired when any event is emitted.
       *
       * @example
       * const catchAllListener = (event, ...args) => {
       *   console.log(`sent event ${event}`);
       * }
       *
       * socket.onAnyOutgoing(catchAllListener);
       *
       * // remove a specific listener
       * socket.offAnyOutgoing(catchAllListener);
       *
       * // or remove all listeners
       * socket.offAnyOutgoing();
       *
       * @param [listener] - the catch-all listener (optional)
       */
      offAnyOutgoing(listener) {
          if (!this._anyOutgoingListeners) {
              return this;
          }
          if (listener) {
              const listeners = this._anyOutgoingListeners;
              for (let i = 0; i < listeners.length; i++) {
                  if (listener === listeners[i]) {
                      listeners.splice(i, 1);
                      return this;
                  }
              }
          }
          else {
              this._anyOutgoingListeners = [];
          }
          return this;
      }
      /**
       * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
       * e.g. to remove listeners.
       */
      listenersAnyOutgoing() {
          return this._anyOutgoingListeners || [];
      }
      /**
       * Notify the listeners for each packet sent
       *
       * @param packet
       *
       * @private
       */
      notifyOutgoingListeners(packet) {
          if (this._anyOutgoingListeners && this._anyOutgoingListeners.length) {
              const listeners = this._anyOutgoingListeners.slice();
              for (const listener of listeners) {
                  listener.apply(this, packet.data);
              }
          }
      }
  }

  /**
   * Initialize backoff timer with `opts`.
   *
   * - `min` initial timeout in milliseconds [100]
   * - `max` max timeout [10000]
   * - `jitter` [0]
   * - `factor` [2]
   *
   * @param {Object} opts
   * @api public
   */
  function Backoff(opts) {
      opts = opts || {};
      this.ms = opts.min || 100;
      this.max = opts.max || 10000;
      this.factor = opts.factor || 2;
      this.jitter = opts.jitter > 0 && opts.jitter <= 1 ? opts.jitter : 0;
      this.attempts = 0;
  }
  /**
   * Return the backoff duration.
   *
   * @return {Number}
   * @api public
   */
  Backoff.prototype.duration = function () {
      var ms = this.ms * Math.pow(this.factor, this.attempts++);
      if (this.jitter) {
          var rand = Math.random();
          var deviation = Math.floor(rand * this.jitter * ms);
          ms = (Math.floor(rand * 10) & 1) == 0 ? ms - deviation : ms + deviation;
      }
      return Math.min(ms, this.max) | 0;
  };
  /**
   * Reset the number of attempts.
   *
   * @api public
   */
  Backoff.prototype.reset = function () {
      this.attempts = 0;
  };
  /**
   * Set the minimum duration
   *
   * @api public
   */
  Backoff.prototype.setMin = function (min) {
      this.ms = min;
  };
  /**
   * Set the maximum duration
   *
   * @api public
   */
  Backoff.prototype.setMax = function (max) {
      this.max = max;
  };
  /**
   * Set the jitter
   *
   * @api public
   */
  Backoff.prototype.setJitter = function (jitter) {
      this.jitter = jitter;
  };

  class Manager extends Emitter$1 {
      constructor(uri, opts) {
          var _a;
          super();
          this.nsps = {};
          this.subs = [];
          if (uri && "object" === typeof uri) {
              opts = uri;
              uri = undefined;
          }
          opts = opts || {};
          opts.path = opts.path || "/socket.io";
          this.opts = opts;
          installTimerFunctions(this, opts);
          this.reconnection(opts.reconnection !== false);
          this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
          this.reconnectionDelay(opts.reconnectionDelay || 1000);
          this.reconnectionDelayMax(opts.reconnectionDelayMax || 5000);
          this.randomizationFactor((_a = opts.randomizationFactor) !== null && _a !== void 0 ? _a : 0.5);
          this.backoff = new Backoff({
              min: this.reconnectionDelay(),
              max: this.reconnectionDelayMax(),
              jitter: this.randomizationFactor(),
          });
          this.timeout(null == opts.timeout ? 20000 : opts.timeout);
          this._readyState = "closed";
          this.uri = uri;
          const _parser = opts.parser || parser;
          this.encoder = new _parser.Encoder();
          this.decoder = new _parser.Decoder();
          this._autoConnect = opts.autoConnect !== false;
          if (this._autoConnect)
              this.open();
      }
      reconnection(v) {
          if (!arguments.length)
              return this._reconnection;
          this._reconnection = !!v;
          if (!v) {
              this.skipReconnect = true;
          }
          return this;
      }
      reconnectionAttempts(v) {
          if (v === undefined)
              return this._reconnectionAttempts;
          this._reconnectionAttempts = v;
          return this;
      }
      reconnectionDelay(v) {
          var _a;
          if (v === undefined)
              return this._reconnectionDelay;
          this._reconnectionDelay = v;
          (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMin(v);
          return this;
      }
      randomizationFactor(v) {
          var _a;
          if (v === undefined)
              return this._randomizationFactor;
          this._randomizationFactor = v;
          (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setJitter(v);
          return this;
      }
      reconnectionDelayMax(v) {
          var _a;
          if (v === undefined)
              return this._reconnectionDelayMax;
          this._reconnectionDelayMax = v;
          (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMax(v);
          return this;
      }
      timeout(v) {
          if (!arguments.length)
              return this._timeout;
          this._timeout = v;
          return this;
      }
      /**
       * Starts trying to reconnect if reconnection is enabled and we have not
       * started reconnecting yet
       *
       * @private
       */
      maybeReconnectOnOpen() {
          // Only try to reconnect if it's the first time we're connecting
          if (!this._reconnecting &&
              this._reconnection &&
              this.backoff.attempts === 0) {
              // keeps reconnection from firing twice for the same reconnection loop
              this.reconnect();
          }
      }
      /**
       * Sets the current transport `socket`.
       *
       * @param {Function} fn - optional, callback
       * @return self
       * @public
       */
      open(fn) {
          if (~this._readyState.indexOf("open"))
              return this;
          this.engine = new Socket$1(this.uri, this.opts);
          const socket = this.engine;
          const self = this;
          this._readyState = "opening";
          this.skipReconnect = false;
          // emit `open`
          const openSubDestroy = on$1(socket, "open", function () {
              self.onopen();
              fn && fn();
          });
          const onError = (err) => {
              this.cleanup();
              this._readyState = "closed";
              this.emitReserved("error", err);
              if (fn) {
                  fn(err);
              }
              else {
                  // Only do this if there is no fn to handle the error
                  this.maybeReconnectOnOpen();
              }
          };
          // emit `error`
          const errorSub = on$1(socket, "error", onError);
          if (false !== this._timeout) {
              const timeout = this._timeout;
              // set timer
              const timer = this.setTimeoutFn(() => {
                  openSubDestroy();
                  onError(new Error("timeout"));
                  socket.close();
              }, timeout);
              if (this.opts.autoUnref) {
                  timer.unref();
              }
              this.subs.push(() => {
                  this.clearTimeoutFn(timer);
              });
          }
          this.subs.push(openSubDestroy);
          this.subs.push(errorSub);
          return this;
      }
      /**
       * Alias for open()
       *
       * @return self
       * @public
       */
      connect(fn) {
          return this.open(fn);
      }
      /**
       * Called upon transport open.
       *
       * @private
       */
      onopen() {
          // clear old subs
          this.cleanup();
          // mark as open
          this._readyState = "open";
          this.emitReserved("open");
          // add new subs
          const socket = this.engine;
          this.subs.push(on$1(socket, "ping", this.onping.bind(this)), on$1(socket, "data", this.ondata.bind(this)), on$1(socket, "error", this.onerror.bind(this)), on$1(socket, "close", this.onclose.bind(this)), 
          // @ts-ignore
          on$1(this.decoder, "decoded", this.ondecoded.bind(this)));
      }
      /**
       * Called upon a ping.
       *
       * @private
       */
      onping() {
          this.emitReserved("ping");
      }
      /**
       * Called with data.
       *
       * @private
       */
      ondata(data) {
          try {
              this.decoder.add(data);
          }
          catch (e) {
              this.onclose("parse error", e);
          }
      }
      /**
       * Called when parser fully decodes a packet.
       *
       * @private
       */
      ondecoded(packet) {
          // the nextTick call prevents an exception in a user-provided event listener from triggering a disconnection due to a "parse error"
          nextTick(() => {
              this.emitReserved("packet", packet);
          }, this.setTimeoutFn);
      }
      /**
       * Called upon socket error.
       *
       * @private
       */
      onerror(err) {
          this.emitReserved("error", err);
      }
      /**
       * Creates a new socket for the given `nsp`.
       *
       * @return {Socket}
       * @public
       */
      socket(nsp, opts) {
          let socket = this.nsps[nsp];
          if (!socket) {
              socket = new Socket(this, nsp, opts);
              this.nsps[nsp] = socket;
          }
          else if (this._autoConnect && !socket.active) {
              socket.connect();
          }
          return socket;
      }
      /**
       * Called upon a socket close.
       *
       * @param socket
       * @private
       */
      _destroy(socket) {
          const nsps = Object.keys(this.nsps);
          for (const nsp of nsps) {
              const socket = this.nsps[nsp];
              if (socket.active) {
                  return;
              }
          }
          this._close();
      }
      /**
       * Writes a packet.
       *
       * @param packet
       * @private
       */
      _packet(packet) {
          const encodedPackets = this.encoder.encode(packet);
          for (let i = 0; i < encodedPackets.length; i++) {
              this.engine.write(encodedPackets[i], packet.options);
          }
      }
      /**
       * Clean up transport subscriptions and packet buffer.
       *
       * @private
       */
      cleanup() {
          this.subs.forEach((subDestroy) => subDestroy());
          this.subs.length = 0;
          this.decoder.destroy();
      }
      /**
       * Close the current socket.
       *
       * @private
       */
      _close() {
          this.skipReconnect = true;
          this._reconnecting = false;
          this.onclose("forced close");
      }
      /**
       * Alias for close()
       *
       * @private
       */
      disconnect() {
          return this._close();
      }
      /**
       * Called when:
       *
       * - the low-level engine is closed
       * - the parser encountered a badly formatted packet
       * - all sockets are disconnected
       *
       * @private
       */
      onclose(reason, description) {
          var _a;
          this.cleanup();
          (_a = this.engine) === null || _a === void 0 ? void 0 : _a.close();
          this.backoff.reset();
          this._readyState = "closed";
          this.emitReserved("close", reason, description);
          if (this._reconnection && !this.skipReconnect) {
              this.reconnect();
          }
      }
      /**
       * Attempt a reconnection.
       *
       * @private
       */
      reconnect() {
          if (this._reconnecting || this.skipReconnect)
              return this;
          const self = this;
          if (this.backoff.attempts >= this._reconnectionAttempts) {
              this.backoff.reset();
              this.emitReserved("reconnect_failed");
              this._reconnecting = false;
          }
          else {
              const delay = this.backoff.duration();
              this._reconnecting = true;
              const timer = this.setTimeoutFn(() => {
                  if (self.skipReconnect)
                      return;
                  this.emitReserved("reconnect_attempt", self.backoff.attempts);
                  // check again for the case socket closed in above events
                  if (self.skipReconnect)
                      return;
                  self.open((err) => {
                      if (err) {
                          self._reconnecting = false;
                          self.reconnect();
                          this.emitReserved("reconnect_error", err);
                      }
                      else {
                          self.onreconnect();
                      }
                  });
              }, delay);
              if (this.opts.autoUnref) {
                  timer.unref();
              }
              this.subs.push(() => {
                  this.clearTimeoutFn(timer);
              });
          }
      }
      /**
       * Called upon successful reconnect.
       *
       * @private
       */
      onreconnect() {
          const attempt = this.backoff.attempts;
          this._reconnecting = false;
          this.backoff.reset();
          this.emitReserved("reconnect", attempt);
      }
  }

  /**
   * Managers cache.
   */
  const cache = {};
  function lookup(uri, opts) {
      if (typeof uri === "object") {
          opts = uri;
          uri = undefined;
      }
      opts = opts || {};
      const parsed = url(uri, opts.path || "/socket.io");
      const source = parsed.source;
      const id = parsed.id;
      const path = parsed.path;
      const sameNamespace = cache[id] && path in cache[id]["nsps"];
      const newConnection = opts.forceNew ||
          opts["force new connection"] ||
          false === opts.multiplex ||
          sameNamespace;
      let io;
      if (newConnection) {
          io = new Manager(source, opts);
      }
      else {
          if (!cache[id]) {
              cache[id] = new Manager(source, opts);
          }
          io = cache[id];
      }
      if (parsed.query && !opts.query) {
          opts.query = parsed.queryKey;
      }
      return io.socket(parsed.path, opts);
  }
  // so that "lookup" can be used both as a function (e.g. `io(...)`) and as a
  // namespace (e.g. `io.connect(...)`), for backward compatibility
  Object.assign(lookup, {
      Manager,
      Socket,
      io: lookup,
      connect: lookup,
  });

  var socket_ioMsgpackParser = {};

  var lib = {};

  function utf8Write(view, offset, str) {
    var c = 0;
    for (var i = 0, l = str.length; i < l; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) {
        view.setUint8(offset++, c);
      }
      else if (c < 0x800) {
        view.setUint8(offset++, 0xc0 | (c >> 6));
        view.setUint8(offset++, 0x80 | (c & 0x3f));
      }
      else if (c < 0xd800 || c >= 0xe000) {
        view.setUint8(offset++, 0xe0 | (c >> 12));
        view.setUint8(offset++, 0x80 | (c >> 6) & 0x3f);
        view.setUint8(offset++, 0x80 | (c & 0x3f));
      }
      else {
        i++;
        c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        view.setUint8(offset++, 0xf0 | (c >> 18));
        view.setUint8(offset++, 0x80 | (c >> 12) & 0x3f);
        view.setUint8(offset++, 0x80 | (c >> 6) & 0x3f);
        view.setUint8(offset++, 0x80 | (c & 0x3f));
      }
    }
  }

  function utf8Length(str) {
    var c = 0, length = 0;
    for (var i = 0, l = str.length; i < l; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) {
        length += 1;
      }
      else if (c < 0x800) {
        length += 2;
      }
      else if (c < 0xd800 || c >= 0xe000) {
        length += 3;
      }
      else {
        i++;
        length += 4;
      }
    }
    return length;
  }

  function _encode(bytes, defers, value) {
    var type = typeof value, i = 0, l = 0, hi = 0, lo = 0, length = 0, size = 0;

    if (type === 'string') {
      length = utf8Length(value);

      // fixstr
      if (length < 0x20) {
        bytes.push(length | 0xa0);
        size = 1;
      }
      // str 8
      else if (length < 0x100) {
        bytes.push(0xd9, length);
        size = 2;
      }
      // str 16
      else if (length < 0x10000) {
        bytes.push(0xda, length >> 8, length);
        size = 3;
      }
      // str 32
      else if (length < 0x100000000) {
        bytes.push(0xdb, length >> 24, length >> 16, length >> 8, length);
        size = 5;
      } else {
        throw new Error('String too long');
      }
      defers.push({ _str: value, _length: length, _offset: bytes.length });
      return size + length;
    }
    if (type === 'number') {
      // TODO: encode to float 32?

      // float 64
      if (Math.floor(value) !== value || !isFinite(value)) {
        bytes.push(0xcb);
        defers.push({ _float: value, _length: 8, _offset: bytes.length });
        return 9;
      }

      if (value >= 0) {
        // positive fixnum
        if (value < 0x80) {
          bytes.push(value);
          return 1;
        }
        // uint 8
        if (value < 0x100) {
          bytes.push(0xcc, value);
          return 2;
        }
        // uint 16
        if (value < 0x10000) {
          bytes.push(0xcd, value >> 8, value);
          return 3;
        }
        // uint 32
        if (value < 0x100000000) {
          bytes.push(0xce, value >> 24, value >> 16, value >> 8, value);
          return 5;
        }
        // uint 64
        hi = (value / Math.pow(2, 32)) >> 0;
        lo = value >>> 0;
        bytes.push(0xcf, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
        return 9;
      } else {
        // negative fixnum
        if (value >= -32) {
          bytes.push(value);
          return 1;
        }
        // int 8
        if (value >= -128) {
          bytes.push(0xd0, value);
          return 2;
        }
        // int 16
        if (value >= -32768) {
          bytes.push(0xd1, value >> 8, value);
          return 3;
        }
        // int 32
        if (value >= -2147483648) {
          bytes.push(0xd2, value >> 24, value >> 16, value >> 8, value);
          return 5;
        }
        // int 64
        hi = Math.floor(value / Math.pow(2, 32));
        lo = value >>> 0;
        bytes.push(0xd3, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
        return 9;
      }
    }
    if (type === 'object') {
      // nil
      if (value === null) {
        bytes.push(0xc0);
        return 1;
      }

      if (Array.isArray(value)) {
        length = value.length;

        // fixarray
        if (length < 0x10) {
          bytes.push(length | 0x90);
          size = 1;
        }
        // array 16
        else if (length < 0x10000) {
          bytes.push(0xdc, length >> 8, length);
          size = 3;
        }
        // array 32
        else if (length < 0x100000000) {
          bytes.push(0xdd, length >> 24, length >> 16, length >> 8, length);
          size = 5;
        } else {
          throw new Error('Array too large');
        }
        for (i = 0; i < length; i++) {
          size += _encode(bytes, defers, value[i]);
        }
        return size;
      }

      // fixext 8 / Date
      if (value instanceof Date) {
        var time = value.getTime();
        hi = Math.floor(time / Math.pow(2, 32));
        lo = time >>> 0;
        bytes.push(0xd7, 0, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
        return 10;
      }

      if (value instanceof ArrayBuffer) {
        length = value.byteLength;

        // bin 8
        if (length < 0x100) {
          bytes.push(0xc4, length);
          size = 2;
        } else
        // bin 16
        if (length < 0x10000) {
          bytes.push(0xc5, length >> 8, length);
          size = 3;
        } else
        // bin 32
        if (length < 0x100000000) {
          bytes.push(0xc6, length >> 24, length >> 16, length >> 8, length);
          size = 5;
        } else {
          throw new Error('Buffer too large');
        }
        defers.push({ _bin: value, _length: length, _offset: bytes.length });
        return size + length;
      }

      if (typeof value.toJSON === 'function') {
        return _encode(bytes, defers, value.toJSON());
      }

      var keys = [], key = '';

      var allKeys = Object.keys(value);
      for (i = 0, l = allKeys.length; i < l; i++) {
        key = allKeys[i];
        if (typeof value[key] !== 'function') {
          keys.push(key);
        }
      }
      length = keys.length;

      // fixmap
      if (length < 0x10) {
        bytes.push(length | 0x80);
        size = 1;
      }
      // map 16
      else if (length < 0x10000) {
        bytes.push(0xde, length >> 8, length);
        size = 3;
      }
      // map 32
      else if (length < 0x100000000) {
        bytes.push(0xdf, length >> 24, length >> 16, length >> 8, length);
        size = 5;
      } else {
        throw new Error('Object too large');
      }

      for (i = 0; i < length; i++) {
        key = keys[i];
        size += _encode(bytes, defers, key);
        size += _encode(bytes, defers, value[key]);
      }
      return size;
    }
    // false/true
    if (type === 'boolean') {
      bytes.push(value ? 0xc3 : 0xc2);
      return 1;
    }
    // fixext 1 / undefined
    if (type === 'undefined') {
      bytes.push(0xd4, 0, 0);
      return 3;
    }
    throw new Error('Could not encode');
  }

  function encode(value) {
    var bytes = [];
    var defers = [];
    var size = _encode(bytes, defers, value);
    var buf = new ArrayBuffer(size);
    var view = new DataView(buf);

    var deferIndex = 0;
    var deferWritten = 0;
    var nextOffset = -1;
    if (defers.length > 0) {
      nextOffset = defers[0]._offset;
    }

    var defer, deferLength = 0, offset = 0;
    for (var i = 0, l = bytes.length; i < l; i++) {
      view.setUint8(deferWritten + i, bytes[i]);
      if (i + 1 !== nextOffset) { continue; }
      defer = defers[deferIndex];
      deferLength = defer._length;
      offset = deferWritten + nextOffset;
      if (defer._bin) {
        var bin = new Uint8Array(defer._bin);
        for (var j = 0; j < deferLength; j++) {
          view.setUint8(offset + j, bin[j]);
        }
      } else if (defer._str) {
        utf8Write(view, offset, defer._str);
      } else if (defer._float !== undefined) {
        view.setFloat64(offset, defer._float);
      }
      deferIndex++;
      deferWritten += deferLength;
      if (defers[deferIndex]) {
        nextOffset = defers[deferIndex]._offset;
      }
    }
    return buf;
  }

  var encode_1 = encode;

  function Decoder$1(buffer) {
    this._offset = 0;
    if (buffer instanceof ArrayBuffer) {
      this._buffer = buffer;
      this._view = new DataView(this._buffer);
    } else if (ArrayBuffer.isView(buffer)) {
      this._buffer = buffer.buffer;
      this._view = new DataView(this._buffer, buffer.byteOffset, buffer.byteLength);
    } else {
      throw new Error('Invalid argument');
    }
  }

  function utf8Read(view, offset, length) {
    var string = '', chr = 0;
    for (var i = offset, end = offset + length; i < end; i++) {
      var byte = view.getUint8(i);
      if ((byte & 0x80) === 0x00) {
        string += String.fromCharCode(byte);
        continue;
      }
      if ((byte & 0xe0) === 0xc0) {
        string += String.fromCharCode(
          ((byte & 0x1f) << 6) |
          (view.getUint8(++i) & 0x3f)
        );
        continue;
      }
      if ((byte & 0xf0) === 0xe0) {
        string += String.fromCharCode(
          ((byte & 0x0f) << 12) |
          ((view.getUint8(++i) & 0x3f) << 6) |
          ((view.getUint8(++i) & 0x3f) << 0)
        );
        continue;
      }
      if ((byte & 0xf8) === 0xf0) {
        chr = ((byte & 0x07) << 18) |
          ((view.getUint8(++i) & 0x3f) << 12) |
          ((view.getUint8(++i) & 0x3f) << 6) |
          ((view.getUint8(++i) & 0x3f) << 0);
        if (chr >= 0x010000) { // surrogate pair
          chr -= 0x010000;
          string += String.fromCharCode((chr >>> 10) + 0xD800, (chr & 0x3FF) + 0xDC00);
        } else {
          string += String.fromCharCode(chr);
        }
        continue;
      }
      throw new Error('Invalid byte ' + byte.toString(16));
    }
    return string;
  }

  Decoder$1.prototype._array = function (length) {
    var value = new Array(length);
    for (var i = 0; i < length; i++) {
      value[i] = this._parse();
    }
    return value;
  };

  Decoder$1.prototype._map = function (length) {
    var key = '', value = {};
    for (var i = 0; i < length; i++) {
      key = this._parse();
      value[key] = this._parse();
    }
    return value;
  };

  Decoder$1.prototype._str = function (length) {
    var value = utf8Read(this._view, this._offset, length);
    this._offset += length;
    return value;
  };

  Decoder$1.prototype._bin = function (length) {
    var value = this._buffer.slice(this._offset, this._offset + length);
    this._offset += length;
    return value;
  };

  Decoder$1.prototype._parse = function () {
    var prefix = this._view.getUint8(this._offset++);
    var value, length = 0, type = 0, hi = 0, lo = 0;

    if (prefix < 0xc0) {
      // positive fixint
      if (prefix < 0x80) {
        return prefix;
      }
      // fixmap
      if (prefix < 0x90) {
        return this._map(prefix & 0x0f);
      }
      // fixarray
      if (prefix < 0xa0) {
        return this._array(prefix & 0x0f);
      }
      // fixstr
      return this._str(prefix & 0x1f);
    }

    // negative fixint
    if (prefix > 0xdf) {
      return (0xff - prefix + 1) * -1;
    }

    switch (prefix) {
      // nil
      case 0xc0:
        return null;
      // false
      case 0xc2:
        return false;
      // true
      case 0xc3:
        return true;

      // bin
      case 0xc4:
        length = this._view.getUint8(this._offset);
        this._offset += 1;
        return this._bin(length);
      case 0xc5:
        length = this._view.getUint16(this._offset);
        this._offset += 2;
        return this._bin(length);
      case 0xc6:
        length = this._view.getUint32(this._offset);
        this._offset += 4;
        return this._bin(length);

      // ext
      case 0xc7:
        length = this._view.getUint8(this._offset);
        type = this._view.getInt8(this._offset + 1);
        this._offset += 2;
        return [type, this._bin(length)];
      case 0xc8:
        length = this._view.getUint16(this._offset);
        type = this._view.getInt8(this._offset + 2);
        this._offset += 3;
        return [type, this._bin(length)];
      case 0xc9:
        length = this._view.getUint32(this._offset);
        type = this._view.getInt8(this._offset + 4);
        this._offset += 5;
        return [type, this._bin(length)];

      // float
      case 0xca:
        value = this._view.getFloat32(this._offset);
        this._offset += 4;
        return value;
      case 0xcb:
        value = this._view.getFloat64(this._offset);
        this._offset += 8;
        return value;

      // uint
      case 0xcc:
        value = this._view.getUint8(this._offset);
        this._offset += 1;
        return value;
      case 0xcd:
        value = this._view.getUint16(this._offset);
        this._offset += 2;
        return value;
      case 0xce:
        value = this._view.getUint32(this._offset);
        this._offset += 4;
        return value;
      case 0xcf:
        hi = this._view.getUint32(this._offset) * Math.pow(2, 32);
        lo = this._view.getUint32(this._offset + 4);
        this._offset += 8;
        return hi + lo;

      // int
      case 0xd0:
        value = this._view.getInt8(this._offset);
        this._offset += 1;
        return value;
      case 0xd1:
        value = this._view.getInt16(this._offset);
        this._offset += 2;
        return value;
      case 0xd2:
        value = this._view.getInt32(this._offset);
        this._offset += 4;
        return value;
      case 0xd3:
        hi = this._view.getInt32(this._offset) * Math.pow(2, 32);
        lo = this._view.getUint32(this._offset + 4);
        this._offset += 8;
        return hi + lo;

      // fixext
      case 0xd4:
        type = this._view.getInt8(this._offset);
        this._offset += 1;
        if (type === 0x00) {
          this._offset += 1;
          return void 0;
        }
        return [type, this._bin(1)];
      case 0xd5:
        type = this._view.getInt8(this._offset);
        this._offset += 1;
        return [type, this._bin(2)];
      case 0xd6:
        type = this._view.getInt8(this._offset);
        this._offset += 1;
        return [type, this._bin(4)];
      case 0xd7:
        type = this._view.getInt8(this._offset);
        this._offset += 1;
        if (type === 0x00) {
          hi = this._view.getInt32(this._offset) * Math.pow(2, 32);
          lo = this._view.getUint32(this._offset + 4);
          this._offset += 8;
          return new Date(hi + lo);
        }
        return [type, this._bin(8)];
      case 0xd8:
        type = this._view.getInt8(this._offset);
        this._offset += 1;
        return [type, this._bin(16)];

      // str
      case 0xd9:
        length = this._view.getUint8(this._offset);
        this._offset += 1;
        return this._str(length);
      case 0xda:
        length = this._view.getUint16(this._offset);
        this._offset += 2;
        return this._str(length);
      case 0xdb:
        length = this._view.getUint32(this._offset);
        this._offset += 4;
        return this._str(length);

      // array
      case 0xdc:
        length = this._view.getUint16(this._offset);
        this._offset += 2;
        return this._array(length);
      case 0xdd:
        length = this._view.getUint32(this._offset);
        this._offset += 4;
        return this._array(length);

      // map
      case 0xde:
        length = this._view.getUint16(this._offset);
        this._offset += 2;
        return this._map(length);
      case 0xdf:
        length = this._view.getUint32(this._offset);
        this._offset += 4;
        return this._map(length);
    }

    throw new Error('Could not parse');
  };

  function decode(buffer) {
    var decoder = new Decoder$1(buffer);
    var value = decoder._parse();
    if (decoder._offset !== buffer.byteLength) {
      throw new Error((buffer.byteLength - decoder._offset) + ' trailing bytes');
    }
    return value;
  }

  var decode_1 = decode;

  lib.encode = encode_1;
  lib.decode = decode_1;

  var componentEmitter = {exports: {}};

  (function (module) {
  	/**
  	 * Expose `Emitter`.
  	 */

  	{
  	  module.exports = Emitter;
  	}

  	/**
  	 * Initialize a new `Emitter`.
  	 *
  	 * @api public
  	 */

  	function Emitter(obj) {
  	  if (obj) return mixin(obj);
  	}
  	/**
  	 * Mixin the emitter properties.
  	 *
  	 * @param {Object} obj
  	 * @return {Object}
  	 * @api private
  	 */

  	function mixin(obj) {
  	  for (var key in Emitter.prototype) {
  	    obj[key] = Emitter.prototype[key];
  	  }
  	  return obj;
  	}

  	/**
  	 * Listen on the given `event` with `fn`.
  	 *
  	 * @param {String} event
  	 * @param {Function} fn
  	 * @return {Emitter}
  	 * @api public
  	 */

  	Emitter.prototype.on =
  	Emitter.prototype.addEventListener = function(event, fn){
  	  this._callbacks = this._callbacks || {};
  	  (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
  	    .push(fn);
  	  return this;
  	};

  	/**
  	 * Adds an `event` listener that will be invoked a single
  	 * time then automatically removed.
  	 *
  	 * @param {String} event
  	 * @param {Function} fn
  	 * @return {Emitter}
  	 * @api public
  	 */

  	Emitter.prototype.once = function(event, fn){
  	  function on() {
  	    this.off(event, on);
  	    fn.apply(this, arguments);
  	  }

  	  on.fn = fn;
  	  this.on(event, on);
  	  return this;
  	};

  	/**
  	 * Remove the given callback for `event` or all
  	 * registered callbacks.
  	 *
  	 * @param {String} event
  	 * @param {Function} fn
  	 * @return {Emitter}
  	 * @api public
  	 */

  	Emitter.prototype.off =
  	Emitter.prototype.removeListener =
  	Emitter.prototype.removeAllListeners =
  	Emitter.prototype.removeEventListener = function(event, fn){
  	  this._callbacks = this._callbacks || {};

  	  // all
  	  if (0 == arguments.length) {
  	    this._callbacks = {};
  	    return this;
  	  }

  	  // specific event
  	  var callbacks = this._callbacks['$' + event];
  	  if (!callbacks) return this;

  	  // remove all handlers
  	  if (1 == arguments.length) {
  	    delete this._callbacks['$' + event];
  	    return this;
  	  }

  	  // remove specific handler
  	  var cb;
  	  for (var i = 0; i < callbacks.length; i++) {
  	    cb = callbacks[i];
  	    if (cb === fn || cb.fn === fn) {
  	      callbacks.splice(i, 1);
  	      break;
  	    }
  	  }

  	  // Remove event specific arrays for event types that no
  	  // one is subscribed for to avoid memory leak.
  	  if (callbacks.length === 0) {
  	    delete this._callbacks['$' + event];
  	  }

  	  return this;
  	};

  	/**
  	 * Emit `event` with the given args.
  	 *
  	 * @param {String} event
  	 * @param {Mixed} ...
  	 * @return {Emitter}
  	 */

  	Emitter.prototype.emit = function(event){
  	  this._callbacks = this._callbacks || {};

  	  var args = new Array(arguments.length - 1)
  	    , callbacks = this._callbacks['$' + event];

  	  for (var i = 1; i < arguments.length; i++) {
  	    args[i - 1] = arguments[i];
  	  }

  	  if (callbacks) {
  	    callbacks = callbacks.slice(0);
  	    for (var i = 0, len = callbacks.length; i < len; ++i) {
  	      callbacks[i].apply(this, args);
  	    }
  	  }

  	  return this;
  	};

  	/**
  	 * Return array of callbacks for `event`.
  	 *
  	 * @param {String} event
  	 * @return {Array}
  	 * @api public
  	 */

  	Emitter.prototype.listeners = function(event){
  	  this._callbacks = this._callbacks || {};
  	  return this._callbacks['$' + event] || [];
  	};

  	/**
  	 * Check if this emitter has `event` handlers.
  	 *
  	 * @param {String} event
  	 * @return {Boolean}
  	 * @api public
  	 */

  	Emitter.prototype.hasListeners = function(event){
  	  return !! this.listeners(event).length;
  	}; 
  } (componentEmitter));

  var componentEmitterExports = componentEmitter.exports;

  var PacketType_1;
  var msgpack = lib;
  var Emitter = componentEmitterExports;

  var protocol = socket_ioMsgpackParser.protocol = 5;

  /**
   * Packet types (see https://github.com/socketio/socket.io-protocol)
   */

  var PacketType = (PacketType_1 = socket_ioMsgpackParser.PacketType = {
    CONNECT: 0,
    DISCONNECT: 1,
    EVENT: 2,
    ACK: 3,
    CONNECT_ERROR: 4,
  });

  var isInteger =
    Number.isInteger ||
    function (value) {
      return (
        typeof value === "number" &&
        isFinite(value) &&
        Math.floor(value) === value
      );
    };

  var isString = function (value) {
    return typeof value === "string";
  };

  var isObject = function (value) {
    return Object.prototype.toString.call(value) === "[object Object]";
  };

  function Encoder() {}

  Encoder.prototype.encode = function (packet) {
    return [msgpack.encode(packet)];
  };

  function Decoder() {}

  Emitter(Decoder.prototype);

  Decoder.prototype.add = function (obj) {
    var decoded = msgpack.decode(obj);
    this.checkPacket(decoded);
    this.emit("decoded", decoded);
  };

  function isDataValid(decoded) {
    switch (decoded.type) {
      case PacketType.CONNECT:
        return decoded.data === undefined || isObject(decoded.data);
      case PacketType.DISCONNECT:
        return decoded.data === undefined;
      case PacketType.CONNECT_ERROR:
        return isString(decoded.data) || isObject(decoded.data);
      default:
        return Array.isArray(decoded.data);
    }
  }

  Decoder.prototype.checkPacket = function (decoded) {
    var isTypeValid =
      isInteger(decoded.type) &&
      decoded.type >= PacketType.CONNECT &&
      decoded.type <= PacketType.CONNECT_ERROR;
    if (!isTypeValid) {
      throw new Error("invalid packet type");
    }

    if (!isString(decoded.nsp)) {
      throw new Error("invalid namespace");
    }

    if (!isDataValid(decoded)) {
      throw new Error("invalid payload");
    }

    var isAckValid = decoded.id === undefined || isInteger(decoded.id);
    if (!isAckValid) {
      throw new Error("invalid packet id");
    }
  };

  Decoder.prototype.destroy = function () {};

  var Encoder_1 = socket_ioMsgpackParser.Encoder = Encoder;
  var Decoder_1 = socket_ioMsgpackParser.Decoder = Decoder;

  var _bundledMsgpackParser = /*#__PURE__*/_mergeNamespaces({
    __proto__: null,
    Decoder: Decoder_1,
    Encoder: Encoder_1,
    get PacketType () { return PacketType_1; },
    default: socket_ioMsgpackParser,
    protocol: protocol
  }, [socket_ioMsgpackParser]);

  /**
   * core/socket.js — Socket.IO Connection
   *
   * Creates the SDK's own Socket.IO connection to the fishtank.live
   * WebSocket server. This is a clean, independent connection — it does
   * not modify or interfere with the site's own connection.
   *
   * The server uses MessagePack (binary) encoding over Socket.IO v4.
   *
   * Connection handshake sequence (discovered via frame inspection):
   * 1. Connect WebSocket with msgpack parser
   * 2. Socket.IO handshake (automatic)
   * 3. Auth token sent as part of handshake: { token: <JWT|null> }
   *    - null = anonymous read-only access (sufficient for all rooms)
   *    - JWT = authenticated (required only for sending messages)
   * 4. Server responds with session IDs
   * 5. Server sends chat:room ("Global") — default room
   * 6. Chat messages start flowing
   *
   * Room switching: emit('chat:room', 'Season Pass') to change which
   * room's messages are delivered. No authentication required for reading
   * any room — auth only gates message sending.
   */

  const SOCKET_URL = 'wss://ws.fishtank.live';

  // Auth token cookie name used by the site (Supabase auth)
  const AUTH_COOKIE_NAME$1 = 'sb-wcsaaupukpdmqdjcgaoo-auth-token';

  /**
   * Known chat room names.
   * The server defaults to Global. Other rooms require an explicit
   * chat:room emission after connecting.
   */
  const ROOMS = {
    GLOBAL: 'Global',
    SEASON_PASS: 'Season Pass',
    SEASON_PASS_XL: 'Season Pass XL',
  };

  // Connection state
  let socket = null;
  let connected = false;
  let authenticated = false;
  let connectionPromise = null;

  // Event listeners registered before connection is established
  const pendingListeners = [];

  // All registered listeners: eventName -> Set<callback>
  const listeners = new Map();

  /**
   * Known Socket.IO event names used by the site.
   * Discovered by inspecting WebSocket frames.
   */
  const EVENTS = {
    // Chat
    CHAT_MESSAGE: 'chat:message',
    CHAT_ROOM: 'chat:room',
    CHAT_PRESENCE: 'chat:presence',

    // TTS
    TTS_INSERT: 'tts:insert',
    TTS_UPDATE: 'tts:update',

    // SFX
    SFX_INSERT: 'sfx:insert',
    SFX_UPDATE: 'sfx:update',

    // Items
    CRAFTING_RECIPE_LEARNED: 'items:crafting-recipe:learned',

    // Notifications (toast messages / admin announcements)
    NOTIFICATION_GLOBAL: 'notification:global',

    // Presence
    PRESENCE: 'presence',

    // The following are expected based on the site's code but not yet
    // confirmed via frame inspection. They will be verified and added
    // as we discover them.
    // CHAT_REMOVE: 'chat:remove',
    // CHAT_DIRECT: 'chat:direct',
    // ZONES_UPDATE: 'zones:update',
    // ZONES_CLAIM: 'zones:claim',
    // TRADE_OPEN: 'trade:open',
    // TRADE_CLOSE: 'trade:close',
  };

  /**
   * Connect to the fishtank.live WebSocket server.
   *
   * This creates an independent connection using Socket.IO v4 with
   * MessagePack encoding.
   *
   * Supports two calling conventions:
   *
   *   // Extension usage — caller provides socket.io-client and msgpack parser
   *   await socket.connect(io, msgpackParser, { token: null });
   *
   *   // Userscript usage — uses bundled dependencies (UMD build only)
   *   await socket.connect({ token: null });
   *
   * @param {Function|Object} ioClientOrOptions - Either the socket.io-client `io`
   *   function (extension usage) or an options object (userscript usage)
   * @param {Object} [msgpackParserOrOptions] - The socket.io-msgpack-parser
   *   module (extension usage) or undefined (userscript usage)
   * @param {Object} [maybeOptions] - Connection options (extension usage only)
   * @param {string|null|undefined} options.token - JWT auth token. null = anonymous,
   *   undefined = auto-detect from cookie.
   * @returns {Promise} Resolves when connected and handshake is complete
   */
  async function connect(ioClientOrOptions, msgpackParserOrOptions, maybeOptions) {
    if (socket && connected) return socket;
    if (connectionPromise) return connectionPromise;

    // Detect calling convention:
    // connect(io, msgpackParser, opts) — first arg is a function (extension usage)
    // connect(opts) — first arg is an object or omitted (userscript usage)
    let ioClient, msgpackParser, options;

    if (typeof ioClientOrOptions === 'function') {
      // Extension usage
      ioClient = ioClientOrOptions;
      msgpackParser = msgpackParserOrOptions;
      options = maybeOptions || {};
    } else {
      // Userscript usage — use statically imported bundled dependencies
      options = ioClientOrOptions || {};
      ioClient = lookup;
      msgpackParser = _bundledMsgpackParser;
    }

    const {
      token = undefined,  // undefined = auto-detect, null = force unauthenticated
      autoSubscribe = true,
    } = options;

    // Resolve the auth token
    let authToken = token;
    if (authToken === undefined) {
      authToken = getAuthTokenFromCookie();
    }

    connectionPromise = new Promise((resolve, reject) => {
      try {
        // Store references for createConnection()
        _ioClient = ioClient;
        _msgpackParser = msgpackParser;

        socket = ioClient(SOCKET_URL, {
          parser: msgpackParser,
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 30000,
          autoConnect: true,
          // Socket.IO v4 auth option — sent as part of handshake
          auth: {
            token: authToken || null,
          },
        });

        socket.on('connect', () => {
          connected = true;
          authenticated = !!authToken;

          // Explicitly subscribe to Global chat — don't rely on the
          // server's default, which may be influenced by session state
          socket.emit('chat:room', ROOMS.GLOBAL);

          console.log(
              '[ftl-ext-sdk] Socket connected',
              authenticated ? '(authenticated)' : '(anonymous)'
          );

          // Register any listeners that were added before connection
          for (const { event, callback } of pendingListeners) {
            socket.on(event, callback);
          }
          pendingListeners.length = 0;

          resolve(socket);
        });

        socket.on('disconnect', (reason) => {
          connected = false;
          authenticated = false;
          console.log('[ftl-ext-sdk] Socket disconnected:', reason);
        });

        socket.on('connect_error', (err) => {
          console.warn('[ftl-ext-sdk] Socket connection error:', err.message);
          if (!connected) {
            reject(err);
            connectionPromise = null;
          }
        });
      } catch (err) {
        reject(err);
        connectionPromise = null;
      }
    });

    return connectionPromise;
  }

  /**
   * Disconnect from the server and clean up.
   */
  function disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    connected = false;
    authenticated = false;
    connectionPromise = null;
    listeners.clear();
    pendingListeners.length = 0;
  }

  /**
   * Listen for a Socket.IO event from the server.
   *
   * Can be called before connect() — listeners will be queued and
   * registered once the connection is established.
   *
   * Returns an unsubscribe function.
   *
   * @param {string} eventName - The event name (use EVENTS constants)
   * @param {Function} callback - Called with the event data
   * @returns {Function} Unsubscribe function
   */
  function on(eventName, callback) {
    // Track in our own registry
    if (!listeners.has(eventName)) {
      listeners.set(eventName, new Set());
    }
    listeners.get(eventName).add(callback);

    // Register on the socket if connected, otherwise queue
    if (socket && connected) {
      socket.on(eventName, callback);
    } else {
      pendingListeners.push({ event: eventName, callback });
    }

    // Return unsubscribe function
    return () => {
      listeners.get(eventName)?.delete(callback);
      if (socket) {
        socket.off(eventName, callback);
      }
    };
  }

  /**
   * Check if the socket is currently connected.
   */
  function isConnected() {
    return connected;
  }

  /**
   * Check if the socket is authenticated (connected with a valid JWT).
   */
  function isAuthenticated() {
    return authenticated;
  }

  /**
   * Get the raw socket instance (for advanced use cases).
   * Returns null if not connected.
   */
  function getSocket() {
    return socket;
  }

  /**
   * Force the socket to disconnect and reconnect.
   * Useful as a recovery mechanism if the connection appears stale.
   * All existing event listeners are preserved across the reconnect.
   */
  function forceReconnect() {
    if (!socket) return;
    console.log('[ftl-ext-sdk] Forcing socket reconnect');
    socket.disconnect();
    // Socket.IO will automatically reconnect due to reconnection: true
    socket.connect();
  }

  /**
   * Attempt to extract the JWT auth token from the site's Supabase auth cookie.
   * Returns the access_token string or null if not found/not logged in.
   */
  function getAuthTokenFromCookie() {
    try {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, ...valueParts] = cookie.trim().split('=');
        if (name === AUTH_COOKIE_NAME$1) {
          const value = decodeURIComponent(valueParts.join('='));
          try {
            const parsed = JSON.parse(value);
            // Supabase stores { access_token, refresh_token, ... }
            return parsed.access_token || parsed.token || null;
          } catch {
            // Might be a raw token string
            return value || null;
          }
        }
      }
    } catch (e) {
      console.warn('[ftl-ext-sdk] Failed to read auth cookie:', e.message);
    }
    return null;
  }

  // ── Internal: connection factory for multi-room support ─────────────
  // Stored references to the io client and parser passed to connect(),
  // so that rooms.js can create additional connections with the same config.

  let _ioClient = null;
  let _msgpackParser = null;

  /**
   * Create a new independent socket connection to the server.
   * Uses the same io client and parser that were passed to connect().
   *
   * This is an internal API for the rooms module — not intended for
   * direct consumer use.
   *
   * @param {Object} options
   * @param {string|null|undefined} options.token - Auth token.
   *   undefined = auto-detect from cookie, null = force anonymous.
   * @returns {Object|null} Raw Socket.IO socket instance, or null if
   *   connect() hasn't been called yet
   */
  function createConnection(options = {}) {
    if (!_ioClient || !_msgpackParser) {
      console.warn('[ftl-ext-sdk] Cannot create connection — connect() has not been called yet');
      return null;
    }

    const { token = undefined } = options;

    // Resolve auth token: undefined = auto-detect, null = anonymous
    let authToken = token;
    if (authToken === undefined) {
      authToken = getAuthTokenFromCookie();
    }

    return _ioClient(SOCKET_URL, {
      parser: _msgpackParser,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      autoConnect: true,
      auth: { token: authToken || null },
    });
  }

  var socket$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    EVENTS: EVENTS,
    ROOMS: ROOMS,
    connect: connect,
    createConnection: createConnection,
    disconnect: disconnect,
    forceReconnect: forceReconnect,
    getSocket: getSocket,
    isAuthenticated: isAuthenticated,
    isConnected: isConnected,
    on: on
  });

  /**
   * core/events.js — Site Custom Events
   * 
   * The site dispatches CustomEvents on `document` for modal management.
   * Event names are camelCase: modalOpen, modalClose, modalOpenConfirm.
   */

  /**
   * All known modal names on the current site.
   */
  const MODALS = {
    CONFIRM: 'confirm',
    RENAME_CLIP: 'renameClip',
    SHARE_CLIP: 'shareClip',
    USE_ITEM: 'useItem',
    PRIZE_MACHINE: 'prizeMachine',
    TOKENS: 'tokens',
    SETTINGS: 'settings',
    SEASON_PASS: 'seasonPass',
    GIFT_SEASON_PASS: 'giftSeasonPass',
    MANAGE_POLL: 'managePoll',
    CRAFT_ITEM: 'craftItem',
    TRADE_ITEM: 'tradeItem',
    ITEM_MARKET: 'itemMarket',
    SAVE_CLIP: 'saveClip',
    GLOBAL_CHALLENGE: 'globalChallenge',
    TIP: 'tip',
    TTS: 'tts',
    SFX: 'sfx',
    FISHTOYS: 'fishtoys',
    SECRET_CODE: 'secretCode',
    EDIT_PROFILE: 'editProfile',
    CHANGE_PFP: 'changePFP',
    UPDATE_ANNOUNCEMENT: 'updateAnnouncement',
    MUTE_USER: 'muteUser',
    ADMIN: 'admin',
    HELP: 'help',
    AFTER_DARK: 'afterDark',
    BASEMENT: 'basement',
    CHANGE_CHAT_ROOM: 'changeChatRoom',
  };

  /**
   * Open a site modal by name.
   * 
   * @param {string} name - Modal name (use MODALS constants)
   * @param {Object} data - Optional data to pass to the modal
   */
  function openModal(name, data = {}) {
    document.dispatchEvent(new CustomEvent('modalOpen', {
      detail: {
        modal: name,
        data: JSON.stringify(data),
        callback: data?.callback || undefined,
      },
    }));
  }

  /**
   * Close the currently open modal.
   */
  function closeModal() {
    document.dispatchEvent(new CustomEvent('modalClose'));
  }

  /**
   * Open a confirm dialog.
   * 
   * @param {Object} data - Confirm dialog data
   * @param {Function} data.onConfirm - Called when user confirms
   * @param {Function} data.onClose - Called when dialog is closed
   */
  function openConfirmModal(data = {}) {
    document.dispatchEvent(new CustomEvent('modalOpenConfirm', {
      detail: {
        data: JSON.stringify(data),
        onConfirm: data?.onConfirm || undefined,
        onClose: data?.onClose || undefined,
      },
    }));
  }

  /**
   * Check if a modal is currently open.
   * The site gives modals id="modal".
   */
  function isModalOpen() {
    return !!document.getElementById('modal');
  }

  /**
   * Listen for modal events.
   * 
   * @param {Function} callback - Called with (action, detail)
   *   action: 'open' | 'close' | 'confirm'
   *   detail: { modal, data } for open, null for close
   * @returns {Function} Unsubscribe function
   */
  function onModalEvent(callback) {
    const onOpen = (e) => {
      try {
        callback('open', {
          modal: e.detail.modal,
          data: e.detail.data ? JSON.parse(e.detail.data) : null,
        });
      } catch {}
    };
    
    const onClose = () => callback('close', null);
    
    const onConfirm = (e) => {
      try {
        callback('confirm', {
          data: e.detail.data ? JSON.parse(e.detail.data) : null,
        });
      } catch {}
    };
    
    document.addEventListener('modalOpen', onOpen);
    document.addEventListener('modalClose', onClose);
    document.addEventListener('modalOpenConfirm', onConfirm);
    
    return () => {
      document.removeEventListener('modalOpen', onOpen);
      document.removeEventListener('modalClose', onClose);
      document.removeEventListener('modalOpenConfirm', onConfirm);
    };
  }

  /**
   * Watch for a specific modal to open.
   * Convenience wrapper around onModalEvent.
   * 
   * @param {string} modalName - Modal name to watch for
   * @param {Function} callback - Called with (modalElement, data) when the modal renders
   * @returns {Function} Unsubscribe function
   */
  function onModalOpen(modalName, callback) {
    return onModalEvent((action, detail) => {
      if (action === 'open' && detail?.modal === modalName) {
        // Wait for the modal DOM to render
        setTimeout(() => {
          const modal = document.getElementById('modal');
          if (modal) callback(modal, detail.data);
        }, 150);
      }
    });
  }

  var events = /*#__PURE__*/Object.freeze({
    __proto__: null,
    MODALS: MODALS,
    closeModal: closeModal,
    isModalOpen: isModalOpen,
    onModalEvent: onModalEvent,
    onModalOpen: onModalOpen,
    openConfirmModal: openConfirmModal,
    openModal: openModal
  });

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
  const IDS = {
    CHAT_INPUT: 'chat-input',
    MODAL: 'modal',
    LIVE_STREAM_PLAYER: 'live-stream-player',
  };

  /**
   * Known stable selectors (non-ID) that persist across site builds.
   */
  const SELECTORS = {
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
  function byId(id) {
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
  function getChatContainer() {
    const firstMessage = document.querySelector('[data-react-window-index]');
    return firstMessage?.parentElement || null;
  }

  /**
   * Find the scrollable chat wrapper (the overflow-y-auto ancestor).
   * This is the element you'd scroll or inject sibling content into.
   * 
   * @returns {HTMLElement|null}
   */
  function getChatScrollContainer() {
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
   * Get the video element from the live stream player.
   * 
   * @returns {HTMLVideoElement|null}
   */
  function getVideoElement() {
    const player = byId(IDS.LIVE_STREAM_PLAYER);
    return player?.querySelector('video') || null;
  }

  /**
   * Get all currently rendered chat message elements.
   * Note: only returns the ~17 messages currently in the DOM due to virtualisation.
   * 
   * @returns {HTMLElement[]}
   */
  function getVisibleChatMessages() {
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
  function observe(element, callback, options = {}) {
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
  function waitForElement(selector, timeout = 30000) {
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
  function inject(element, target, position = 'append', id = null) {
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
  function removeInjected(id = null) {
    const selector = id
      ? `[data-ftl-sdk="${id}"]`
      : '[data-ftl-sdk]';
    
    document.querySelectorAll(selector).forEach(el => el.remove());
  }

  var dom = /*#__PURE__*/Object.freeze({
    __proto__: null,
    IDS: IDS,
    SELECTORS: SELECTORS,
    byId: byId,
    getChatContainer: getChatContainer,
    getChatScrollContainer: getChatScrollContainer,
    getVideoElement: getVideoElement,
    getVisibleChatMessages: getVisibleChatMessages,
    inject: inject,
    observe: observe,
    removeInjected: removeInjected,
    waitForElement: waitForElement
  });

  /**
   * core/site-detect.js — Environment Detection
   *
   * Detects which version of the site we're on and provides
   * readiness checking for SDK initialisation.
   *
   * IMPORTANT: This module NEVER creates persistent body-level observers.
   * The site generates thousands of chat mutations per second — a body
   * observer with subtree:true would process every single one and
   * effectively crash the page.
   *
   * All waiting/detection uses setInterval polling instead.
   */

  /**
   * Detect which version of the site we're on.
   *
   * @returns {'current'|'classic'|'unknown'}
   */
  function getSiteVersion() {
    const host = window.location.hostname;
    if (host === 'classic.fishtank.live') return 'classic';
    if (host === 'fishtank.live' || host === 'www.fishtank.live') return 'current';
    return 'unknown';
  }

  /**
   * Check if the current page is the classic site.
   */
  function isClassic() {
    return getSiteVersion() === 'classic';
  }

  /**
   * Check if the current page is the new/current site.
   */
  function isCurrent() {
    return getSiteVersion() === 'current';
  }

  /**
   * Check if the viewport suggests a mobile device.
   */
  function isMobile() {
    return screen.width < 800;
  }

  /**
   * Check if the site appears ready for SDK use.
   * Looks for key elements that indicate the app has loaded.
   */
  function isSiteReady() {
    if (isCurrent()) {
      return (
          document.getElementById('chat-input') !== null ||
          document.querySelector('[data-react-window-index]') !== null
      );
    }

    if (isClassic()) {
      return !!document.querySelector('[class*="chat_chat__"]');
    }

    return false;
  }

  /**
   * Wait for the site to be ready, then call the callback.
   *
   * Uses setInterval polling — NOT a MutationObserver on document.body.
   * Polling at 250ms is negligible overhead compared to a body observer
   * that would fire on every DOM mutation (thousands per second on this site).
   *
   * @param {Function} callback - Called when the site is ready
   * @param {Object} options
   * @param {number} options.interval - Poll interval in ms (default 250)
   * @param {number} options.timeout - Max wait in ms (default 30000)
   * @returns {Function} Cancel function
   */
  function whenReady(callback, options = {}) {
    const { interval = 250, timeout = 30000 } = options;

    // Check immediately
    if (isSiteReady()) {
      setTimeout(callback, 0);
      return () => {};
    }

    const start = Date.now();

    const check = setInterval(() => {
      if (isSiteReady()) {
        clearInterval(check);
        callback();
      } else if (Date.now() - start > timeout) {
        clearInterval(check);
        console.warn('[ftl-ext-sdk] Site ready timeout after', timeout, 'ms.');
      }
    }, interval);

    return () => clearInterval(check);
  }

  // ---------------------------------------------------------------------------
  // Current user detection
  // ---------------------------------------------------------------------------

  let _currentUser = null;

  /**
   * CSS selector for the username element in the top bar.
   */
  const USERNAME_SELECTOR = '.fixed.top-\\[calc\\(env\\(safe-area-inset-top\\)\\/2\\)\\] .whitespace-nowrap.font-bold';

  /**
   * Read the logged-in user's display name from the top bar.
   * Returns null if not logged in or element not yet in DOM.
   */
  function _readUsernameFromDom() {
    const el = document.querySelector(USERNAME_SELECTOR);
    return el?.textContent?.trim() || null;
  }

  /**
   * Get the currently logged-in user's display name.
   * Reads from cache if available, otherwise checks the DOM once.
   * Returns null if not logged in or username not yet rendered.
   *
   * @returns {string|null}
   */
  function getCurrentUsername() {
    if (!_currentUser) _currentUser = _readUsernameFromDom();
    return _currentUser;
  }

  /**
   * Wait for the username to appear in the DOM, then call the callback.
   *
   * Uses setInterval polling — NOT a persistent body observer.
   * Checks every 500ms, gives up after timeout.
   * Once found, the username is cached and the polling stops.
   *
   * @param {Function} callback - Called with the username string
   * @param {number} timeout - Max wait in ms (default 30000)
   * @returns {Function} Cancel function
   */
  function onUserDetected(callback, timeout = 30000) {
    // Already cached
    if (_currentUser) {
      setTimeout(() => callback(_currentUser), 0);
      return () => {};
    }

    // Check DOM immediately
    const immediate = _readUsernameFromDom();
    if (immediate) {
      _currentUser = immediate;
      setTimeout(() => callback(_currentUser), 0);
      return () => {};
    }

    // Poll until found
    const start = Date.now();

    const check = setInterval(() => {
      const name = _readUsernameFromDom();
      if (name) {
        _currentUser = name;
        clearInterval(check);
        callback(_currentUser);
      } else if (Date.now() - start > timeout) {
        clearInterval(check);
        // User might not be logged in — that's fine, not an error
      }
    }, 500);

    return () => clearInterval(check);
  }

  // ---------------------------------------------------------------------------
  // Current user ID detection (via Supabase auth cookie)
  // ---------------------------------------------------------------------------
  // The site stores a Supabase JWT in a non-HttpOnly cookie that content
  // scripts can read via document.cookie. The JWT payload contains the
  // user's UUID in the `sub` field. We decode the payload (base64, no
  // verification needed) to extract it.
  //
  // The cookie may not exist immediately on page load — it's set after
  // the auth flow completes. We poll until it appears.

  const AUTH_COOKIE_NAME = 'sb-wcsaaupukpdmqdjcgaoo-auth-token';

  let _currentUserId = null;

  /**
   * Read the user ID from the Supabase auth cookie.
   * Decodes the JWT payload to extract the `sub` field.
   * Returns the user UUID string or null if not available.
   */
  function _readUserIdFromCookie() {
    try {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, ...valueParts] = cookie.trim().split('=');
        if (name === AUTH_COOKIE_NAME) {
          const value = decodeURIComponent(valueParts.join('='));

          // Cookie value is a JSON array: ["access_token", "refresh_token"]
          // or a JSON object: {access_token, refresh_token}
          let token;
          try {
            const parsed = JSON.parse(value);
            token = Array.isArray(parsed) ? parsed[0] : (parsed.access_token || parsed.token);
          } catch {
            token = value;
          }

          if (!token) return null;

          // Decode JWT payload (middle segment, base64url)
          const parts = token.split('.');
          if (parts.length !== 3) return null;

          // base64url → base64 → decode
          const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const decoded = JSON.parse(atob(payload));
          return decoded.sub || decoded.uid || null;
        }
      }
    } catch {
      // Cookie not present or malformed — user not logged in
    }
    return null;
  }

  /**
   * Get the currently logged-in user's UUID.
   * Reads from cache if available, otherwise checks the auth cookie once.
   * Returns null if not logged in or cookie not yet set.
   *
   * @returns {string|null}
   */
  function getCurrentUserId() {
    if (!_currentUserId) {
      _currentUserId = _readUserIdFromCookie();
    }
    return _currentUserId;
  }

  /**
   * Wait for the user's auth cookie to appear, then call the callback
   * with the user ID.
   *
   * Uses setInterval polling — NOT a persistent body observer.
   * Checks every 500ms, gives up after timeout.
   * Once found, the user ID is cached and the polling stops.
   *
   * @param {Function} callback - Called with the user ID string
   * @param {number} timeout - Max wait in ms (default 30000)
   * @returns {Function} Cancel function
   */
  function onUserIdDetected(callback, timeout = 30000) {
    // Already cached
    if (_currentUserId) {
      setTimeout(() => callback(_currentUserId), 0);
      return () => {};
    }

    // Check cookie immediately
    const immediate = _readUserIdFromCookie();
    if (immediate) {
      _currentUserId = immediate;
      setTimeout(() => callback(_currentUserId), 0);
      return () => {};
    }

    // Poll until found
    const start = Date.now();

    const check = setInterval(() => {
      const userId = _readUserIdFromCookie();
      if (userId) {
        _currentUserId = userId;
        clearInterval(check);
        callback(_currentUserId);
      } else if (Date.now() - start > timeout) {
        clearInterval(check);
        // User might not be logged in — that's fine, not an error
      }
    }, 500);

    return () => clearInterval(check);
  }

  var siteDetect = /*#__PURE__*/Object.freeze({
    __proto__: null,
    getCurrentUserId: getCurrentUserId,
    getCurrentUsername: getCurrentUsername,
    getSiteVersion: getSiteVersion,
    isClassic: isClassic,
    isCurrent: isCurrent,
    isMobile: isMobile,
    isSiteReady: isSiteReady,
    onUserDetected: onUserDetected,
    onUserIdDetected: onUserIdDetected,
    whenReady: whenReady
  });

  /**
   * core/storage.js — Storage Wrapper
   * 
   * Simple localStorage wrapper with JSON serialisation and error handling.
   * Works identically in browser extensions and Tampermonkey scripts.
   */

  /**
   * Default prefix for SDK storage keys.
   * Prevents collisions with the site's own localStorage usage.
   */
  const DEFAULT_PREFIX = 'ftl-sdk:';

  /**
   * Get a value from localStorage.
   * Automatically parses JSON.
   * 
   * @param {string} key - Storage key
   * @param {*} defaultValue - Returned if key doesn't exist or parsing fails
   * @param {boolean} prefixed - Whether to add the SDK prefix (default true)
   * @returns {*} Parsed value or defaultValue
   */
  function get(key, defaultValue = null, prefixed = true) {
    try {
      const fullKey = prefixed ? DEFAULT_PREFIX + key : key;
      const raw = localStorage.getItem(fullKey);
      return raw !== null ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Set a value in localStorage.
   * Automatically serialises to JSON.
   * 
   * @param {string} key - Storage key
   * @param {*} value - Value to store (must be JSON-serialisable)
   * @param {boolean} prefixed - Whether to add the SDK prefix (default true)
   * @returns {boolean} True if successful
   */
  function set(key, value, prefixed = true) {
    try {
      const fullKey = prefixed ? DEFAULT_PREFIX + key : key;
      localStorage.setItem(fullKey, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[ftl-ext-sdk] Storage write failed:', e.message);
      return false;
    }
  }

  /**
   * Remove a value from localStorage.
   * 
   * @param {string} key - Storage key
   * @param {boolean} prefixed - Whether to add the SDK prefix (default true)
   */
  function remove(key, prefixed = true) {
    const fullKey = prefixed ? DEFAULT_PREFIX + key : key;
    localStorage.removeItem(fullKey);
  }

  /**
   * Get all SDK storage keys.
   * 
   * @returns {string[]} Array of key names (without prefix)
   */
  function keys() {
    const result = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(DEFAULT_PREFIX)) {
        result.push(key.slice(DEFAULT_PREFIX.length));
      }
    }
    return result;
  }

  /**
   * Clear all SDK storage entries.
   * Only removes keys with the SDK prefix — does not affect the site's data.
   */
  function clear$1() {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(DEFAULT_PREFIX)) {
        toRemove.push(key);
      }
    }
    toRemove.forEach(key => localStorage.removeItem(key));
  }

  var storage = /*#__PURE__*/Object.freeze({
    __proto__: null,
    clear: clear$1,
    get: get,
    keys: keys,
    remove: remove,
    set: set
  });

  /**
   * chat/observer.js — DOM-Based Chat Message Observation
   *
   * Watches the chat container for new messages via MutationObserver.
   * Parses visible message elements to extract structured data.
   *
   * This approach:
   * - Works without authentication
   * - No extra network connections
   * - Only sees messages currently in the DOM (~17 at a time due to react-window)
   * - Gets text content and visual info but not internal IDs or metadata flags
   *
   * For full structured data (user IDs, medals, metadata), use the
   * Socket.IO approach in chat/messages.js instead.
   */


  // Callback registries
  const newMessageCallbacks = new Set();

  // Track which react-window indices we've already processed
  // to avoid firing callbacks for the same message twice
  const processedIndices = new Set();

  // Observer cleanup function
  let disconnectObserver$1 = null;

  // Maximum number of processed indices to remember
  // (prevents memory leak over long sessions)
  const MAX_PROCESSED = 5000;

  /**
   * Message type constants.
   */
  const MESSAGE_TYPES = {
    CHAT: 'chat',
    TTS: 'tts',
    SFX: 'sfx',
    SPECIAL: 'special',
  };

  /**
   * Parse a chat message DOM element into a structured object.
   *
   * Handles three known message formats:
   * - Regular chat messages (username + text)
   * - TTS messages (voice avatar + message bubble + from/to)
   * - SFX messages (SVG icon + sound name bubble + from/to)
   *
   * Returns null if the element can't be parsed.
   *
   * @param {HTMLElement} element - A [data-react-window-index] element
   * @returns {Object|null} Parsed message or null
   */
  function parseMessageElement(element) {
    if (!element || !element.hasAttribute('data-react-window-index')) {
      return null;
    }

    const index = element.getAttribute('data-react-window-index');

    // Detect message type based on DOM structure
    const type = detectMessageType(element);

    switch (type) {
      case MESSAGE_TYPES.TTS:
        return parseTTSMessage(element, index);
      case MESSAGE_TYPES.SFX:
        return parseSFXMessage(element, index);
      case MESSAGE_TYPES.CHAT:
        return parseChatMessage(element, index);
      default:
        return parseUnknownMessage(element, index);
    }
  }

  /**
   * Detect the message type from DOM structure.
   */
  function detectMessageType(element) {
    // TTS: has an img with src containing /images/tts/
    if (element.querySelector('img[src*="/images/tts/"]')) {
      return MESSAGE_TYPES.TTS;
    }

    // SFX: has an SVG icon (no avatar img) + the gradient bubble
    // SFX elements have an SVG as the first visual element and the gradient bubble
    if (element.querySelector('svg.text-primary') && element.querySelector('.bg-gradient-to-t')) {
      return MESSAGE_TYPES.SFX;
    }

    // Regular chat: has the .group wrapper with inline-flex username
    if (element.querySelector('.group') && element.querySelector('.inline-flex.font-bold')) {
      return MESSAGE_TYPES.CHAT;
    }

    // TTS/SFX alternate check: has the gradient bubble + from/to footer
    if (element.querySelector('.bg-gradient-to-t')) {
      // Could be TTS or SFX with a structure we haven't seen
      const hasImg = element.querySelector('img[src*="cdn.fishtank.live"]');
      return hasImg ? MESSAGE_TYPES.TTS : MESSAGE_TYPES.SFX;
    }

    return MESSAGE_TYPES.SPECIAL;
  }

  /**
   * Parse a regular chat message.
   */
  function parseChatMessage(element, index) {
    // Avatar — may be a direct CDN URL or a Next.js optimized image URL
    const avatarImg = element.querySelector('img[class*="rounded-md"]');
    const avatarUrl = extractAvatarUrl(avatarImg);

    // Level (small number overlaid on avatar)
    // It's in an absolute-positioned div near the avatar
    const avatarContainer = element.querySelector('.relative');
    const levelEl = avatarContainer?.querySelector('.absolute');
    const level = levelEl ? parseInt(levelEl.textContent, 10) || null : null;

    // Username (inline-flex, font-bold, has a style color)
    const usernameEl = element.querySelector('.inline-flex.font-bold');
    const username = usernameEl?.textContent?.trim() || null;
    const usernameColor = usernameEl?.style?.color || null;

    // Message text — the span after the username div
    // Could be font-extralight (normal), font-medium (mod), font-regular (fish), font-bold (staff)
    const messageSpan = element.querySelector('span[style*="word-break"]');
    const messageText = messageSpan?.textContent?.trim() || null;

    // Timestamp
    const timestamp = extractTimestamp(element);

    // Mentions — look inside the message span for mention elements
    const mentions = extractMentions(messageSpan);

    // Role detection via background color
    const role = detectRole(avatarUrl, element);

    // Clan tag
    const clanTag = extractClanTag();

    return {
      type: MESSAGE_TYPES.CHAT,
      index,
      username,
      usernameColor,
      message: messageText,
      timestamp,
      avatarUrl,
      level,
      role,
      clanTag,
      mentions,
      element,
    };
  }

  /**
   * Parse a TTS message.
   *
   * Structure:
   * - Voice avatar img (src contains /images/tts/{VoiceName}.png)
   * - Gradient bubble with TTS text
   * - Footer: "From {username} to {room}"
   * - Timestamp
   */
  function parseTTSMessage(element, index) {
    // Voice name from the avatar image filename
    const voiceImg = element.querySelector('img[src*="/images/tts/"]');
    const voiceSrc = voiceImg?.getAttribute('src') || '';
    const voiceMatch = voiceSrc.match(/\/images\/tts\/(.+)\.png/);
    const voice = voiceMatch ? decodeURIComponent(voiceMatch[1]) : null;

    // TTS message text (inside the gradient bubble)
    const bubble = element.querySelector('.bg-gradient-to-t');
    const message = bubble?.textContent?.trim() || null;

    // From / To in the footer
    const { from, to } = extractFromTo(element);

    // Timestamp
    const timestamp = extractTimestamp(element);

    return {
      type: MESSAGE_TYPES.TTS,
      index,
      username: from,
      usernameColor: null,
      message,
      timestamp,
      voice,
      room: to,
      avatarUrl: voiceSrc || null,
      level: null,
      role: null,
      clanTag: null,
      mentions: [],
      element,
    };
  }

  /**
   * Parse an SFX message.
   *
   * Structure:
   * - SVG icon (megaphone/speaker)
   * - Gradient bubble with sound name
   * - Footer: "From {username} to {room}"
   * - Timestamp
   */
  function parseSFXMessage(element, index) {
    // Sound name (inside the gradient bubble)
    const bubble = element.querySelector('.bg-gradient-to-t');
    const sound = bubble?.textContent?.trim() || null;

    // From / To in the footer
    const { from, to } = extractFromTo(element);

    // Timestamp
    const timestamp = extractTimestamp(element);

    return {
      type: MESSAGE_TYPES.SFX,
      index,
      username: from,
      usernameColor: null,
      message: sound,
      timestamp,
      sound,
      room: to,
      avatarUrl: null,
      level: null,
      role: null,
      clanTag: null,
      mentions: [],
      element,
    };
  }

  /**
   * Parse an unrecognised message type.
   * Extracts whatever text content is available.
   */
  function parseUnknownMessage(element, index) {
    const textContent = element.textContent?.trim() || '';
    if (!textContent) return null;

    const timestamp = extractTimestamp(element);

    return {
      type: MESSAGE_TYPES.SPECIAL,
      index,
      username: null,
      usernameColor: null,
      message: textContent,
      timestamp,
      avatarUrl: null,
      level: null,
      role: null,
      clanTag: null,
      mentions: [],
      element,
    };
  }

  /**
   * Extract the actual CDN avatar URL from an img element.
   *
   * The site uses two formats:
   * - Direct: src="https://cdn.fishtank.live/avatars/rchl.png"
   * - Next.js optimized: src="/_next/image?url=https%3A%2F%2Fcdn.fishtank.live%2Favatars%2Ftv.png&w=64&q=75"
   *
   * This extracts the original CDN URL in both cases.
   */
  function extractAvatarUrl(imgElement) {
    if (!imgElement) return null;

    const src = imgElement.getAttribute('src') || '';

    // Check for Next.js image optimization URL
    if (src.includes('/_next/image')) {
      try {
        const urlParam = new URL(src, window.location.origin).searchParams.get('url');
        return urlParam ? decodeURIComponent(urlParam) : src;
      } catch {
        // If URL parsing fails, try regex
        const match = src.match(/url=([^&]+)/);
        return match ? decodeURIComponent(match[1]) : src;
      }
    }

    // Direct CDN URL
    return src || null;
  }

  /**
   * Extract the timestamp from a message element.
   * Works for both regular messages and TTS/SFX messages.
   */
  function extractTimestamp(element) {
    // Regular messages: div with font-secondary, text-xs, text-right
    const tsEl = element.querySelector('.font-secondary.text-xs.text-right')
        || element.querySelector('.font-secondary.text-xs');
    return tsEl?.textContent?.trim() || null;
  }

  /**
   * Extract @mentions from a message element.
   *
   * Mentions are rendered as specific span elements:
   * <span class="text-link font-medium cursor-pointer" contenteditable="false">@Username</span>
   *
   * Falls back to regex matching on text content.
   */
  function extractMentions(messageElement) {
    const mentions = [];
    if (!messageElement) return mentions;

    // Primary: find actual mention span elements
    const mentionSpans = messageElement.querySelectorAll('span.text-link[contenteditable="false"]');
    if (mentionSpans.length > 0) {
      mentionSpans.forEach(span => {
        const text = span.textContent?.trim();
        if (text?.startsWith('@')) {
          mentions.push(text.slice(1)); // Remove the @
        }
      });
      return mentions;
    }

    // Fallback: regex on text content
    const textContent = messageElement.textContent || '';
    const mentionRegex = /@(\w+)/g;
    let match;
    while ((match = mentionRegex.exec(textContent)) !== null) {
      mentions.push(match[1]);
    }

    return mentions;
  }

  /**
   * Extract "From {username} to {room}" from TTS/SFX footer.
   *
   * Footer structure:
   * <div class="flex items-center translate-y-[2px]">
   *   <div class="leading-none flex gap-1 items-center text-[12px]">
   *     <div class="text-light-text/50">From</div>
   *     <div class="font-bold text-light-text">{username}</div>
   *     <button>
   *       <div class="text-light-text/50">to</div>
   *       <div class="font-medium text-light-text">{room}</div>
   *     </button>
   *   </div>
   * </div>
   */
  function extractFromTo(element) {
    let from = null;
    let to = null;

    // Find the footer area with the from/to info
    const footer = element.querySelector('.flex.items-center.translate-y-\\[2px\\]')
        || element.querySelector('.leading-none.flex.gap-1');

    if (!footer) {
      // Fallback: search for the pattern by text content
      const allDivs = element.querySelectorAll('div');
      let foundFrom = false;
      for (const div of allDivs) {
        const text = div.textContent?.trim();
        if (text === 'From') {
          foundFrom = true;
          continue;
        }
        if (foundFrom && !from && div.classList.contains('font-bold')) {
          from = text;
          continue;
        }
        if (text === 'to') {
          continue;
        }
        if (from && !to && div.classList.contains('font-medium')) {
          to = text;
          break;
        }
      }
      return { from, to };
    }

    // Direct parsing: username is in font-bold, room is in font-medium
    const fromEl = footer.querySelector('.font-bold');
    const toEl = footer.querySelector('.font-medium');

    from = fromEl?.textContent?.trim() || null;
    to = toEl?.textContent?.trim() || null;

    return { from, to };
  }

  /**
   * Detect user role based on the message wrapper's background color classes.
   *
   * This is the most reliable detection method — the site applies distinct
   * background colors to different role types:
   *
   * | Role   | Background class pattern           |
   * |--------|------------------------------------|
   * | Normal | hover:bg-white/5 (no base bg)      |
   * | Mod    | bg-blue-300/5                      |
   * | Fish   | bg-green-300/1                     |
   * | Staff  | bg-fuchsia-300/10                  |
   *
   * Falls back to avatar URL detection as a secondary signal.
   *
   * Returns 'staff', 'fish', 'mod', or null.
   */
  function detectRole(avatarUrl, element) {
    // Find the .group wrapper which carries the background color
    const wrapper = element.querySelector('.group') || element;
    const classes = wrapper.className || '';

    // Staff/Wes: fuchsia background
    if (classes.includes('bg-fuchsia-300')) {
      return 'staff';
    }

    // Mod: blue background
    if (classes.includes('bg-blue-300')) {
      return 'mod';
    }

    // Fish (contestant): green background
    if (classes.includes('bg-green-300')) {
      return 'fish';
    }

    // Fallback: avatar URL checks
    if (avatarUrl) {
      if (avatarUrl.includes('avatars/staff.png') || avatarUrl.includes('avatars/wes.png')) {
        return 'staff';
      }
    }

    return null;
  }

  /**
   * Extract clan tag from a message element.
   * TODO: refine when we see a real clan tag example in the DOM.
   */
  function extractClanTag(element) {
    return null;
  }

  /**
   * Register a callback for new chat messages observed in the DOM.
   *
   * The callback receives a parsed message object (see parseMessageElement).
   * Only fires once per unique message (tracked by react-window index).
   *
   * @param {Function} callback - Called with the parsed message object
   * @returns {Function} Unsubscribe function
   */
  function onMessage$1(callback) {
    newMessageCallbacks.add(callback);
    return () => newMessageCallbacks.delete(callback);
  }

  /**
   * Start observing the chat container for new messages.
   *
   * Uses MutationObserver on the chat container's parent (the scrollable
   * wrapper) to detect when react-window adds/removes message elements.
   *
   * Also starts a health-check interval that detects when React replaces
   * the chat container (e.g. after modal open/close re-renders). If the
   * observed container becomes detached from the DOM, the observer
   * automatically reconnects to the new container.
   *
   * @returns {boolean} True if observation started successfully
   */
  function startObserving$1() {
    if (disconnectObserver$1) {
      // Already observing
      return true;
    }

    const container = getChatContainer();
    if (!container) {
      return false;
    }

    attachObserver(container);
    startHealthCheck();

    console.log('[ftl-ext-sdk] Chat DOM observer started');
    return true;
  }

  /**
   * Stop observing the chat container and health check.
   */
  function stopObserving$1() {
    if (disconnectObserver$1) {
      disconnectObserver$1();
      disconnectObserver$1 = null;
    }
    stopHealthCheck();
    observedContainer = null;
    console.log('[ftl-ext-sdk] Chat DOM observer stopped');
  }

  /**
   * Wait for the chat container to appear, then start observing.
   *
   * Uses a short-lived body-level MutationObserver to find the chat
   * container, then immediately disconnects and switches to a targeted
   * observer on the container itself. The body observer only exists
   * until the element is found (or timeout is reached).
   *
   * @param {number} timeout - Max wait time in ms (default 30000)
   * @returns {Promise<boolean>} True if observation started successfully
   */
  async function waitAndObserve$1(timeout = 30000) {
    if (disconnectObserver$1) return true;

    // Try immediately first
    if (startObserving$1()) return true;

    // Wait for the chat container to appear
    try {
      await waitForElement(SELECTORS.CHAT_MESSAGE_ITEM, timeout);
      // Element found — now start the targeted observer
      return startObserving$1();
    } catch {
      console.warn('[ftl-ext-sdk] Chat container did not appear within', timeout, 'ms');
      return false;
    }
  }

  /**
   * Check if the observer is currently running.
   */
  function isObserving$1() {
    return disconnectObserver$1 !== null;
  }

  // ── Internal: observer attachment and health check ──────────────────

  // Reference to the container we're currently observing
  let observedContainer = null;

  // Health check interval ID
  let healthCheckInterval = null;

  /**
   * Attach the MutationObserver to a specific container element.
   */
  function attachObserver(container) {
    // Disconnect any existing observer first
    if (disconnectObserver$1) {
      disconnectObserver$1();
      disconnectObserver$1 = null;
    }

    observedContainer = container;

    // Process any messages already in the DOM
    processExistingMessages(container);

    // Watch for new child elements (react-window adding/replacing items)
    disconnectObserver$1 = observe(container, (mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue; // Skip text nodes

          // Check if this is a message element or contains message elements
          const messageElements = node.hasAttribute('data-react-window-index')
              ? [node]
              : [...node.querySelectorAll('[data-react-window-index]')];

          for (const msgEl of messageElements) {
            processMessageElement(msgEl);
          }
        }
      }
    }, { childList: true, subtree: true });
  }

  /**
   * Start the health check interval.
   * Every 2 seconds, verify the observed container is still in the live DOM.
   * If React has replaced it, reattach to the new container.
   */
  function startHealthCheck() {
    stopHealthCheck();

    healthCheckInterval = setInterval(() => {
      if (!observedContainer) return;

      // Check if our observed container is still connected to the document
      const stillConnected = observedContainer.isConnected;

      if (!stillConnected) {
        console.log('[ftl-ext-sdk] Chat container detached — reattaching observer');

        // Find the new container
        const newContainer = getChatContainer();
        if (newContainer) {
          attachObserver(newContainer);
          console.log('[ftl-ext-sdk] Chat observer reattached to new container');
        } else {
          // Container gone entirely (e.g. navigated away from chat)
          // Keep checking — it might come back
          if (disconnectObserver$1) {
            disconnectObserver$1();
            disconnectObserver$1 = null;
          }
          observedContainer = null;
        }
      }
    }, 2000);
  }

  /**
   * Stop the health check interval.
   */
  function stopHealthCheck() {
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
    }
  }

  /**
   * Process a single message element — parse it and fire callbacks.
   */
  function processMessageElement(element) {
    // Ignore elements outside the chat container — modals also use data-react-window-index
    const container = getChatContainer();
    if (container && !container.contains(element)) return;

    const index = element.getAttribute('data-react-window-index');

    // Skip if we've already processed this index
    if (processedIndices.has(index)) return;
    processedIndices.add(index);

    // Prevent memory leak — trim old indices
    if (processedIndices.size > MAX_PROCESSED) {
      const entries = [...processedIndices];
      const toRemove = entries.slice(0, entries.length - MAX_PROCESSED / 2);
      toRemove.forEach(i => processedIndices.delete(i));
    }

    // Parse the message
    const parsed = parseMessageElement(element);
    if (!parsed) return;

    // Fire callbacks
    for (const cb of newMessageCallbacks) {
      try {
        cb(parsed);
      } catch (e) {
        console.error('[ftl-ext-sdk] Chat observer callback error:', e);
      }
    }
  }

  /**
   * Process all messages currently visible in the DOM.
   * Called when observation starts to catch up on existing messages.
   */
  function processExistingMessages(container) {
    const messages = container.querySelectorAll('[data-react-window-index]');
    for (const msgEl of messages) {
      processMessageElement(msgEl);
    }
  }

  /**
   * Clear the processed indices cache.
   * Useful if you want to re-process all visible messages.
   */
  function resetProcessedCache() {
    processedIndices.clear();
  }

  /**
   * Convenience: check if a parsed message mentions a specific username.
   */
  function mentionsUser$1(msg, username) {
    if (!msg?.mentions || !username) return false;
    const lower = username.toLowerCase();
    return msg.mentions.some(m => m.toLowerCase() === lower);
  }

  /**
   * Convenience: check if a parsed message is from staff.
   */
  function isStaffMessage$1(msg) {
    return msg?.role === 'staff';
  }

  /**
   * Convenience: check if a parsed message is from a fish (contestant).
   */
  function isFishMessage$1(msg) {
    return msg?.role === 'fish';
  }

  /**
   * Convenience: check if a parsed message is from a mod.
   */
  function isModMessage$1(msg) {
    return msg?.role === 'mod';
  }

  /**
   * Convenience: check if a parsed message is a TTS message.
   */
  function isTTSMessage(msg) {
    return msg?.type === MESSAGE_TYPES.TTS;
  }

  /**
   * Convenience: check if a parsed message is an SFX message.
   */
  function isSFXMessage(msg) {
    return msg?.type === MESSAGE_TYPES.SFX;
  }

  /**
   * Convenience: check if a parsed message is a regular chat message.
   */
  function isChatMessage(msg) {
    return msg?.type === MESSAGE_TYPES.CHAT;
  }

  var observer = /*#__PURE__*/Object.freeze({
    __proto__: null,
    MESSAGE_TYPES: MESSAGE_TYPES,
    isChatMessage: isChatMessage,
    isFishMessage: isFishMessage$1,
    isModMessage: isModMessage$1,
    isObserving: isObserving$1,
    isSFXMessage: isSFXMessage,
    isStaffMessage: isStaffMessage$1,
    isTTSMessage: isTTSMessage,
    mentionsUser: mentionsUser$1,
    onMessage: onMessage$1,
    parseMessageElement: parseMessageElement,
    resetProcessedCache: resetProcessedCache,
    startObserving: startObserving$1,
    stopObserving: stopObserving$1,
    waitAndObserve: waitAndObserve$1
  });

  /**
   * chat/messages.js — Chat Message Interception (Normalised)
   *
   * Listens for chat messages, TTS, and SFX events via the SDK's
   * Socket.IO connection. Normalises raw socket data into clean,
   * consistent objects so consumers don't need to handle quirks
   * like array-wrapped messages, role flag priority, or mention
   * object formats.
   *
   * TTS and SFX events are deduplicated automatically — the socket
   * fires multiple times per event (status changes), so only the
   * first occurrence is delivered to callbacks.
   *
   * Socket listeners are registered lazily on the first callback
   * registration — no need to call startListening() manually.
   *
   * RAW DATA ACCESS:
   * Every normalised object includes a `raw` property containing
   * the original socket data for advanced use cases.
   */


  // ── Callback registries ─────────────────────────────────────────────

  const messageCallbacks = new Set();
  const ttsCallbacks = new Set();
  const sfxCallbacks = new Set();

  // ── Deduplication state ─────────────────────────────────────────────

  const recentTtsIds = new Set();
  const recentSfxKeys = new Set();
  const DEDUP_CAP = 500;

  /**
   * Add a key to a dedup set, evicting the oldest entry if over cap.
   * Returns true if the key is new, false if it was a duplicate.
   */
  function dedupAdd(set, key) {
    if (set.has(key)) return false;
    set.add(key);
    if (set.size > DEDUP_CAP) {
      const first = set.values().next().value;
      set.delete(first);
    }
    return true;
  }

  // ── Lazy listener init ──────────────────────────────────────────────

  let listenersStarted = false;

  function ensureListening() {
    if (listenersStarted) return;
    listenersStarted = true;

    // Chat messages
    on(EVENTS.CHAT_MESSAGE, (data) => {
      const normalised = normaliseChat(data);
      if (!normalised) return;
      for (const cb of messageCallbacks) {
        try { cb(normalised); }
        catch (e) { console.error('[ftl-ext-sdk] Chat message callback error:', e); }
      }
    });

    // TTS — server sends tts:insert and/or tts:update (inconsistent,
    // likely tied to approval flow). Listen on both, dedup handles overlap.
    const ttsHandler = (data) => {
      const normalised = normaliseTts(data);
      if (!normalised) return;
      for (const cb of ttsCallbacks) {
        try { cb(normalised); }
        catch (e) { console.error('[ftl-ext-sdk] TTS callback error:', e); }
      }
    };
    on(EVENTS.TTS_INSERT, ttsHandler);
    on(EVENTS.TTS_UPDATE, ttsHandler);

    // SFX — same situation: server sends sfx:insert and/or sfx:update.
    const sfxHandler = (data) => {
      const normalised = normaliseSfx(data);
      if (!normalised) return;
      for (const cb of sfxCallbacks) {
        try { cb(normalised); }
        catch (e) { console.error('[ftl-ext-sdk] SFX callback error:', e); }
      }
    };
    on(EVENTS.SFX_INSERT, sfxHandler);
    on(EVENTS.SFX_UPDATE, sfxHandler);
  }

  // ── Normalisation: Chat ─────────────────────────────────────────────

  /**
   * Normalise a raw chat:message socket event.
   *
   * Handles:
   * - Array unwrapping (socket delivers [{...}] not {...})
   * - Role priority: staff > mod > fish > grandMarshal > epic > null
   * - Avatar filename extraction from CDN URL
   * - Mention normalisation to [{displayName, userId}]
   */
  function normaliseChat(data, chatRoom = 'Global') {
    const raw = Array.isArray(data) ? data[0] : data;
    if (!raw) return null;

    // Avatar: extract filename from full CDN URL
    // "https://cdn.fishtank.live/avatars/rchl.png" → "rchl.png"
    const photoURL = raw.user?.photoURL || '';
    const avatar = photoURL.split('/').pop() || null;

    // Role priority: staff > mod > fish > grandMarshal > epic > null
    const meta = raw.metadata || {};
    const role = meta.isAdmin ? 'staff'
        : meta.isMod ? 'mod'
            : meta.isFish ? 'fish'
                : meta.isGrandMarshall ? 'grandMarshal'
                    : meta.isEpic ? 'epic'
                        : null;

    // Normalise mentions to consistent [{displayName, userId}] shape
    // Raw data sends objects: {displayName, userId}
    // But could theoretically send strings, so handle both
    const rawMentions = raw.mentions || [];
    const mentions = rawMentions.map(m => {
      if (typeof m === 'string') return { displayName: m, userId: null };
      return { displayName: m.displayName || '', userId: m.userId || null };
    });

    return {
      username:    raw.user?.displayName || '???',
      message:     raw.message || '',
      role,
      colour:      raw.user?.customUsernameColor || null,
      avatar,
      clan:        raw.user?.clan || null,
      endorsement: raw.user?.endorsement || null,
      mentions,
      chatRoom,
      raw,
    };
  }

  // ── Normalisation: TTS ──────────────────────────────────────────────

  /**
   * Normalise a raw tts:update socket event.
   * Deduplicates by TTS ID — the socket fires for each status change.
   */
  function normaliseTts(data) {
    if (!data) return null;

    const ttsId = data.id || null;
    if (ttsId && !dedupAdd(recentTtsIds, ttsId)) return null;

    return {
      username: data.displayName || '???',
      message:  data.message || '',
      voice:    data.voice || '?',
      room:     data.room || '?',
      audioId:  ttsId,
      clanTag:  data.clanTag || null,
      raw:      data,
    };
  }

  // ── Normalisation: SFX ──────────────────────────────────────────────

  /**
   * Normalise a raw sfx:update socket event.
   * Deduplicates by ID or composite key (username:sound:room).
   */
  function normaliseSfx(data) {
    if (!data) return null;

    const sfxKey = data.id || `${data.displayName}:${data.sound || data.message}:${data.room}`;
    if (!dedupAdd(recentSfxKeys, sfxKey)) return null;

    // Extract audio filename from CDN URL for slim storage
    const sfxUrl = data.url || '';
    const audioFile = sfxUrl.split('/').pop() || null;

    return {
      username:  data.displayName || '???',
      message:   data.sound || data.message || '???',
      room:      data.room || '?',
      audioFile,
      clanTag:   data.clanTag || null,
      raw:       data,
    };
  }

  // ── Public API: callback registration ───────────────────────────────

  /**
   * Register a callback for new chat messages.
   *
   * The callback receives a normalised message object:
   * {
   *   username: string,          // Display name
   *   message: string,           // Message text
   *   role: string|null,         // 'staff' | 'mod' | 'fish' | 'grandMarshal' | 'epic' | null
   *   colour: string|null,       // Custom username colour (hex)
   *   avatar: string|null,       // Avatar filename (e.g. "rchl.png")
   *   clan: string|null,         // Clan tag
   *   endorsement: string|null,  // Endorsement badge text
   *   mentions: Array<{displayName: string, userId: string|null}>,
   *   chatRoom: string,          // 'Global' | 'Season Pass' | 'Season Pass XL'
   *   raw: Object,               // Original socket data
   * }
   *
   * @param {Function} callback - Called with the normalised message
   * @returns {Function} Unsubscribe function
   */
  function onMessage(callback) {
    ensureListening();
    messageCallbacks.add(callback);
    return () => messageCallbacks.delete(callback);
  }

  /**
   * Register a callback for TTS events (deduplicated).
   *
   * The callback receives a normalised TTS object:
   * {
   *   username: string,      // Display name of sender
   *   message: string,       // TTS message text
   *   voice: string,         // Voice name (e.g. "Brainrot")
   *   room: string,          // Room code (e.g. "brrr-5")
   *   audioId: string|null,  // TTS ID (for CDN audio URL)
   *   clanTag: string|null,  // Sender's clan tag
   *   raw: Object,           // Original socket data
   * }
   *
   * @param {Function} callback - Called with the normalised TTS object
   * @returns {Function} Unsubscribe function
   */
  function onTTS(callback) {
    ensureListening();
    ttsCallbacks.add(callback);
    return () => ttsCallbacks.delete(callback);
  }

  /**
   * Register a callback for SFX events (deduplicated).
   *
   * The callback receives a normalised SFX object:
   * {
   *   username: string,       // Display name of sender
   *   message: string,        // Sound name
   *   room: string,           // Room code
   *   audioFile: string|null, // Audio filename from CDN URL
   *   clanTag: string|null,   // Sender's clan tag
   *   raw: Object,            // Original socket data
   * }
   *
   * @param {Function} callback - Called with the normalised SFX object
   * @returns {Function} Unsubscribe function
   */
  function onSFX(callback) {
    ensureListening();
    sfxCallbacks.add(callback);
    return () => sfxCallbacks.delete(callback);
  }

  // ── Convenience functions ───────────────────────────────────────────
  // These work on the normalised message objects returned by onMessage.

  /**
   * Check if a normalised message is from a fish (contestant).
   */
  function isFishMessage(msg) {
    return msg?.role === 'fish';
  }

  /**
   * Check if a normalised message is from staff/admin.
   */
  function isStaffMessage(msg) {
    return msg?.role === 'staff';
  }

  /**
   * Check if a normalised message is from a mod.
   */
  function isModMessage(msg) {
    return msg?.role === 'mod';
  }

  /**
   * Check if a normalised message is a "happening" (item use, system event).
   */
  function isHappening(msg) {
    return msg?.raw?.user?.id === 'happening';
  }

  /**
   * Check if a normalised message mentions a specific username.
   *
   * @param {Object} msg - Normalised message from onMessage
   * @param {string} username - Username to check for (case-insensitive)
   * @returns {boolean}
   */
  function mentionsUser(msg, username) {
    if (!msg?.mentions || !username) return false;
    const lower = username.toLowerCase();
    return msg.mentions.some(m => m.displayName.toLowerCase() === lower);
  }

  // ── Deprecated ──────────────────────────────────────────────────────

  /**
   * @deprecated Listeners now start automatically when callbacks are
   * registered. This function is a no-op kept for backwards compatibility.
   */
  function startListening() {
    ensureListening();
  }

  // ── Internal: dispatch functions for multi-room support ─────────────
  // These allow rooms.js to feed events from additional sockets through
  // the same normalisation pipeline and callback registry. Not intended
  // for direct consumer use.

  /**
   * Normalise and dispatch a raw chat:message event from a room socket.
   * @param {*} data - Raw socket event data
   * @param {string} chatRoom - Room name (e.g. 'Season Pass')
   */
  function _dispatchChat(data, chatRoom) {
    const normalised = normaliseChat(data, chatRoom);
    if (!normalised) return;
    for (const cb of messageCallbacks) {
      try { cb(normalised); }
      catch (e) { console.error('[ftl-ext-sdk] Chat message callback error:', e); }
    }
  }

  /**
   * Normalise and dispatch a raw tts event from a room socket.
   * @param {*} data - Raw socket event data
   */
  function _dispatchTts(data) {
    const normalised = normaliseTts(data);
    if (!normalised) return;
    for (const cb of ttsCallbacks) {
      try { cb(normalised); }
      catch (e) { console.error('[ftl-ext-sdk] TTS callback error:', e); }
    }
  }

  /**
   * Normalise and dispatch a raw sfx event from a room socket.
   * @param {*} data - Raw socket event data
   */
  function _dispatchSfx(data) {
    const normalised = normaliseSfx(data);
    if (!normalised) return;
    for (const cb of sfxCallbacks) {
      try { cb(normalised); }
      catch (e) { console.error('[ftl-ext-sdk] SFX callback error:', e); }
    }
  }

  var messages = /*#__PURE__*/Object.freeze({
    __proto__: null,
    _dispatchChat: _dispatchChat,
    _dispatchSfx: _dispatchSfx,
    _dispatchTts: _dispatchTts,
    isFishMessage: isFishMessage,
    isHappening: isHappening,
    isModMessage: isModMessage,
    isStaffMessage: isStaffMessage,
    mentionsUser: mentionsUser,
    onMessage: onMessage,
    onSFX: onSFX,
    onTTS: onTTS,
    startListening: startListening
  });

  /**
   * chat/rooms.js — Multi-Room Chat Subscription
   *
   * Manages additional socket connections for monitoring chat rooms
   * beyond the default Global room. Each subscribed room gets its own
   * independent Socket.IO connection that emits `chat:room` to switch
   * the server's message feed.
   *
   * Messages from all room sockets are funnelled through the same
   * normalisation pipeline in chat/messages.js, so consumers using
   * onMessage/onTTS/onSFX receive events from all subscribed rooms
   * transparently. Each normalised chat message includes a `chatRoom`
   * field indicating which room it came from.
   *
   * The primary socket (from socket.connect()) always handles Global.
   * This module only manages the additional room connections.
   *
   * Usage:
   *   import { chat } from 'ftl-ext-sdk';
   *
   *   // After socket.connect()...
   *   chat.rooms.subscribe('Season Pass');
   *   chat.rooms.subscribe('Season Pass XL');
   *
   *   // Messages from all rooms now flow through chat.messages.onMessage()
   *   // Each message has msg.chatRoom: 'Global' | 'Season Pass' | 'Season Pass XL'
   *
   *   chat.rooms.unsubscribe('Season Pass XL');
   *   chat.rooms.getSubscribed();  // ['Season Pass']
   *   chat.rooms.unsubscribeAll();
   */


  // ── State ───────────────────────────────────────────────────────────

  // Active room connections: roomName → { socket, connected }
  const roomSockets = new Map();

  /**
   * All subscribable room names (excluding Global, which is always active
   * on the primary socket).
   */
  const EXTRA_ROOMS = [ROOMS.SEASON_PASS, ROOMS.SEASON_PASS_XL];

  // ── Public API ──────────────────────────────────────────────────────

  /**
   * Subscribe to a chat room. Opens a new socket connection and emits
   * `chat:room` to start receiving that room's messages.
   *
   * Messages will flow through the existing chat.messages.onMessage(),
   * onTTS(), and onSFX() callbacks with the `chatRoom` field set.
   *
   * No-op if already subscribed to this room. No-op for 'Global'
   * (always handled by the primary socket).
   *
   * @param {string} roomName - Room to subscribe to (use ROOMS constants)
   * @returns {Promise<boolean>} True if subscription succeeded
   */
  async function subscribe(roomName) {
    // Global is always on the primary socket
    if (roomName === ROOMS.GLOBAL) {
      console.warn('[ftl-ext-sdk] Global room is always active on the primary socket');
      return true;
    }

    // Already subscribed
    if (roomSockets.has(roomName)) return true;

    const socket = createConnection({ token: null });
    if (!socket) {
      console.warn(`[ftl-ext-sdk] Cannot subscribe to "${roomName}" — primary socket not connected yet`);
      return false;
    }

    const entry = { socket, connected: false };
    roomSockets.set(roomName, entry);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn(`[ftl-ext-sdk] Room "${roomName}" connection timed out`);
        cleanup(roomName);
        resolve(false);
      }, 10000);

      socket.on('connect', () => {
        entry.connected = true;
        clearTimeout(timeout);

        // Subscribe to the room
        socket.emit('chat:room', roomName);

        // Wire up event listeners that dispatch through messages.js
        wireRoomListeners(socket, roomName);

        console.log(`[ftl-ext-sdk] Subscribed to room: ${roomName}`);
        resolve(true);
      });

      socket.on('disconnect', (reason) => {
        entry.connected = false;
        console.log(`[ftl-ext-sdk] Room "${roomName}" disconnected: ${reason}`);
      });

      // Handle reconnection — re-emit chat:room after reconnect
      socket.io.on('reconnect', () => {
        entry.connected = true;
        socket.emit('chat:room', roomName);
        console.log(`[ftl-ext-sdk] Room "${roomName}" reconnected, re-subscribed`);
      });

      socket.on('connect_error', (err) => {
        if (!entry.connected) {
          clearTimeout(timeout);
          console.warn(`[ftl-ext-sdk] Room "${roomName}" connection error: ${err.message}`);
          cleanup(roomName);
          resolve(false);
        }
      });
    });
  }

  /**
   * Unsubscribe from a chat room. Disconnects and removes the socket.
   *
   * @param {string} roomName - Room to unsubscribe from
   */
  function unsubscribe(roomName) {
    cleanup(roomName);
  }

  /**
   * Subscribe to all extra rooms (Season Pass + Season Pass XL).
   *
   * @returns {Promise<Object>} Map of room name → success boolean
   */
  async function subscribeAll() {
    const results = {};
    for (const room of EXTRA_ROOMS) {
      results[room] = await subscribe(room);
    }
    return results;
  }

  /**
   * Unsubscribe from all extra rooms.
   */
  function unsubscribeAll() {
    for (const roomName of [...roomSockets.keys()]) {
      cleanup(roomName);
    }
  }

  /**
   * Get a list of currently subscribed extra room names.
   * Does not include Global (always active on primary socket).
   *
   * @returns {string[]}
   */
  function getSubscribed() {
    return [...roomSockets.keys()];
  }

  /**
   * Check if a specific room is currently subscribed.
   *
   * @param {string} roomName
   * @returns {boolean}
   */
  function isSubscribed(roomName) {
    return roomSockets.has(roomName);
  }

  // ── Internal ────────────────────────────────────────────────────────

  /**
   * Wire up event listeners on a room socket that dispatch through
   * the messages.js normalisation pipeline.
   */
  function wireRoomListeners(socket, roomName) {
    // Chat messages — dispatch with the room name
    socket.on(EVENTS.CHAT_MESSAGE, (data) => {
      _dispatchChat(data, roomName);
    });

    // TTS — listen on both insert and update, dedup handles overlap
    const ttsHandler = (data) => _dispatchTts(data);
    socket.on(EVENTS.TTS_INSERT, ttsHandler);
    socket.on(EVENTS.TTS_UPDATE, ttsHandler);

    // SFX — same pattern
    const sfxHandler = (data) => _dispatchSfx(data);
    socket.on(EVENTS.SFX_INSERT, sfxHandler);
    socket.on(EVENTS.SFX_UPDATE, sfxHandler);
  }

  /**
   * Clean up a room subscription — disconnect and remove from state.
   */
  function cleanup(roomName) {
    const entry = roomSockets.get(roomName);
    if (!entry) return;

    try {
      entry.socket.disconnect();
    } catch {}

    roomSockets.delete(roomName);
    console.log(`[ftl-ext-sdk] Unsubscribed from room: ${roomName}`);
  }

  var rooms = /*#__PURE__*/Object.freeze({
    __proto__: null,
    EXTRA_ROOMS: EXTRA_ROOMS,
    ROOMS: ROOMS,
    getSubscribed: getSubscribed,
    isSubscribed: isSubscribed,
    subscribe: subscribe,
    subscribeAll: subscribeAll,
    unsubscribe: unsubscribe,
    unsubscribeAll: unsubscribeAll
  });

  /**
   * chat/input.js — Chat Input Helpers
   * 
   * Provides methods for interacting with the chat input field.
   * Handles the Slate-based contenteditable editor the site uses.
   */


  /**
   * Get the chat input element.
   * 
   * @returns {HTMLElement|null}
   */
  function getInputElement() {
    return byId(IDS.CHAT_INPUT);
  }

  /**
   * Focus the chat input and move the cursor to the end.
   * 
   * @returns {boolean} True if successful
   */
  function focus() {
    const el = getInputElement();
    if (!el) return false;
    
    el.focus();
    
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false); // Collapse to end
    sel.removeAllRanges();
    sel.addRange(range);
    
    return true;
  }

  /**
   * Insert text into the chat input at the current cursor position.
   * Uses InputEvent for Slate editor compatibility.
   * 
   * @param {string} text - Text to insert
   * @returns {boolean} True if successful
   */
  function insertText(text) {
    const el = getInputElement();
    if (!el) return false;
    
    // Focus first
    focus();
    
    // Use InputEvent for Slate compatibility
    el.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      data: text,
      inputType: 'insertText',
    }));
    
    el.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      data: text,
      inputType: 'insertText',
    }));
    
    return true;
  }

  /**
   * Insert a @mention into the chat input.
   * Adds a space after the mention for convenience.
   * 
   * @param {string} username - Username to mention (without @)
   * @returns {boolean} True if successful
   */
  function mentionUser(username) {
    return insertText(`@${username} `);
  }

  /**
   * Clear the chat input.
   * 
   * @returns {boolean} True if successful
   */
  function clear() {
    const el = getInputElement();
    if (!el) return false;
    
    el.focus();
    
    // Select all content
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    
    // Delete it
    el.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'deleteContentBackward',
    }));
    
    el.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'deleteContentBackward',
    }));
    
    return true;
  }

  /**
   * Get the current text content of the chat input.
   * 
   * @returns {string|null}
   */
  function getText() {
    const el = getInputElement();
    return el?.textContent?.trim() || null;
  }

  var input = /*#__PURE__*/Object.freeze({
    __proto__: null,
    clear: clear,
    focus: focus,
    getInputElement: getInputElement,
    getText: getText,
    insertText: insertText,
    mentionUser: mentionUser
  });

  /**
   * chat/index.js — Chat Module Entry Point
   *
   * Three sub-modules:
   *
   * - observer: DOM-based, no auth needed, lightweight, sees ~17 visible messages
   * - messages: Socket.IO-based, normalised data, sees ALL messages with deduplication
   * - rooms: Multi-room support, subscribe to Season Pass / XL rooms
   * - input: Chat input field helpers
   *
   * Use observer for simple extensions that just need to react to visible messages.
   * Use messages for comprehensive logging that can't afford to miss anything.
   * Use rooms to monitor additional chat rooms beyond Global.
   */

  var index$2 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    input: input,
    messages: messages,
    observer: observer,
    rooms: rooms
  });

  /**
   * player/streams.js — Live Stream Detection & Room Names
   * 
   * Helpers for detecting which stream is playing, and resolving
   * room codes (e.g. "brrr-5") to human-readable names (e.g. "Bar").
   * 
   * Room names are fetched from the live-streams API and cached
   * in localStorage. The cache is merged (not replaced) so that
   * room names from previous seasons persist for historical log entries.
   */


  const LIVE_STREAMS_API = 'https://api.fishtank.live/v1/live-streams';
  const ROOM_CACHE_KEY = 'room-names';

  // In-memory map: room ID → display name
  let roomMap = {};

  /**
   * Check if a live stream player is currently visible.
   * 
   * @returns {boolean}
   */
  function isPlayerOpen() {
    return !!byId(IDS.LIVE_STREAM_PLAYER);
  }

  /**
   * Get the live stream player element.
   * 
   * @returns {HTMLElement|null}
   */
  function getPlayerElement() {
    return byId(IDS.LIVE_STREAM_PLAYER);
  }

  /**
   * Fetch room names from the live-streams API and update the cache.
   * 
   * Merges new data into the existing cache so that names from
   * previous seasons are preserved (for old log entries).
   * 
   * Call once on startup. Non-blocking — if the API fails,
   * cached names are still available and raw codes are shown
   * for any uncached rooms.
   * 
   * @returns {Promise<void>}
   */
  function fetchRoomNames() {
    // Load cached names first so they're available immediately
    const cached = get(ROOM_CACHE_KEY, {});
    roomMap = { ...cached };

    return fetch(LIVE_STREAMS_API)
      .then(r => r.json())
      .then(data => {
        const streams = data.liveStreams || [];
        for (const stream of streams) {
          if (stream.id && stream.name) {
            roomMap[stream.id] = stream.name;
          }
        }
        // Persist merged map (old + new names)
        set(ROOM_CACHE_KEY, roomMap);
      })
      .catch(() => {
        // API failed — cached names are still in roomMap
      });
  }

  /**
   * Convert a room code like "brrr-5" to a human-readable name like "Bar".
   * 
   * Returns the original code if no match is found (API not loaded
   * yet, or room not in cache).
   * 
   * @param {string} code - Room ID from socket data (e.g. "brrr-5")
   * @returns {string} Human-readable room name
   */
  function roomName(code) {
    if (!code) return '?';
    return roomMap[code] || code;
  }

  /**
   * Get the full room map (for debugging or advanced use).
   * 
   * @returns {Object} Map of room ID → display name
   */
  function getRoomMap() {
    return { ...roomMap };
  }

  var streams = /*#__PURE__*/Object.freeze({
    __proto__: null,
    fetchRoomNames: fetchRoomNames,
    getPlayerElement: getPlayerElement,
    getRoomMap: getRoomMap,
    isPlayerOpen: isPlayerOpen,
    roomName: roomName
  });

  /**
   * player/video.js — Video Element Helpers
   * 
   * Provides access to the video element and common video operations.
   */


  /**
   * Get the video element.
   * 
   * @returns {HTMLVideoElement|null}
   */
  function getElement() {
    return getVideoElement();
  }

  /**
   * Toggle fullscreen on the video element.
   * 
   * @returns {boolean} True if action was taken
   */
  function toggleFullscreen() {
    const video = getVideoElement();
    if (!video) return false;
    
    const fsElement = document.fullscreenElement
      || document.webkitFullscreenElement
      || document.mozFullScreenElement;
    
    if (fsElement === video) {
      // Exit fullscreen
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
    } else {
      // Enter fullscreen
      if (video.requestFullscreen) video.requestFullscreen();
      else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
      else if (video.mozRequestFullScreen) video.mozRequestFullScreen();
    }
    
    return true;
  }

  /**
   * Check if the video is currently in fullscreen.
   * 
   * @returns {boolean}
   */
  function isFullscreen() {
    const video = getVideoElement();
    if (!video) return false;
    
    const fsElement = document.fullscreenElement
      || document.webkitFullscreenElement
      || document.mozFullScreenElement;
    
    return fsElement === video;
  }

  var video = /*#__PURE__*/Object.freeze({
    __proto__: null,
    getElement: getElement,
    isFullscreen: isFullscreen,
    toggleFullscreen: toggleFullscreen
  });

  /**
   * player/index.js — Player Module Entry Point
   */

  var index$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    streams: streams,
    video: video
  });

  /**
   * ui/keyboard.js — Keyboard Shortcut Registration
   * 
   * Provides a clean API for registering keyboard shortcuts that
   * automatically skip when the user is typing in input fields.
   */

  const shortcuts = new Map();
  let listenerAttached = false;

  /**
   * Register a keyboard shortcut.
   * 
   * @param {string} id - Unique identifier for this shortcut
   * @param {Object} options - Shortcut configuration
   * @param {string} options.key - The key to listen for (e.g. 'e', 'F', 'Escape')
   * @param {boolean} options.ctrl - Require Ctrl key (default false)
   * @param {boolean} options.alt - Require Alt key (default false)
   * @param {boolean} options.shift - Require Shift key (default false)
   * @param {boolean} options.meta - Require Meta/Cmd key (default false)
   * @param {boolean} options.skipInputs - Don't fire when user is typing (default true)
   * @param {boolean} options.preventDefault - Prevent default browser action (default true)
   * @param {boolean} options.stopPropagation - Stop event from reaching other handlers (default false)
   * @param {Function} callback - Called when the shortcut is triggered
   * @returns {Function} Unregister function
   */
  function register(id, options, callback) {
    if (!listenerAttached) attachListener();
    
    shortcuts.set(id, {
      key: options.key.toLowerCase(),
      ctrl: options.ctrl || false,
      alt: options.alt || false,
      shift: options.shift || false,
      meta: options.meta || false,
      skipInputs: options.skipInputs !== false,
      preventDefault: options.preventDefault !== false,
      stopPropagation: options.stopPropagation || false,
      callback,
    });
    
    return () => shortcuts.delete(id);
  }

  /**
   * Remove a keyboard shortcut by ID.
   * 
   * @param {string} id - Shortcut ID to remove
   */
  function unregister(id) {
    shortcuts.delete(id);
  }

  /**
   * Remove all registered shortcuts.
   */
  function unregisterAll() {
    shortcuts.clear();
  }

  /**
   * Get all registered shortcut IDs.
   * 
   * @returns {string[]}
   */
  function getRegistered() {
    return [...shortcuts.keys()];
  }

  /**
   * Check if the user is currently focused on a text input.
   * 
   * @returns {boolean}
   */
  function isUserTyping() {
    const active = document.activeElement;
    if (!active) return false;
    
    return (
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.isContentEditable ||
      active.getAttribute('role') === 'textbox'
    );
  }

  /**
   * Attach the global keydown listener.
   * Called once on first shortcut registration.
   */
  function attachListener() {
    document.addEventListener('keydown', (e) => {
      for (const [id, shortcut] of shortcuts) {
        // Skip if user is typing and shortcut respects inputs
        if (shortcut.skipInputs && isUserTyping()) continue;
        
        // Check the key matches
        if (e.key.toLowerCase() !== shortcut.key) continue;
        
        // Check required modifiers are pressed
        if (shortcut.ctrl && !e.ctrlKey) continue;
        if (shortcut.alt && !e.altKey) continue;
        if (shortcut.shift && !e.shiftKey) continue;
        if (shortcut.meta && !e.metaKey) continue;
        
        // Check non-required modifiers are NOT pressed
        if (!shortcut.ctrl && e.ctrlKey) continue;
        if (!shortcut.alt && e.altKey) continue;
        if (!shortcut.shift && e.shiftKey) continue;
        if (!shortcut.meta && e.metaKey) continue;
        
        // Match found
        if (shortcut.preventDefault) e.preventDefault();
        if (shortcut.stopPropagation) e.stopImmediatePropagation();
        
        try {
          shortcut.callback(e);
        } catch (err) {
          console.error(`[ftl-ext-sdk] Shortcut "${id}" error:`, err);
        }
      }
    });
    
    listenerAttached = true;
  }

  var keyboard = /*#__PURE__*/Object.freeze({
    __proto__: null,
    getRegistered: getRegistered,
    register: register,
    unregister: unregister,
    unregisterAll: unregisterAll
  });

  /**
   * ui/modals.js — Modal Helpers
   * 
   * High-level modal utilities built on top of core/events.js.
   * Provides convenient patterns for opening, observing, and
   * injecting content into the site's modal system.
   */


  /**
   * Open a modal and wait for it to render in the DOM.
   * Returns a promise that resolves with the modal element.
   * 
   * @param {string} name - Modal name (use MODALS constants)
   * @param {Object} data - Optional data to pass to the modal
   * @param {number} timeout - Max wait time in ms (default 2000)
   * @returns {Promise<HTMLElement>} The modal element
   */
  async function openAndWait(name, data = {}, timeout = 2000) {
    openModal(name, data);
    return waitForElement('#modal', timeout);
  }

  /**
   * Inject a DOM element into the current modal.
   * 
   * @param {HTMLElement|string} content - Element or HTML string to inject
   * @param {Object} options
   * @param {string} options.position - Where to inject: 'append' (default), 'prepend', 'replace'
   * @param {string} options.id - Optional ID for the injection (for later removal)
   * @returns {boolean} True if injection succeeded
   */
  function injectIntoModal(content, options = {}) {
    const { position = 'append', id = null } = options;
    
    const modal = document.getElementById('modal');
    if (!modal) return false;
    
    // Create the element to inject
    let element;
    if (typeof content === 'string') {
      element = document.createElement('div');
      element.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      element = content;
    } else {
      return false;
    }
    
    // Tag it for identification
    if (id) element.setAttribute('data-ftl-sdk', id);
    
    // Find the modal content area
    // The modal structure is: fixed container > backdrop + motion.div > Panel > content
    // We look for the innermost scrollable/content container
    const contentArea = modal.querySelector('.overflow-y-auto') || modal;
    
    switch (position) {
      case 'replace':
        contentArea.innerHTML = '';
        contentArea.appendChild(element);
        break;
      case 'prepend':
        contentArea.insertBefore(element, contentArea.firstChild);
        break;
      case 'append':
      default:
        contentArea.appendChild(element);
        break;
    }
    
    return true;
  }

  /**
   * Wait for a modal to close.
   * Returns a promise that resolves when the modal is gone.
   * 
   * @param {number} timeout - Max wait time in ms (default 30000)
   * @returns {Promise<void>}
   */
  function waitForClose(timeout = 30000) {
    return new Promise((resolve, reject) => {
      if (!isModalOpen()) return resolve();
      
      const timer = setTimeout(() => {
        unsub();
        reject(new Error('[ftl-ext-sdk] Modal close timeout'));
      }, timeout);
      
      const unsub = onModalEvent((action) => {
        if (action === 'close') {
          clearTimeout(timer);
          unsub();
          resolve();
        }
      });
    });
  }

  var modals = /*#__PURE__*/Object.freeze({
    __proto__: null,
    MODALS: MODALS,
    closeModal: closeModal,
    injectIntoModal: injectIntoModal,
    isModalOpen: isModalOpen,
    onModalEvent: onModalEvent,
    onModalOpen: onModalOpen,
    openAndWait: openAndWait,
    openModal: openModal,
    waitForClose: waitForClose
  });

  /**
   * ui/toasts.js — Toast Notifications
   *
   * Creates a toast notification system that visually matches the site's
   * own Sonner toasts. Positioned bottom-center to match the site's
   * toast placement.
   *
   * We can't inject into Sonner's toaster because it doesn't render
   * its <ol> container until the first real toast is triggered. Instead
   * we create our own container with matching styling.
   */

  // Icon SVGs for toast types
  const ICONS = {
    default: `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" height="28" width="28" xmlns="http://www.w3.org/2000/svg"><path d="M256 56C145.72 56 56 145.72 56 256s89.72 200 200 200 200-89.72 200-200S366.28 56 256 56zm0 82a26 26 0 1 1-26 26 26 26 0 0 1 26-26zm48 226h-88a16 16 0 0 1 0-32h28v-88h-16a16 16 0 0 1 0-32h32a16 16 0 0 1 16 16v104h28a16 16 0 0 1 0 32z"></path></svg>`,
    success: `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" height="28" width="28" xmlns="http://www.w3.org/2000/svg"><path d="M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208 208-93.31 208-208S370.69 48 256 48zm108.25 138.29-134.4 160a16 16 0 0 1-12 5.71h-.27a16 16 0 0 1-11.89-5.3l-57.6-64a16 16 0 1 1 23.78-21.4l45.29 50.32 122.59-145.91a16 16 0 0 1 24.5 20.58z"></path></svg>`,
    error: `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" height="28" width="28" xmlns="http://www.w3.org/2000/svg"><path d="M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208 208-93.31 208-208S370.69 48 256 48zm75.31 260.69a16 16 0 1 1-22.62 22.62L256 278.63l-52.69 52.68a16 16 0 0 1-22.62-22.62L233.37 256l-52.68-52.69a16 16 0 0 1 22.62-22.62L256 233.37l52.69-52.68a16 16 0 0 1 22.62 22.62L278.63 256z"></path></svg>`,
    info: `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" height="28" width="28" xmlns="http://www.w3.org/2000/svg"><path d="M256 56C145.72 56 56 145.72 56 256s89.72 200 200 200 200-89.72 200-200S366.28 56 256 56zm0 82a26 26 0 1 1-26 26 26 26 0 0 1 26-26zm48 226h-88a16 16 0 0 1 0-32h28v-88h-16a16 16 0 0 1 0-32h32a16 16 0 0 1 16 16v104h28a16 16 0 0 1 0 32z"></path></svg>`,
  };

  const ICON_COLOURS = {
    default: 'text-primary',
    success: 'text-green-500',
    error: 'text-red-500',
    info: 'text-primary',
  };

  let container = null;
  let styleInjected = false;

  /**
   * Inject animation styles.
   */
  function injectStyles() {
    if (styleInjected) return;
    const style = document.createElement('style');
    style.id = 'ftl-ext-toast-styles';
    style.textContent = `
    #ftl-ext-toasts {
      position: fixed;
      bottom: 96px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      flex-direction: column-reverse;
      align-items: center;
      gap: 8px;
      pointer-events: none;
    }
    @media (max-width: 1023px) {
      #ftl-ext-toasts {
        bottom: 64px;
      }
    }
    .ftl-ext-toast {
      pointer-events: auto;
      animation: ftl-ext-toast-in 0.3s ease forwards;
    }
    .ftl-ext-toast-out {
      animation: ftl-ext-toast-out 0.3s ease forwards;
    }
    @keyframes ftl-ext-toast-in {
      from { opacity: 0; transform: translateY(16px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes ftl-ext-toast-out {
      from { opacity: 1; transform: translateY(0) scale(1); }
      to { opacity: 0; transform: translateY(16px) scale(0.95); }
    }
  `;
    document.head.appendChild(style);
    styleInjected = true;
  }

  /**
   * Ensure the toast container exists.
   */
  function ensureContainer() {
    if (container && document.body.contains(container)) return;
    injectStyles();
    container = document.createElement('div');
    container.id = 'ftl-ext-toasts';
    document.body.appendChild(container);
  }

  /**
   * Show a toast notification.
   *
   * @param {string} title - Toast title
   * @param {Object} options
   * @param {string} options.description - Optional description text
   * @param {number} options.duration - Display duration in ms (default 5000)
   * @param {'default'|'success'|'error'|'info'} options.type - Toast style
   * @param {string} options.id - Optional ID (prevents duplicate toasts)
   * @returns {string} Toast ID
   */
  function notify(title, options = {}) {
    const {
      description = '',
      duration = 5000,
      type = 'default',
      id = `ftl-ext-${Date.now()}`,
    } = options;

    ensureContainer();

    // Prevent duplicates
    if (container.querySelector(`[data-ftl-toast-id="${id}"]`)) return id;

    const icon = ICONS[type] || ICONS.default;
    const iconColour = ICON_COLOURS[type] || ICON_COLOURS.default;

    const toast = document.createElement('div');
    toast.className = 'ftl-ext-toast';
    toast.setAttribute('data-ftl-toast-id', id);

    toast.innerHTML = `
    <div class="relative flex rounded-lg shadow-lg ring-1 items-center p-4 font-sans bg-light [background-image:var(--texture-panel)] ring-dark-300/95" style="width: 368px; max-width: calc(100vw - 32px);">
      <div class="flex items-start m-auto mr-2 drop-shadow-[1px_1px_0_#00000025] ${iconColour}">
        ${icon}
      </div>
      <div class="flex flex-1 items-center">
        <div class="w-full">
          <p class="text-lg font-medium leading-5 text-dark-text">${escapeHtml(title)}</p>
          ${description ? `<p class="mt-1 text-sm leading-4 text-dark-text-400">${escapeHtml(description)}</p>` : ''}
        </div>
      </div>
      <button class="absolute top-0 right-0 p-3 cursor-pointer z-1 text-dark-text/50 hover:text-dark-text" data-ftl-dismiss="${id}">
        <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M400 145.49 366.51 112 256 222.51 145.49 112 112 145.49 222.51 256 112 366.51 145.49 400 256 289.49 366.51 400 400 366.51 289.49 256 400 145.49z"></path></svg>
      </button>
    </div>
  `;

    // Dismiss on X click
    toast.querySelector(`[data-ftl-dismiss="${id}"]`)?.addEventListener('click', () => dismiss(id));

    container.appendChild(toast);

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }

    return id;
  }

  /**
   * Dismiss a toast by ID.
   */
  function dismiss(id) {
    if (!container) return;

    const toast = container.querySelector(`[data-ftl-toast-id="${id}"]`);
    if (!toast) return;

    toast.classList.add('ftl-ext-toast-out');
    toast.classList.remove('ftl-ext-toast');
    setTimeout(() => toast.remove(), 300);
  }

  /**
   * Escape HTML to prevent XSS in toast content.
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  var toasts = /*#__PURE__*/Object.freeze({
    __proto__: null,
    dismiss: dismiss,
    notify: notify
  });

  /**
   * ui/toast-observer.js — Site Toast Observation
   * 
   * The new site uses Sonner (https://sonner.emilkowal.dev/) for toast
   * notifications. Toasts are <li> elements with data-sonner-toast attribute.
   * 
   * This module observes for new toasts appearing in the DOM and parses
   * their content — useful for logging admin messages, item notifications, etc.
   */


  const toastCallbacks = new Set();
  const processedToasts = new WeakSet();
  let disconnectObserver = null;

  /**
   * Parse a Sonner toast element into a structured object.
   * 
   * Toast structure:
   * <li data-sonner-toast>
   *   <div data-content>
   *     <div data-title>
   *       <div class="relative flex rounded-lg ...">
   *         [optional image div]
   *         <div class="flex flex-1 items-center">
   *           <p class="text-lg ...">Title</p>
   *           <p class="mt-1 text-sm ...">Description</p>
   *         </div>
   *       </div>
   *     </div>
   *   </div>
   * </li>
   * 
   * @param {HTMLElement} toastElement - A [data-sonner-toast] element
   * @returns {Object|null} Parsed toast or null
   */
  function parseToastElement(toastElement) {
    if (!toastElement || !toastElement.hasAttribute('data-sonner-toast')) {
      return null;
    }
    
    // Find the content paragraphs
    const paragraphs = toastElement.querySelectorAll('p');
    if (paragraphs.length === 0) return null;
    
    const title = paragraphs[0]?.textContent?.trim() || null;
    const description = paragraphs.length > 1
      ? paragraphs[1]?.textContent?.trim() || null
      : null;
    
    // Check for an image (item notifications have one)
    const img = toastElement.querySelector('img');
    const imageUrl = img ? extractImageUrl(img) : null;
    const imageAlt = img?.getAttribute('alt') || null;
    
    // Extract position info
    const yPosition = toastElement.getAttribute('data-y-position') || null;
    const xPosition = toastElement.getAttribute('data-x-position') || null;
    
    return {
      title,
      description,
      imageUrl,
      imageAlt,
      position: { x: xPosition, y: yPosition },
      timestamp: Date.now(),
      element: toastElement,
    };
  }

  /**
   * Extract image URL, handling Next.js image optimization.
   */
  function extractImageUrl(imgElement) {
    const src = imgElement?.getAttribute('src') || '';
    
    if (src.includes('/_next/image')) {
      try {
        const urlParam = new URL(src, window.location.origin).searchParams.get('url');
        return urlParam ? decodeURIComponent(urlParam) : src;
      } catch {
        const match = src.match(/url=([^&]+)/);
        return match ? decodeURIComponent(match[1]) : src;
      }
    }
    
    return src || null;
  }

  /**
   * Register a callback for new site toast notifications.
   * 
   * The callback receives a parsed toast object:
   * {
   *   title: string,           // e.g. "You found an item!"
   *   description: string,     // e.g. "Tip Jar was added to your inventory."
   *   imageUrl: string|null,   // CDN URL if toast has an image
   *   imageAlt: string|null,   // Image alt text (often the item name)
   *   position: { x, y },     // Toast position
   *   timestamp: number,       // When we observed it (Date.now())
   *   element: HTMLElement,    // Raw DOM element
   * }
   * 
   * @param {Function} callback - Called with the parsed toast
   * @returns {Function} Unsubscribe function
   */
  function onToast(callback) {
    toastCallbacks.add(callback);
    return () => toastCallbacks.delete(callback);
  }

  /**
   * Start observing for site toast notifications.
   * 
   * Targets the Sonner container element specifically, NOT document.body.
   * This is efficient because the container only mutates when toasts
   * are added or removed — it's completely isolated from chat and other
   * high-frequency DOM changes.
   * 
   * @returns {boolean} True if observation started successfully
   */
  function startObserving() {
    if (disconnectObserver) return true;
    
    const container = document.querySelector(SELECTORS.TOAST_CONTAINER);
    if (!container) {
      console.warn('[ftl-ext-sdk] Sonner toast container not found — cannot start observing');
      return false;
    }
    
    // Process any existing toasts
    container.querySelectorAll('[data-sonner-toast]').forEach(processToast);
    
    // Watch the Sonner container for new toast elements
    disconnectObserver = observe(container, (mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          
          // Check if the added node is a toast
          if (node.hasAttribute?.('data-sonner-toast')) {
            processToast(node);
          }
          
          // Check children (toast <li> inside a new <ol>)
          if (node.querySelectorAll) {
            node.querySelectorAll('[data-sonner-toast]').forEach(processToast);
          }
        }
      }
    }, { childList: true, subtree: true });
    
    console.log('[ftl-ext-sdk] Toast observer started (targeting Sonner container)');
    return true;
  }

  /**
   * Stop observing for toasts.
   */
  function stopObserving() {
    if (disconnectObserver) {
      disconnectObserver();
      disconnectObserver = null;
      console.log('[ftl-ext-sdk] Toast observer stopped');
    }
  }

  /**
   * Wait for the Sonner toast container to appear, then start observing.
   * 
   * The Sonner container appears a few seconds after page load.
   * This uses a short-lived body-level observer to find it, then
   * disconnects and switches to the targeted container observer.
   * 
   * @param {number} timeout - Max wait time in ms (default 30000)
   * @returns {Promise<boolean>} True if observation started successfully
   */
  async function waitAndObserve(timeout = 30000) {
    if (disconnectObserver) return true;
    
    // Try immediately first
    if (startObserving()) return true;
    
    // Wait for the Sonner container to appear
    try {
      await waitForElement(SELECTORS.TOAST_CONTAINER, timeout);
      return startObserving();
    } catch {
      console.warn('[ftl-ext-sdk] Toast container did not appear within', timeout, 'ms');
      return false;
    }
  }

  /**
   * Check if the toast observer is running.
   */
  function isObserving() {
    return disconnectObserver !== null;
  }

  /**
   * Process a single toast element.
   */
  function processToast(element) {
    // Skip if already processed
    if (processedToasts.has(element)) return;
    processedToasts.add(element);
    
    const parsed = parseToastElement(element);
    if (!parsed) return;
    
    for (const cb of toastCallbacks) {
      try {
        cb(parsed);
      } catch (e) {
        console.error('[ftl-ext-sdk] Toast observer callback error:', e);
      }
    }
  }

  var toastObserver = /*#__PURE__*/Object.freeze({
    __proto__: null,
    isObserving: isObserving,
    onToast: onToast,
    parseToastElement: parseToastElement,
    startObserving: startObserving,
    stopObserving: stopObserving,
    waitAndObserve: waitAndObserve
  });

  /**
   * ui/index.js — UI Module Entry Point
   * 
   * - keyboard: Register keyboard shortcuts
   * - modals: Open, observe, and inject into site modals
   * - toasts: Show custom toast notifications
   * - toastObserver: Watch for site toast notifications (admin messages, item drops, etc.)
   */

  var index = /*#__PURE__*/Object.freeze({
    __proto__: null,
    keyboard: keyboard,
    modals: modals,
    toastObserver: toastObserver,
    toasts: toasts
  });

  exports.chat = index$2;
  exports.dom = dom;
  exports.events = events;
  exports.player = index$1;
  exports.react = react;
  exports.site = siteDetect;
  exports.socket = socket$1;
  exports.storage = storage;
  exports.ui = index;

}));
//# sourceMappingURL=ftl-ext-sdk.bundle.js.map

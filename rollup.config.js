import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

function firefoxUserscriptRealmPatch() {
  const helper = `
  // Tampermonkey/Greasemonkey on Firefox can pass binary values across
  // JavaScript realms, where prototype checks are false even for genuine
  // ArrayBuffers. Keep Socket.IO/msgpack binary detection stable
  // by checking the intrinsic object tag as a fallback.
  const __ftlToString = Object.prototype.toString;
  const __ftlIsArrayBuffer = (value) => (
    value != null &&
    __ftlToString.call(value) === '[object ArrayBuffer]'
  );
  const __ftlIsUint8Array = (value) => (
    value != null &&
    __ftlToString.call(value) === '[object Uint8Array]'
  );
  const __ftlIsBlob = (value) => (
    value != null &&
    __ftlToString.call(value) === '[object Blob]'
  );
  const __ftlIsFile = (value) => (
    value != null &&
    __ftlToString.call(value) === '[object File]'
  );
`;

  return {
    name: 'firefox-userscript-realm-patch',
    renderChunk(code) {
      const patched = code
          .replace("'use strict';", `'use strict';\n${helper}`)
          .replaceAll('obj.buffer instanceof ArrayBuffer', '__ftlIsArrayBuffer(obj.buffer)')
          .replaceAll('buffer instanceof ArrayBuffer', '__ftlIsArrayBuffer(buffer)')
          .replaceAll('packet.data instanceof ArrayBuffer', '__ftlIsArrayBuffer(packet.data)')
          .replaceAll('data instanceof ArrayBuffer', '__ftlIsArrayBuffer(data)')
          .replaceAll('value instanceof ArrayBuffer', '__ftlIsArrayBuffer(value)')
          .replaceAll('obj instanceof ArrayBuffer', '__ftlIsArrayBuffer(obj)')
          .replaceAll('data instanceof Uint8Array', '__ftlIsUint8Array(data)')
          .replaceAll('result instanceof Uint8Array', '__ftlIsUint8Array(result)')
          .replaceAll('packet.data instanceof Blob', '__ftlIsBlob(packet.data)')
          .replaceAll('data instanceof Blob', '__ftlIsBlob(data)')
          .replaceAll('obj instanceof Blob', '__ftlIsBlob(obj)')
          .replaceAll('obj instanceof File', '__ftlIsFile(obj)');

      return { code: patched, map: null };
    },
  };
}

export default {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/ftl-ext-sdk.bundle.js',
      format: 'umd',
      name: 'FTL',
      sourcemap: true,
    },
    {
      file: 'dist/ftl-ext-sdk.bundle.min.js',
      format: 'umd',
      name: 'FTL',
      sourcemap: true,
      plugins: [terser()],
    },
  ],
  plugins: [
    resolve({ browser: true }),
    commonjs(),
    firefoxUserscriptRealmPatch(),
  ],
};

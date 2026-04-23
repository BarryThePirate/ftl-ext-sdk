import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

/**
 * Firefox ArrayBuffer cross-realm fix.
 *
 * In Firefox content-script/tampermonkey context, `instanceof ArrayBuffer`
 * fails when the ArrayBuffer originates from a different JS realm
 * (e.g., the page's WebSocket frame vs. the userscript's context).
 *
 * This module patches `msgpackr`'s unpacker to use a cross-realm compatible
 * check so messages decode correctly in Firefox + Tampermonkey.
 *
 * The patch targets the internal `_unpack` call where `instanceof ArrayBuffer`
 * is used to detect binary data from the socket.
 */
function applyFirefoxArrayBufferFix() {
  return {
    name: 'firefox-arraybuffer-fix',
    renderChunk(code, chunk) {
      if (chunk.fileName.includes('msgpack')) {
        // Replace instanceof ArrayBuffer checks with a cross-realm compatible version.
        // Object.prototype.toString.call(obj) === '[object ArrayBuffer]' works
        // across all realms in Firefox.
        const fixed = code.replace(
          /\bsinstanceof\s+ArrayBuffer\b/g,
          '(Object.prototype.toString.call(_) === "[object ArrayBuffer]")'
        );
        // Fallback: also handle cases where a variable name is used instead of _
        return fixed.replace(
          /instanceof ArrayBuffer/g,
          "Object.prototype.toString.call(_) === '[object ArrayBuffer]'"
        );
      }
      return code;
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
      sourcemap: false,
      plugins: [terser()],
    },
  ],
  plugins: [
    resolve({ browser: true }),
    commonjs(),
    applyFirefoxArrayBufferFix(),
  ],
};

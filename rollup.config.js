import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

/**
 * Firefox Compatibility Plugin
 * 
 * Firefox content scripts run in a separate JavaScript realm from the page.
 * This causes instanceof ArrayBuffer checks to fail across realms.
 * 
 * This plugin patches those checks to use Object.prototype.toString.call()
 * which works across realms.
 */
function firefoxArrayBufferFix() {
    return {
        name: 'firefox-arraybuffer-fix',
        renderChunk(code) {
            let patched = code;
            let patchCount = 0;

            // Patch engine.io-parser style checks
            patched = patched.replace(
                /if \(data instanceof ArrayBuffer\) \{\s*\/\/ from HTTP long-polling/g,
                (match) => { 
                    patchCount++; 
                    return 'if (data instanceof ArrayBuffer || Object.prototype.toString.call(data) === "[object ArrayBuffer]") {\n                // from HTTP long-polling'; 
                }
            );

            // Patch notepack.io/msgpackr style checks
            patched = patched.replace(
                /if \(buffer instanceof ArrayBuffer\) \{/g,
                (match) => { 
                    patchCount++; 
                    return 'if (buffer instanceof ArrayBuffer || Object.prototype.toString.call(buffer) === "[object ArrayBuffer]) {'; 
                }
            );

            // Patch generic ArrayBuffer checks
            patched = patched.replace(
                /(\w+) instanceof ArrayBuffer/g,
                (match, varName) => { 
                    patchCount++; 
                    return `(${varName} instanceof ArrayBuffer || Object.prototype.toString.call(${varName}) === "[object ArrayBuffer]")`; 
                }
            );

            if (patchCount > 0) {
                console.log(`[firefox-arraybuffer-fix] Applied ${patchCount} patches`);
                return { code: patched, map: null };
            }

            console.warn('[firefox-arraybuffer-fix] WARNING: No patterns found!');
            return null;
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
      globals: {
        'socket.io-client': 'io',
      },
    },
    {
      file: 'dist/ftl-ext-sdk.bundle.min.js',
      format: 'umd',
      name: 'FTL',
      sourcemap: true,
      plugins: [terser()],
      globals: {
        'socket.io-client': 'io',
      },
    },
    {
      // IIFE bundle for userscripts (includes socket.io-client)
      file: 'dist/ftl-ext-sdk.userscript.js',
      format: 'iife',
      name: 'FTL',
      sourcemap: true,
      plugins: [terser()],
    },
  ],
  plugins: [
    resolve({ 
      browser: true,
      include: ['socket.io-client', 'socket.io-msgpack-parser', 'msgpackr']
    }),
    commonjs(),
    firefoxArrayBufferFix(),
  ],
};
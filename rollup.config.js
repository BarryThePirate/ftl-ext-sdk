import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

function firefoxArrayBufferRealmPatch() {
  const helperName = '__ftlIsArrayBuffer';
  const helper = [
    `  const ${helperName} = (value) =>`,
    `    Object.prototype.toString.call(value) === '[object ArrayBuffer]';`,
    '',
  ].join('\n');

  return {
    name: 'firefox-arraybuffer-realm-patch',
    renderChunk(code) {
      let patched = code.replace(
        "'use strict';",
        "'use strict';\n\n" + helper
      );

      patched = patched.replace(
        /\b([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?) instanceof ArrayBuffer/g,
        `${helperName}($1)`
      );

      return patched === code ? null : { code: patched, map: null };
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
    resolve({ browser: true, preferBuiltins: false }),
    commonjs(),
    firefoxArrayBufferRealmPatch(),
  ],
};

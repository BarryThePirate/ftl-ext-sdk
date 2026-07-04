import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

function firefoxUserscriptArrayBufferFix() {
  const arrayBufferInstanceof = /\b([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?) instanceof ArrayBuffer/g;
  const helper = `function __ftlIsArrayBuffer(value) {
  return Object.prototype.toString.call(value) === '[object ArrayBuffer]';
}
`;

  return {
    name: 'firefox-userscript-arraybuffer-fix',
    renderChunk(code) {
      const patched = code.replace(arrayBufferInstanceof, '__ftlIsArrayBuffer($1)');
      if (patched === code) return null;
      return {
        code: helper + patched,
        map: null,
      };
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
    firefoxUserscriptArrayBufferFix(),
  ],
};

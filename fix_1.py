// rollup.config.js
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import { renderChunk } from './current/rollup.config.js';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/ftl-sdk.js',
    format: 'umd',
    name: 'FTL',
    globals: {
      'socket.io-client': 'io',
      'socket.io-msgpack-parser': 'msgpackParser'
    }
  },
  plugins: [
    resolve(),
    commonjs(),
    renderChunk(),
    terser()
  ],
  external: ['socket.io-client', 'socket.io-msgpack-parser']
};
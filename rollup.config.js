import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const banner = `// ==UserScript==
// @name         FTL Extension SDK
// @namespace    https://fishtank.live/
// @version      0.1.0
// @description  General-purpose SDK for building browser extensions and userscripts for fishtank.live
// @author       Adraca Sentinel
// @match        https://fishtank.live/*
// @grant        none
// @run-at       document-start
// ==/UserScript==`;

export default {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/ftl-ext-sdk.user.js',
      format: 'umd',
      name: 'FTL',
      banner: banner,
    },
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
  ],
};

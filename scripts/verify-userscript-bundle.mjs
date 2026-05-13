import fs from 'node:fs';
import vm from 'node:vm';

const bundlePath = 'dist/ftl-ext-sdk.bundle.js';
const bundle = fs.readFileSync(bundlePath, 'utf8');

const requiredSnippets = [
  'socket.io-protocol',
  'msgpack.decode',
  'reconnectionAttempts',
  '__ftlIsArrayBuffer',
  '__ftlIsBlob',
];

for (const snippet of requiredSnippets) {
  if (!bundle.includes(snippet)) {
    throw new Error(`Expected ${bundlePath} to contain ${snippet}`);
  }
}

if (/require\(['"]socket\.io-client['"]\)/.test(bundle)) {
  throw new Error('socket.io-client is still externalized from the UMD bundle');
}

if (/require\(['"]socket\.io-msgpack-parser['"]\)/.test(bundle)) {
  throw new Error('socket.io-msgpack-parser is still externalized from the UMD bundle');
}

if (/instanceof\s+ArrayBuffer/.test(bundle)) {
  throw new Error('Firefox userscript ArrayBuffer realm patch was not applied');
}

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  Blob: class Blob {},
  File: class File {},
  ArrayBuffer,
  Uint8Array,
  TextEncoder,
  TextDecoder,
  URL: {},
  document: { cookie: '' },
};

sandbox.globalThis = sandbox;
sandbox.self = sandbox;
sandbox.window = sandbox;
vm.runInNewContext(bundle, sandbox, { filename: bundlePath });

const ftl = sandbox.window.FTL;
const namespaces = [
  'site',
  'chat',
  'ui',
  'socket',
  'events',
  'player',
  'dom',
  'storage',
  'transport',
  'react',
  'debug',
];

for (const namespace of namespaces) {
  if (!ftl?.[namespace]) {
    throw new Error(`window.FTL.${namespace} is missing from the UMD bundle`);
  }
}

if (typeof ftl.socket.connect !== 'function') {
  throw new Error('window.FTL.socket.connect is missing');
}

console.log('Userscript bundle verification passed.');

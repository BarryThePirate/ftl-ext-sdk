import fs from 'node:fs';
import vm from 'node:vm';

const bundlePath = new URL('../dist/ftl-ext-sdk.bundle.js', import.meta.url);
const bundle = fs.readFileSync(bundlePath, 'utf8');

const checks = [
  ['exposes global FTL', /factory\(global\.FTL = \{\}\)/.test(bundle)],
  ['bundles socket.io client code', /Socket\.IO|socket\.io-client|Manager|engine\.io/i.test(bundle)],
  ['bundles msgpack parser code', /MessagePack|msgpack|Encoder|Decoder/i.test(bundle)],
  ['applies ArrayBuffer realm helper', /__ftlIsArrayBuffer/.test(bundle)],
  ['does not leave socket deps as bare imports', !/from ['"]socket\.io-client['"]|from ['"]socket\.io-msgpack-parser['"]/.test(bundle)],
];

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  globalThis: {},
  self: {},
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

vm.runInNewContext(bundle, sandbox, { filename: 'ftl-ext-sdk.bundle.js' });

checks.push(['evaluates to a global FTL object', !!sandbox.FTL && typeof sandbox.FTL === 'object']);
checks.push(['FTL exposes site module', !!sandbox.FTL?.site]);
checks.push(['FTL exposes chat module', !!sandbox.FTL?.chat]);
checks.push(['FTL exposes socket module', !!sandbox.FTL?.socket]);
checks.push(['FTL exposes ui module', !!sandbox.FTL?.ui]);

let failed = false;
for (const [name, ok] of checks) {
  const status = ok ? 'ok' : 'fail';
  console.log(`${status} - ${name}`);
  failed ||= !ok;
}

if (failed) {
  process.exitCode = 1;
}

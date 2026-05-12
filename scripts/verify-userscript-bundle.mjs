import fs from 'node:fs';
import vm from 'node:vm';

const bundlePath = new URL('../dist/ftl-ext-sdk.bundle.js', import.meta.url);
const bundle = fs.readFileSync(bundlePath, 'utf8');

const errors = [];

if (!bundle.includes('__ftlIsArrayBuffer')) {
  errors.push('Firefox ArrayBuffer realm helper is missing');
}

if (bundle.includes('instanceof ArrayBuffer')) {
  errors.push('bundle still contains cross-realm unsafe instanceof ArrayBuffer checks');
}

if (/require\(['"]socket\.io-client['"]\)/.test(bundle)) {
  errors.push('socket.io-client is still external instead of bundled');
}

if (/require\(['"]socket\.io-msgpack-parser['"]\)/.test(bundle)) {
  errors.push('socket.io-msgpack-parser is still external instead of bundled');
}

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

try {
  vm.createContext(sandbox);
  vm.runInContext(bundle, sandbox, { filename: 'ftl-ext-sdk.bundle.js' });
} catch (error) {
  errors.push(`bundle did not evaluate as a userscript global: ${error.message}`);
}

const expectedModules = [
  'site',
  'chat',
  'ui',
  'socket',
  'events',
  'dom',
  'storage',
  'transport',
  'player',
  'react',
  'debug',
];

for (const moduleName of expectedModules) {
  if (!sandbox.FTL?.[moduleName]) {
    errors.push(`window.FTL.${moduleName} is missing`);
  }
}

if (typeof sandbox.FTL?.socket?.connect !== 'function') {
  errors.push('window.FTL.socket.connect is missing');
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Userscript bundle verified: socket deps are bundled, Firefox ArrayBuffer patch is applied, and window.FTL exposes SDK modules.');

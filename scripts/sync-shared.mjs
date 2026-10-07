/* Sync shared logic from dist/ into the WeChat miniprogram workspace.
   The web app keeps a single source of truth in dist/; after editing data.js,
   optimizer.js or upgrading the HiGHS vendor files, run `npm run sync:mp`
   so both targets stay aligned. Exit code is non-zero when anything drifts. */
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants } from 'node:zlib';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = (...p) => join(root, 'dist', ...p);
const mp = (...p) => join(root, 'miniprogram', ...p);

// The miniprogram packages worker code separately from main-thread modules,
// so shared files need one copy under workers/solver/ (worker-side require)
// and one under utils/ (main-thread require).
const copies = [
  [dist('data.js'), mp('workers', 'solver', 'data.js')],
  [dist('data.js'), mp('utils', 'data.js')],
  [dist('optimizer.js'), mp('workers', 'solver', 'optimizer.js')],
  [dist('progress.js'), mp('utils', 'progress.js')],
  [dist('vendor', 'highs.js'), mp('workers', 'solver', 'highs.js')],
];
for (const [from, to] of copies) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`synced ${to} (${statSync(to).size} bytes)`);
}

// WXWebAssembly.instantiate natively accepts brotli-compressed .wasm.br bundles,
// which keeps the main package far below the 2MB limit (3.37MB -> ~826KB).
const wasm = readFileSync(dist('vendor', 'highs.wasm'));
const br = brotliCompressSync(wasm, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } });
const brPath = mp('assets', 'highs.wasm.br');
mkdirSync(dirname(brPath), { recursive: true });
writeFileSync(brPath, br);
console.log(`packed ${brPath} (${wasm.length} -> ${br.length} bytes)`);

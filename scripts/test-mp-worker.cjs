/* Simulates the miniprogram solver worker in Node: mocks the `worker` global
   and WXWebAssembly (backed by native WebAssembly + the brotli bundle), then
   checks the message protocol, the WASM bridge and the pure-JS fallback.
   Run with: node scripts/test-mp-worker.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { brotliDecompressSync } = require('node:zlib');

const root = path.join(__dirname, '..');
const solverEntry = path.join(root, 'miniprogram', 'workers', 'solver', 'index.js');
const wasmBr = path.join(root, 'miniprogram', 'assets', 'highs.wasm.br');

function freshWorker(wxMock) {
  for (const key of Object.keys(require.cache)) delete require.cache[key];
  const posted = [];
  let handler = null;
  globalThis.worker = {
    onMessage(fn) { handler = fn; },
    postMessage(msg) { posted.push(msg); }
  };
  globalThis.WXWebAssembly = wxMock;
  require(solverEntry);
  return { posted, send: msg => handler(msg) };
}

function waitFor(posted, token, timeout = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function poll() {
      const hit = posted.find(m => m.token === token && m.type !== 'progress');
      if (hit) return resolve(hit);
      if (Date.now() - start > timeout) return reject(new Error('worker response timeout'));
      setTimeout(poll, 50);
    })();
  });
}

const settings = { channel: 'shop', native: 'orange', hemisphere: 'north', hot: [], cj: false, turnipPrice: 100, retention: .9 };
const inventory = { sugarcane: 23, tomato: 20, potato: 15, wheat: 20, carrot: 5, 'orange pumpkin': 19 };

(async () => {
  // 1. WASM path: WXWebAssembly mock reads the brotli bundle, which also
  //    proves the packed file decompresses to a valid wasm module.
  const wasmBytes = brotliDecompressSync(fs.readFileSync(wasmBr));
  const wxOk = {
    instantiate: (p, imports) => {
      assert.equal(p, '/assets/highs.wasm.br');
      return WebAssembly.instantiate(wasmBytes, imports);
    }
  };
  let env = freshWorker(wxOk);
  env.send({ token: 1, input: { inventory, owned: [/* filled after data load */], settings, mode: 'profit' } });
  // owned list must come from the data module the worker itself loaded
  const data = globalThis.HARVEST_DATA;
  assert.ok(data && data.recipes.length === 141, 'worker should expose HARVEST_DATA');
  const owned = data.recipes.map(r => r.id);
  env.send({ token: 2, input: { inventory, owned, settings, mode: 'profit' } });
  const reply = await waitFor(env.posted, 2);
  assert.equal(reply.type, 'result');
  assert.equal(reply.wasm, true);
  assert.equal(reply.result.revenue, 57380);
  assert.equal(reply.result.baseline, 35700);
  assert.equal(reply.result.provenOptimal, true);
  console.log('WASM path ok: revenue', reply.result.revenue, 'optimal', reply.result.provenOptimal);

  // 2. Fallback path: WASM refuses to start, the worker must still solve via
  //    the built-in branch-and-bound implementation.
  const wxFail = { instantiate: () => Promise.reject(new Error('no wasm here')) };
  env = freshWorker(wxFail);
  env.send({ token: 3, input: { inventory, owned, settings, mode: 'profit' } });
  const fallback = await waitFor(env.posted, 3, 60000);
  assert.equal(fallback.type, 'result');
  assert.equal(fallback.wasm, false);
  // The pure-JS branch-and-bound may hit its 12s deadline on the full recipe
  // set; a feasible plan that clearly beats raw selling is the contract here.
  assert.ok(fallback.result.revenue >= 56000 && fallback.result.revenue <= 57380,
    `fallback revenue ${fallback.result.revenue} should land near the optimum 57380`);
  console.log('Fallback path ok: revenue', fallback.result.revenue, 'optimal', fallback.result.provenOptimal);

  // 3. Farm case from the web test suite.
  env = freshWorker(wxOk);
  env.send({ token: 4, input: { inventory: {}, owned, settings, mode: 'profit', land: 60, yield: 3, minimum: {} } });
  const farm = await waitFor(env.posted, 4);
  assert.equal(farm.result.revenue, 114000);
  assert.equal(farm.result.provenOptimal, true);
  console.log('Farm case ok: revenue', farm.result.revenue);

  console.log('All miniprogram worker checks passed.');
})().catch(err => { console.error(err); process.exitCode = 1; });

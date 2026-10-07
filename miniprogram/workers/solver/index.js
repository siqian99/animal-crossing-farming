/* Solver worker. Loads the HiGHS WASM module through WXWebAssembly (the
   brotli-packed bundle under /assets streams in and decompresses natively),
   then answers solve requests with the same message protocol as the web app:
   {token, type:'progress'|'result'|'error'}. If WASM cannot start within the
   grace period, requests still run on the built-in pure-JS solver. */
require('./data.js');
const optimizer = require('./optimizer.js');

const data = globalThis.HARVEST_DATA;
const WASM_TIMEOUT = 8000;

// The miniprogram runtime exposes WXWebAssembly instead of the standard global,
// but the emscripten glue references WebAssembly.RuntimeError and friends.
// Memory/Table come from the wasm module itself in this build, so only the
// handful of members below ever get touched.
if (typeof WebAssembly === 'undefined' && typeof WXWebAssembly !== 'undefined') {
  globalThis.WebAssembly = {
    instantiate: WXWebAssembly.instantiate.bind(WXWebAssembly),
    Memory: WXWebAssembly.Memory,
    Table: WXWebAssembly.Table,
    Global: WXWebAssembly.Global,
    RuntimeError: WXWebAssembly.RuntimeError || Error,
    Module: WXWebAssembly.Module || function Module() {},
    Instance: WXWebAssembly.Instance || function Instance() {}
  };
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('WASM_TIMEOUT')), ms))]);
}

function loadSolver() {
  try {
    const Module = require('./highs.js');
    return withTimeout(Module({
      locateFile: path => path,
      instantiateWasm: (imports, successCallback) => {
        WXWebAssembly.instantiate('/assets/highs.wasm.br', imports).then(res => {
          // Some runtimes resolve with the instance itself, others with
          // {instance, module}; accept both shapes.
          successCallback(res && res.instance ? res.instance : res, res && res.module);
        }).catch(() => {
          // emscripten only waits for successCallback, so a failed load leaves
          // its promise pending forever; swallow this side-channel rejection
          // and let the outer timeout fall back to the pure-JS solver.
        });
        return {}; // tell emscripten instantiation continues asynchronously
      }
    }).then(instance => {
      optimizer.setSolver(instance);
      return { wasm: true };
    }), WASM_TIMEOUT).catch(() => ({ wasm: false }));
  } catch (e) {
    return Promise.resolve({ wasm: false });
  }
}

const ready = loadSolver();

worker.onMessage(function (msg) {
  const token = msg.token;
  Promise.resolve(ready).then(mode => {
    const result = optimizer.solve(data, msg.input, progress => worker.postMessage({ token, type: 'progress', progress }));
    worker.postMessage({ token, type: 'result', result, wasm: mode.wasm });
  }).catch(error => {
    worker.postMessage({ token, type: 'error', message: error && error.message || String(error) });
  });
});

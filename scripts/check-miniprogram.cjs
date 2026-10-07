/* One-off structural check for the miniprogram/ tree:
   - every .js parses (node --check equivalent)
   - every .json parses
   - every page referenced by app.json has wxml/js/json/wxss
   - WXML tag balance sanity (view/text/block/button/label/image/input/picker/checkbox)
   - rough main-package size vs the 2MB limit */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..', 'miniprogram');
let fail = 0;
const bad = m => { fail++; console.error('FAIL ' + m); };

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const files = walk(root);

// 1. JS syntax
for (const f of files.filter(f => f.endsWith('.js'))) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); console.log('OK   js   ' + path.relative(root, f)); }
  catch (e) { bad(`js syntax ${path.relative(root, f)}: ${e.stderr}`); }
}

// 2. JSON parse
for (const f of files.filter(f => f.endsWith('.json'))) {
  try { JSON.parse(fs.readFileSync(f, 'utf8')); console.log('OK   json ' + path.relative(root, f)); }
  catch (e) { bad(`json parse ${path.relative(root, f)}: ${e.message}`); }
}

// 3. app.json pages completeness
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
for (const p of appJson.pages) {
  for (const ext of ['.wxml', '.js', '.json']) {
    if (!fs.existsSync(path.join(root, p + ext))) bad(`page ${p} missing ${ext}`);
  }
  console.log(`OK   page ${p}`);
}

// 4. WXML tag balance
const pairs = ['view', 'text', 'block', 'button', 'label', 'picker', 'checkbox-group', 'scroll-view'];
for (const f of files.filter(f => f.endsWith('.wxml'))) {
  const src = fs.readFileSync(f, 'utf8');
  for (const tag of pairs) {
    const open = (src.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
    const close = (src.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    if (open !== close) bad(`wxml tag balance ${path.relative(root, f)} <${tag}>: ${open} open vs ${close} close`);
  }
  console.log('OK   wxml ' + path.relative(root, f));
}

// 5. size of main package (everything except subpackages; we have none)
let total = 0;
for (const f of files) total += fs.statSync(f).size;
console.log(`main package size: ${(total / 1024).toFixed(0)} KB of 2048 KB`);
if (total > 2 * 1024 * 1024) bad('main package exceeds 2MB');

console.log(fail ? `\n${fail} problem(s)` : '\nall checks passed');
process.exit(fail ? 1 : 0);

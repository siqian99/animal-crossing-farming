/* Persistent state shared by every page. Mirrors the web app's localStorage
   record under the same "harvest-ledger" key so JSON backups stay portable
   between the web version and the miniprogram. */
require('./data.js');
const Progress = require('./progress.js');

const data = globalThis.HARVEST_DATA;
const RETENTIONS = [.5, .6, .7, .75, .8, .85, .9, .92, .95, .97, .98, .99, 1];
const CROPS = ['sugarcane', 'tomato', 'potato', 'wheat', 'carrot', 'orange pumpkin'];

function defaults() {
  return {
    version: 1,
    inventory: Object.fromEntries(CROPS.map(n => [n, 0])),
    owned: [],
    land: 60, yield: 3,
    minimum: Object.fromEntries(CROPS.map(n => [n, 0])),
    mode: 'profit',
    settings: { channel: 'shop', native: 'unknown', hemisphere: 'north', hot: [], cj: false, turnipPrice: 0, retention: .9 },
    sessions: {}, history: [], guideSeen: false, recipeSort: 'game'
  };
}

let state = defaults();

function normalize(value) {
  const d = defaults();
  const valid = new Set([...data.items, ...data.recipes].map(x => x.name));
  const ids = new Set(data.recipes.map(r => r.id));
  const count = x => Number.isSafeInteger(Number(x)) && Number(x) >= 0 && Number(x) <= 1000000 ? Number(x) : 0;
  d.inventory = Object.fromEntries(Object.entries(value.inventory || {}).filter(([n]) => valid.has(n)).map(([n, q]) => [n, count(q)]));
  CROPS.forEach(n => d.inventory[n] ??= 0);
  d.owned = [...new Set((value.owned || []).filter(x => ids.has(x)))];
  d.land = count(value.land);
  d.yield = [1, 2, 3].includes(Number(value.yield)) ? Number(value.yield) : 3;
  CROPS.forEach(n => d.minimum[n] = count(value.minimum?.[n]));
  d.mode = value.mode === 'easy' ? 'easy' : 'profit';
  if (value.settings) {
    const s = value.settings;
    // hemisphere is persisted here (the web normalize drops it today); keeping it
    // stable avoids losing the season calendar orientation after a reload.
    d.settings = {
      channel: s.channel === 'box' ? 'box' : 'shop',
      native: ['apple', 'cherry', 'orange', 'peach', 'pear'].includes(s.native) ? s.native : 'unknown',
      hemisphere: s.hemisphere === 'south' ? 'south' : 'north',
      hot: (s.hot || []).filter(x => data.recipes.some(r => r.name === x)),
      cj: !!s.cj,
      turnipPrice: Math.min(10000, count(s.turnipPrice)),
      retention: RETENTIONS.includes(Number(s.retention)) ? Number(s.retention) : .9
    };
  }
  d.guideSeen = !!value.guideSeen;
  d.recipeSort = value.recipeSort === 'name' ? 'name' : 'game';
  for (const t of ['inventory', 'farm']) {
    const session = Progress.normalizeSession(value.sessions?.[t], ids);
    if (session) d.sessions[t] = session;
  }
  d.history = (Array.isArray(value.history) ? value.history : []).slice(0, 3).map(x => Progress.normalizeSession(x, ids)).filter(Boolean);
  return d;
}

function load() {
  try {
    const raw = wx.getStorageSync('harvest-ledger');
    if (raw) state = normalize(JSON.parse(raw));
  } catch (e) { /* keep defaults when the record is unreadable */ }
}

function save() {
  try {
    wx.setStorageSync('harvest-ledger', JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

// Settings edits happen on a separate page; the index page consumes this
// flag in onShow to invalidate stale results, matching the web invalidate().
let settingsDirty = false;
function markSettingsDirty() { settingsDirty = true; }
function takeSettingsDirty() { const v = settingsDirty; settingsDirty = false; return v; }

load();

module.exports = { state, defaults, normalize, load, save, data, Progress, RETENTIONS, CROPS, markSettingsDirty, takeSettingsDirty };

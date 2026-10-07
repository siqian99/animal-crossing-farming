/* Main page: inventory / farm / recipe tabs, solver worker lifecycle and the
   cooking plan result card. Ported from the web app's app.js. */
const store = require('../../utils/store.js');
const icons = require('../../utils/icons.js');

const { state, data, Progress, CROPS, save, takeSettingsDirty } = store;
const names = Object.fromEntries([...data.items, ...data.recipes].map(i => [i.name, i.zh]));
const zh = n => names[n] || n;
const fmt = n => Math.round(n).toLocaleString('zh-CN');
const RETENTIONS = store.RETENTIONS;

let tab = 'inventory';
let result = null;
let recipeFilter = 'all';
let search = '';
let solver = null;
let calcToken = 0;
let workerBusy = false;   // calculation overlay shown
let solverRunning = false; // worker is still crunching a request
let guideStep = 0;
let guideActive = false;

const FILTERS = [['all', '全部'], ['owned', '已学会'], ['sweet', '甜点'], ['savory', '咸食'], ['crop', '农作物'], ['fish', '鱼与海产'], ['fruit', '水果'], ['season', '季节食材']];
const GUIDE_STEPS = [
  { tab: 'recipes', title: '先勾选已有料理手册', text: '「我的料理手册」勾选已学会的料理手册。与游戏内排列顺序一致，支持搜索。' },
  { tab: 'inventory', title: '解决问题一：手里的原料，怎么做料理最赚钱？', text: '「库存原料」填写甘蔗、番茄等数量，可选择“收益最高”或“省制作批次”不同计算方式。右上角「岛屿设置」可选双倍料理和省制作批次的保留收入比例。' },
  { tab: 'inventory', title: '边做边勾，卖完回来接着做', text: '背包装不下所有料理，卖完忘记进度？料理清单可打勾，也可记录部分进度。进度在本机自动保存，切换页面均保留。' },
  { tab: 'farm', title: '解决问题二：固定大小的地，怎么种作物最赚钱？', text: '「农田分配」填写土地格数和预计每株产量（预计浇水次数）。还可设置各作物最低株数，得到最优植株分配与料理方案。' }
];

function price(name) {
  const r = data.recipes.find(r => r.name === name), i = data.items.find(i => i.name === name);
  let p = r?.sellPrice ?? i?.sellPrice ?? 0;
  if (['apple', 'cherry', 'orange', 'peach', 'pear'].includes(name)) p = name === state.settings.native ? 100 : 500;
  if (name === 'turnips') p = state.settings.turnipPrice;
  const sale = state.settings.channel === 'box' ? (name === 'turnips' ? 0 : Math.floor(p * .8)) : p * (state.settings.hot.includes(name) ? 2 : 1);
  return state.settings.cj && i?.category === 'Fish' ? Math.max(sale, Math.floor(p * 1.5)) : sale;
}

function monthsZh(a) {
  const n = [...new Set(a)].sort((x, y) => x - y); const runs = []; let s = n[0], p = n[0];
  for (let i = 1; i < n.length; i++) { if (n[i] === p + 1) p = n[i]; else { runs.push([s, p]); s = p = n[i]; } }
  runs.push([s, p]);
  return runs.map(([x, y]) => x === y ? x + '月' : y === x + 1 ? x + '、' + y + '月' : x + '–' + y + '月').join('、');
}

function seasonVM() {
  const hemi = state.settings.hemisphere === 'south' ? 'sh' : 'nh', now = new Date().getMonth() + 1, next = now === 12 ? 1 : now + 1;
  const inNow = [], back = [];
  for (const [n, w] of Object.entries(data.seasons || {})) {
    const m = w[hemi]; if (!m) continue;
    if (m.includes(now)) inNow.push({ name: n, zh: zh(n), last: !m.includes(next) });
    else if (m.includes(next)) back.push({ name: n, zh: zh(n) });
  }
  if (!inNow.length && !back.length) return null;
  const cal = Array.from({ length: 12 }, (_, k) => k + 1).map(m => {
    const list = Object.entries(data.seasons || {}).filter(([, w]) => (w[hemi] || []).includes(m)).map(([n]) => ({ name: n, zh: zh(n) }));
    return { month: m, current: m === now, list };
  });
  return { title: `本月时令 · ${now}月 · ${hemi === 'nh' ? '北' : '南'}半球`, chips: inNow, back, cal };
}

function category(r) {
  const ns = Object.keys(r.ingredients);
  if (ns.some(n => data.items.find(i => i.name === n && ['Fish', 'Sea Creatures'].includes(i.category)))) return 'fish';
  if (ns.some(n => ['apple', 'cherry', 'orange', 'peach', 'pear', 'coconut'].includes(n))) return 'fruit';
  if (ns.some(n => n.includes('mushroom') || n === 'bamboo shoot' || n === 'green pumpkin' || n === 'white pumpkin' || n === 'yellow pumpkin')) return 'season';
  return 'crop';
}

function sourceText(r) {
  if (r.source.includes('Basic Cooking Recipes')) return '基础料理手册';
  if (r.source.includes('Be a Chef! DIY Recipes+')) return '料理 DIY 入门';
  if (r.source.includes('Brewster')) return '鸽巢：不同 5 天坐下喝咖啡';
  if (r.source.some(s => s.includes('Catching'))) return '捕获对应鱼类后获得';
  if (r.source.includes('Daisy Mae')) return '曹卖赠送';
  return '岛民、漂流瓶等 · 依配方获取';
}

function sortedRecipes() {
  return [...data.recipes].sort(state.recipeSort === 'name'
    ? (a, b) => a.zh.localeCompare(b.zh, 'zh-CN-u-co-pinyin') || a.serialId - b.serialId
    : (a, b) => a.serialId - b.serialId);
}

function calculationInput(t = tab) {
  return { inventory: t === 'farm' ? {} : { ...state.inventory }, owned: [...state.owned], settings: { ...state.settings }, mode: state.mode, ...(t === 'farm' ? { land: state.land, yield: state.yield, minimum: { ...state.minimum } } : {}) };
}

function maxSingle(r, inv) {
  const suppliers = new Map(data.recipes.filter(x => state.owned.includes(x.id)).map(x => [x.name, x]));
  function works(q) {
    const stock = { ...inv };
    function take(n, need, trail = new Set()) {
      if ((stock[n] || 0) < need) {
        const supplier = suppliers.get(n); if (!supplier || trail.has(n)) return false;
        const times = Math.ceil((need - (stock[n] || 0)) / supplier.outputQuantity), nextTrail = new Set([...trail, n]);
        for (const [i, v] of Object.entries(supplier.ingredients)) if (!take(i, v * times, nextTrail)) return false;
        stock[n] = (stock[n] || 0) + supplier.outputQuantity * times;
      }
      stock[n] -= need; return true;
    }
    for (const [n, v] of Object.entries(r.ingredients)) if (!take(n, q * v)) return false;
    return true;
  }
  let lo = 0, hi = 10000001;
  while (lo + 1 < hi) { const mid = Math.floor((lo + hi) / 2); if (works(mid)) lo = mid; else hi = mid; }
  return lo * r.outputQuantity;
}

function rememberResult(r) {
  const old = state.sessions[r.tab];
  if (old?.result.stamp === r.stamp) {
    state.sessions[r.tab] = { result: r, done: Object.fromEntries(r.plan.map(p => [p.id, Progress.validDone(p, old.done[p.id]) ? old.done[p.id] : 0])) };
  } else {
    if (old) state.history = [old, ...state.history].slice(0, 3);
    state.sessions[r.tab] = { result: r, done: {} };
  }
  save();
}

function historyVM(t) {
  return state.history.map((s, i) => ({ i, revenue: fmt(s.result.revenue), doneCount: s.result.plan.filter(p => s.done[p.id] === p.quantity).length, total: s.result.plan.length }))
    .filter(h => state.history[h.i].result.tab === t);
}

function emptyVM() {
  return {
    channelTag: state.settings.channel === 'box' ? '收购箱' : '普通店内价',
    hint: state.owned.length ? '修改左侧数量后，计算适合这次收成的组合。' : '先到“我的料理手册”勾选已学会的 DIY。也可以直接计算原料出售收入。',
    hasResume: !!state.sessions[tab],
    history: historyVM(tab),
    notice: '计算会包含加工原料和剩余食材。南瓜数量按橙色计算，其他颜色请在“其他食材”中添加。',
    basketIcon: icons.glyph('basket')
  };
}

function resultVM(r) {
  const session = state.sessions[r.tab], done = session?.done || {};
  const finished = r.plan.filter(p => (done[p.id] || 0) === p.quantity).length;
  const stale = r.stamp !== Progress.signature(calculationInput(r.tab));
  const direct = [...r.leftovers, ...r.plan.filter(p => p.processed && !p.stockTracked).map(p => ({ name: p.name, quantity: p.directQuantity, value: p.directQuantity * p.unitPrice }))].filter(l => l.quantity > 0);
  const gainText = r.baseline > 0
    ? `比原料直接卖多得 ${fmt(r.gain)} 铃钱（${r.gain >= 0 ? '+' : ''}${(r.gain / r.baseline * 100).toFixed(1)}%）`
    : `新增收入 ${fmt(r.gain)} 铃钱（原料直接卖基准为 0）`;
  const planRows = r.plan.map((p, i) => {
    const q = done[p.id] || 0, u = Progress.unit(p), batch = Progress.batchSize(p);
    const status = q === p.quantity ? 'done' : q > 0 ? 'partial' : 'todo';
    const usage = p.processed ? (p.usedQuantity > 0 ? `后续料理要用 ${fmt(p.usedQuantity)} 份${p.directQuantity > 0 ? ` · 另有 ${fmt(p.directQuantity)} 份直接卖` : ''}` : '本次加工后全部直接卖') : '';
    return {
      id: p.id, index: i + 1, zh: p.zh, quantity: fmt(p.quantity), countText: `${fmt(p.count)} 次配方 · ${p.batches} 批${u > 1 ? ` · 每次产出 ${u} 份` : ''}`,
      usage, status, doneValue: q, doneMax: p.quantity, batch, canAdd: Progress.canAddBatch(p, q),
      batchLabel: `＋${batch} 份`, meter: p.quantity ? q / p.quantity * 100 : 0,
      statusLabel: status === 'done' ? '已完成' : status === 'partial' ? '已做一部分' : '待制作'
    };
  });
  const plants = r.tab === 'farm' ? Object.entries(r.plants).filter(([, q]) => q > 0).map(([n, q]) => ({ icon: icons.crop(n), zh: zh(n), count: fmt(q) })) : [];
  const available = r.tab !== 'farm' ? sortedRecipes().filter(x => state.owned.includes(x.id)).map(x => ({ r: x, q: maxSingle(x, r.inventory) })).filter(x => x.q > 0).map(x => ({ zh: x.r.zh, count: fmt(x.q) })) : [];
  const notice = `${r.mode === 'easy' ? `省批次目标：至少保留 ${fmt(r.minimumTarget ?? r.revenue)} 铃钱。${r.revenueOptimal === false ? '参考最高收入尚未证明最优。' : ''}` : ''}${r.provenOptimal ? '在本次配方、材料与出售条件下已证明最优。' : '限时内得到可行方案，尚未证明最优。'}制作批次按同配方最多 10 次计，不含浇水、菜单和出售往返。${r.channel === 'box' ? '收购箱不享受今日双倍。' : r.hasHot ? '已包含本次选定的今日双倍。' : '普通条例售价。'}`;
  return {
    title: r.tab === 'farm' ? '你的农田方案' : '这次收成的安排',
    tag: r.provenOptimal ? '已证明最优' : '当前可行方案',
    subtitle: r.tab === 'farm' ? '每轮收获销售总收入' : '料理与余料总收入',
    total: fmt(r.revenue), stale,
    gainText, gainSub: r.tab === 'farm' ? '按设定产量与已学配方计算' : gainText,
    metrics: [
      { label: '制作批次', value: `${r.batches} 批` },
      { label: r.tab === 'farm' ? '种植总株数' : '直接卖基准', value: r.tab === 'farm' ? fmt(Object.values(r.plants).reduce((a, b) => a + b, 0)) : fmt(r.baseline) },
      { label: r.mode === 'easy' ? '参考最高总收入' : '料理／加工种类', value: r.mode === 'easy' ? fmt(r.maximumRevenue ?? r.revenue) : String(r.plan.length) }
    ],
    plants, planRows, planCount: r.plan.length, finished,
    planHeading: r.plan.length ? '按这个顺序制作' : '这次直接出售即可',
    direct: direct.map(l => ({ zh: zh(l.name), quantity: fmt(l.quantity), value: fmt(l.value), kept: l.value === 0 })),
    directTotal: fmt(direct.reduce((a, l) => a + l.value, 0)),
    history: historyVM(r.tab), available, availableCount: available.length, notice
  };
}

Page({
  data: {
    tab: 'inventory',
    tabs: [
      { id: 'inventory', label: '库存原料', icon: '', activeIcon: '' },
      { id: 'farm', label: '农田分配', icon: '', activeIcon: '' },
      { id: 'recipes', label: '我的料理手册', icon: '', activeIcon: '', count: 0 }
    ],
    crops: [], extras: [], addSearch: '', addResults: [],
    land: 60, yield: 3, minimumCrops: [],
    mode: 'profit', retentionPct: 90,
    season: null,
    recipeRows: [], recipeSearch: '', recipeFilter: 'all', recipeSort: 'game',
    filters: FILTERS.map(([id, label]) => ({ id, label })),
    ownedCount: 0, collectPct: 0,
    result: null, empty: null, emptyHint: '',
    calculating: false, progressText: '', calcTitle: '',
    itemInfo: null,
    guide: null
  },

  onLoad() {
    this.setData({
      tabs: this.data.tabs.map(t => ({ ...t, icon: icons.glyph(t.id === 'inventory' ? 'basket' : t.id === 'farm' ? 'farm' : 'book'), activeIcon: icons.glyph(t.id === 'inventory' ? 'basket' : t.id === 'farm' ? 'farm' : 'book', '#FFF5D6') }))
    });
    result = state.sessions[tab]?.result || null;
    this.renderAll();
    if (!state.guideSeen) this.openGuide();
  },

  onShow() {
    if (takeSettingsDirty()) { this.invalidateResult(); this.renderAll(); }
  },

  onShareAppMessage() {
    return { title: '无人岛料理收益管家 · 动森料理与农田收益规划', path: '/pages/index/index' };
  },

  // ---------- rendering ----------

  renderAll() {
    if (!['inventory', 'farm', 'recipes'].includes(tab)) tab = 'inventory';
    this.setData({ tab, 'tabs[2].count': state.owned.length, mode: state.mode, retentionPct: Math.round(state.settings.retention * 100) });
    if (tab === 'inventory') this.renderInventory();
    if (tab === 'farm') this.renderFarm();
    if (tab === 'recipes') this.renderRecipes();
    this.syncResult();
  },

  renderInventory() {
    this.setData({
      crops: CROPS.map(n => ({ name: n, zh: zh(n), icon: icons.crop(n), value: state.inventory[n] || 0 })),
      extras: Object.entries(state.inventory).filter(([n, q]) => !CROPS.includes(n) && q > 0).map(([n, q]) => ({ name: n, zh: zh(n), value: q })),
      season: seasonVM()
    });
    this.syncAddResults();
  },

  renderFarm() {
    this.setData({
      land: state.land, yield: state.yield,
      minimumCrops: CROPS.map(n => ({ name: n, zh: zh(n), icon: icons.crop(n), value: state.minimum[n] || 0 }))
    });
  },

  syncAddResults() {
    const q = this.data.addSearch.trim();
    const options = q ? data.items.filter(i => !CROPS.includes(i.name) && (i.zh.includes(q) || i.name.toLowerCase().includes(q.toLowerCase()))).slice(0, 8).map(i => ({ name: i.name, zh: i.zh })) : [];
    this.setData({ addResults: options });
  },

  renderRecipes() {
    const q = this.data.recipeSearch.toLowerCase();
    const rows = sortedRecipes()
      .filter(r => (recipeFilter === 'all' || (recipeFilter === 'owned' ? state.owned.includes(r.id) : recipeFilter === 'sweet' ? r.gameCategory === 'Sweet' : recipeFilter === 'savory' ? r.gameCategory === 'Savory' : category(r) === recipeFilter))
        && `${r.zh} ${r.name} ${Object.keys(r.ingredients).map(zh).join(' ')}`.toLowerCase().includes(q))
      .map(r => ({
        id: r.id, owned: state.owned.includes(r.id), zh: r.zh, index: String(r.gameIndex).padStart(3, '0'),
        ingredients: Object.entries(r.ingredients).map(([n, v]) => `${zh(n)} ×${v}`).join(' · ') + (r.outputQuantity > 1 ? ` → 产出 ${r.outputQuantity} 个` : ''),
        source: sourceText(r), price: fmt(r.sellPrice)
      }));
    this.setData({
      recipeRows: rows, recipeFilter, recipeSort: state.recipeSort,
      ownedCount: state.owned.length, collectPct: Math.round(state.owned.length / 141 * 100)
    });
  },

  syncResult() {
    if (result) {
      this.setData({ result: resultVM(result), empty: null, emptyHint: '' });
    } else {
      this.setData({ result: null, empty: emptyVM(), emptyHint: this._emptyHint || '' });
    }
  },

  invalidateResult() {
    result = null;
    this._emptyHint = '输入已修改，请重新计算。';
  },

  // ---------- navigation and inputs ----------

  onTabTap(e) {
    tab = e.currentTarget.dataset.tab;
    result = state.sessions[tab]?.result || null;
    this._emptyHint = '';
    this.renderAll();
  },

  onGoSettings() { wx.navigateTo({ url: '/pages/settings/settings' }); },
  onGoAbout() { wx.navigateTo({ url: '/pages/about/about' }); },
  onGoRecipes() { this.onTabTap({ currentTarget: { dataset: { tab: 'recipes' } } }); },

  setQuantity(kind, name, v) {
    if (!Number.isSafeInteger(v) || v < 0 || v > 1000000) { wx.showToast({ title: '请输入 0–1000000 的整数', icon: 'none' }); return false; }
    state[kind][name] = v;
    this.afterInputChange();
    return true;
  },

  onStepTap(e) {
    const { step, kind, name } = e.currentTarget.dataset;
    const current = kind === 'minimum' ? (state.minimum[name] || 0) : (state.inventory[name] || 0);
    const v = Math.max(0, Math.min(1000000, current + Number(step)));
    state[kind][name] = v;
    const listKey = kind === 'minimum' ? 'minimumCrops' : 'crops';
    const rows = this.data[listKey];
    const i = rows.findIndex(r => r.name === name);
    if (i >= 0) this.setData({ [`${listKey}[${i}].value`]: v });
    this.afterInputChange();
  },

  onCountInput(e) {
    const { kind, name } = e.currentTarget.dataset;
    const raw = e.detail.value;
    if (raw === '') return;
    this.setQuantity(kind, name, Number(raw));
  },

  onLandInput(e) {
    const raw = e.detail.value;
    if (raw === '') return;
    const v = Number(raw);
    if (!Number.isSafeInteger(v) || v < 0 || v > 1000000) { wx.showToast({ title: '请输入 0–1000000 的整数', icon: 'none' }); this.setData({ land: state.land }); return; }
    state.land = v;
    this.afterInputChange();
  },

  onYieldChange(e) { state.yield = Number(e.detail.value) + 1; this.setData({ yield: state.yield }); this.afterInputChange(); },

  onClearInventory() {
    state.inventory = Object.fromEntries(CROPS.map(n => [n, 0]));
    this.afterInputChange();
    this.renderInventory();
    wx.showToast({ title: '原料数量已清空，配方和制作进度仍保留。', icon: 'none' });
  },

  onAddSearchInput(e) { this.setData({ addSearch: e.detail.value }); this.syncAddResults(); },

  onAddItem(e) {
    const name = e.currentTarget.dataset.name;
    state.inventory[name] = (state.inventory[name] || 0) + 1;
    this.afterInputChange();
    this.renderInventory();
  },

  onRemoveExtra(e) {
    delete state.inventory[e.currentTarget.dataset.name];
    this.afterInputChange();
    this.renderInventory();
  },

  onModeTap(e) { state.mode = e.currentTarget.dataset.mode; this.afterInputChange(); this.renderAll(); },

  afterInputChange() {
    // Input edits while a calculation is running make the pending result
    // obsolete: bump the token so the late worker reply is dropped and hide
    // the calculating overlay. The worker itself is reused or replaced by
    // the next calculation (see onCalculate).
    if (workerBusy) { calcToken++; workerBusy = false; this.setData({ calculating: false }); }
    this.invalidateResult(); save(); this.syncResult();
  },

  // ---------- solver ----------

  onCalculate() {
    if (tab === 'farm' && Object.values(state.minimum).reduce((a, b) => a + b, 0) > state.land) {
      wx.showToast({ title: '最低株数合计超过土地格数，请调整。', icon: 'none' }); return;
    }
    const inventory = tab === 'farm' ? {} : { ...state.inventory };
    if (state.settings.native === 'unknown' && ['apple', 'cherry', 'orange', 'peach', 'pear'].some(n => inventory[n] > 0)) {
      wx.showToast({ title: '比较水果前，请在岛屿设置选择特产水果。', icon: 'none' });
      wx.navigateTo({ url: '/pages/settings/settings' }); return;
    }
    // A worker still crunching a previous request is terminated so the new
    // calculation starts immediately (mirrors the web app's invalidate()).
    if (solver && solverRunning) { solver.terminate(); solver = null; solverRunning = false; }
    if (!solver) {
      try { solver = wx.createWorker('workers/solver/index.js'); } catch (e) {
        this.setData({ calculating: false, result: null, empty: emptyVM(), emptyHint: '计算组件启动失败，请重试或反馈问题。' }); return;
      }
      solver.onMessage(msg => this.onSolverMessage(msg));
    }
    const token = ++calcToken;
    workerBusy = true; solverRunning = true;
    this.setData({
      calculating: true, calcTitle: tab === 'farm' ? '正在规划这片农田' : '正在安排这次收成',
      progressText: '同时核对加工产量、料理组合和剩余材料…'
    });
    solver.postMessage({ token, input: calculationInput() });
  },

  onSolverMessage(msg) {
    if (msg.type === 'progress') {
      if (msg.token !== calcToken) return;
      this.setData({ progressText: `已比较 ${fmt(msg.progress.nodes)} 个分支，正在核对更好的组合…` });
      return;
    }
    // Any terminal message frees the worker, even when the token is stale.
    solverRunning = false;
    if (msg.token !== calcToken) return;
    workerBusy = false;
    // WASM failed on the worker side and the pure-JS fallback answered:
    // warn once so the “当前可行方案” tag is understood.
    if (msg.wasm === false) wx.showToast({ title: '高速求解组件不可用，已用基础算法计算，结果可能非最优', icon: 'none' });
    if (msg.type === 'error') {
      this.setData({ calculating: false, result: null, empty: emptyVM(), emptyHint: '本次计算未完成，请缩小输入或切换收益最高模式后重试。' });
      return;
    }
    const r = msg.result;
    result = { ...r, mode: state.mode, tab, inventory: tab === 'farm' ? {} : { ...state.inventory }, harvestYield: state.yield, stamp: Progress.signature(calculationInput()), channel: state.settings.channel, hasHot: state.settings.hot.length > 0 && state.settings.channel === 'shop' };
    rememberResult(result);
    this.setData({ calculating: false });
    this.syncResult();
  },

  onCancelCalc() {
    calcToken++;
    workerBusy = false; solverRunning = false;
    if (solver) { solver.terminate(); solver = null; }
    this.setData({ calculating: false });
    this.syncResult();
  },

  // ---------- recipe progress ----------

  onToggleComplete(e) {
    const id = Number(e.currentTarget.dataset.id);
    this.updateDone(id, state.sessions[tab].done[id] === this.findPlan(id).quantity ? 0 : this.findPlan(id).quantity, true);
  },

  onDoneAdd(e) {
    const id = Number(e.currentTarget.dataset.id);
    const p = this.findPlan(id);
    this.updateDone(id, (state.sessions[tab].done[id] || 0) + Progress.batchSize(p), true);
  },

  onDoneInput(e) {
    const id = Number(e.currentTarget.dataset.id);
    const raw = e.detail.value;
    if (raw === '') return;
    this.updateDone(id, Number(raw), true);
  },

  findPlan(id) { return state.sessions[tab].result.plan.find(p => p.id === id); },

  updateDone(id, quantity, rerender) {
    const session = state.sessions[tab], p = session?.result.plan.find(p => p.id === id);
    if (!p || !Progress.validDone(p, quantity)) {
      wx.showToast({ title: '请按每次产出数量填写，不能超过计划份数。', icon: 'none' });
      if (rerender) this.syncResult();
      return;
    }
    session.done[id] = quantity;
    save();
    if (rerender) this.syncResult();
  },

  onResumeTap(e) {
    const key = e.currentTarget.dataset.resume;
    if (key !== 'active') {
      const chosen = state.history.splice(Number(key), 1)[0];
      if (!chosen) return;
      const old = state.sessions[chosen.result.tab];
      if (old) state.history.unshift(old);
      state.sessions[chosen.result.tab] = chosen;
    }
    result = state.sessions[tab]?.result || null;
    save();
    this.renderAll();
  },

  // ---------- recipe book ----------

  onRecipeCheck(e) {
    const id = Number(e.currentTarget.dataset.id);
    // A standalone checkbox reports detail.value as an array; some base
    // libraries also expose detail.checked. Accept both shapes.
    const checked = typeof e.detail.checked === 'boolean' ? e.detail.checked : !!(e.detail.value && e.detail.value.length);
    state.owned = checked ? [...new Set([...state.owned, id])] : state.owned.filter(n => n !== id);
    this.afterInputChange();
    this.renderRecipes();
  },

  onAllRecipes() {
    state.owned = data.recipes.map(r => r.id);
    this.afterInputChange();
    this.renderRecipes();
    wx.showToast({ title: '已标记全部 141 个料理手册。', icon: 'none' });
  },

  onClearRecipes() {
    if (!state.owned.length) return;
    wx.showModal({
      title: '取消全部已学配方？',
      content: `将取消目前勾选的 ${state.owned.length} 个配方。`,
      confirmText: '确认全部取消',
      cancelText: '保留配方',
      success: res => {
        if (!res.confirm) return;
        state.owned = [];
        this.afterInputChange();
        this.renderRecipes();
        wx.showToast({ title: '已取消全部配方。', icon: 'none' });
      }
    });
  },

  onRecipeSearchInput(e) { this.setData({ recipeSearch: e.detail.value }); this.renderRecipes(); },
  onFilterTap(e) { recipeFilter = e.currentTarget.dataset.filter; this.renderRecipes(); },
  onSortChange(e) { state.recipeSort = Number(e.detail.value) === 1 ? 'name' : 'game'; save(); this.renderRecipes(); },

  // ---------- item info ----------

  onItemTap(e) {
    const name = e.currentTarget.dataset.item;
    const i = data.items.find(x => x.name === name), p = data.recipes.find(x => x.name === name);
    if (!i) return;
    const cat = i.category, hint = data.creatureHints && data.creatureHints[name], w = data.seasons && data.seasons[name];
    let obtain = '';
    if (cat === 'Fish') obtain = '钓鱼获得';
    else if (cat === 'Sea Creatures') obtain = '穿潜水服潜水捕获';
    else if (CROPS.includes(name) || ['green pumpkin', 'white pumpkin', 'yellow pumpkin'].includes(name)) obtain = '种植收获（种苗向曹卖或商店购买）';
    else if (['apple', 'cherry', 'orange', 'peach', 'pear', 'coconut'].includes(name)) obtain = '果树采收';
    else if (name === 'turnips') obtain = '每周日上午向曹卖购买';
    else if (name === 'weeds') obtain = '岛上拔草';
    else if (name === 'bamboo shoot') obtain = '竹林旁地面标记挖掘（全年）';
    else if (name.includes('mushroom')) obtain = name === 'rare mushroom' ? '蘑菇季在树下标记点挖掘' : '蘑菇季在树下拾取';
    else if (p) obtain = '料理台加工获得';
    const rows = [
      ['类别', cat === 'Fish' ? '鱼类' : cat === 'Sea Creatures' ? '海产' : p ? '加工原料' : '原料'],
      ['基础售价', fmt(i.sellPrice) + ' 铃钱'],
      ['现有库存', (state.inventory[name] || 0) + ' 个']
    ];
    if (hint) rows.push(['出现', hint.l + ' · ' + hint.t]);
    if (obtain) rows.push(['获取', obtain]);
    rows.push(['季节', w ? `北半球 ${monthsZh(w.nh)} · 南半球 ${monthsZh(w.sh)}` : '全年可得']);
    this.setData({
      itemInfo: {
        title: i.zh, sub: `${i.zh} · ${name}`,
        rows: rows.map(([k, v]) => ({ k, v: String(v) })),
        recipe: p ? `${Object.entries(p.ingredients).map(([n, v]) => `${zh(n)} ×${v}`).join('、')} → ${p.outputQuantity} 份` : ''
      }
    });
  },

  onItemInfoClose() { this.setData({ itemInfo: null }); },

  onCopyLink(e) {
    wx.setClipboardData({ data: e.currentTarget.dataset.url, success: () => wx.showToast({ title: '链接已复制，可在浏览器打开', icon: 'none' }) });
  },

  noop() {},

  toggleCalendar() { this.setData({ showCalendar: !this.data.showCalendar }); },
  toggleHistory() { this.setData({ showHistory: !this.data.showHistory }); },
  toggleAvailable() { this.setData({ showAvailable: !this.data.showAvailable }); },

  // ---------- guide ----------

  openGuide() {
    guideActive = true; guideStep = 0;
    this.renderGuide();
  },

  renderGuide() {
    const step = GUIDE_STEPS[guideStep];
    if (step.tab !== tab) { tab = step.tab; result = state.sessions[tab]?.result || null; this.renderAll(); }
    this.setData({
      guide: {
        step: guideStep, count: GUIDE_STEPS.length, title: step.title, text: step.text,
        example: guideStep === 2 && !state.sessions.inventory,
        backDisabled: guideStep === 0, nextLabel: guideStep === GUIDE_STEPS.length - 1 ? '开始赚多多 →' : '下一步 →'
      }
    });
  },

  onGuideBack() { guideStep = Math.max(0, guideStep - 1); this.renderGuide(); },
  onGuideNext() {
    if (guideStep === GUIDE_STEPS.length - 1) this.closeGuide();
    else { guideStep++; this.renderGuide(); }
  },
  closeGuide() {
    guideActive = false;
    state.guideSeen = true;
    save();
    this.setData({ guide: null });
    this.renderAll();
  },
  onGuideReopen() { this.openGuide(); }
});

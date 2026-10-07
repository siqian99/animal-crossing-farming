/* 岛屿设置页：web 版的 settings 弹窗移植为独立页面。保存后通过 store 的
   settingsDirty 标志通知首页失效旧结果，数据结构与网页版完全一致。 */
const store = require('../../utils/store.js');
const { state, data, save, markSettingsDirty, RETENTIONS } = store;

const names = Object.fromEntries([...data.items, ...data.recipes].map(i => [i.name, i.zh]));
const zh = n => names[n] || n;

const CHANNEL_LABELS = ['商店内出售 · 普通售价', '收购箱 · 普通售价的 80%'];
const HEMISPHERE_LABELS = ['北半球', '南半球'];
const NATIVE_VALUES = ['unknown', 'apple', 'cherry', 'orange', 'peach', 'pear'];
const NATIVE_LABELS = ['尚未设置', '苹果', '樱桃', '橘子', '桃子', '梨子'];
const CJ_LABELS = ['否 · 按当前出售渠道', '是 · 可卖给俞司廷'];
const RETENTION_LABELS = RETENTIONS.map(v => `${Math.round(v * 100)}% · ${v === 1 ? '保持最高收入' : `最多少赚 ${Math.round((1 - v) * 100)}%`}`);

let hotDraft = [];

function sortedRecipes() {
  return [...data.recipes].sort(state.recipeSort === 'name'
    ? (a, b) => a.zh.localeCompare(b.zh, 'zh-CN-u-co-pinyin') || a.serialId - b.serialId
    : (a, b) => a.serialId - b.serialId);
}

function hotResults(search) {
  const q = search.trim().toLowerCase();
  if (!q) return [];
  return sortedRecipes()
    .filter(r => !hotDraft.includes(r.name) && `${r.zh} ${r.name}`.toLowerCase().includes(q))
    .slice(0, 8)
    .map(r => ({ name: r.name, zh: r.zh }));
}

Page({
  data: {
    channelLabels: CHANNEL_LABELS, channelIndex: 0,
    hemisphereLabels: HEMISPHERE_LABELS, hemisphereIndex: 0,
    nativeLabels: NATIVE_LABELS, nativeIndex: 0,
    cjLabels: CJ_LABELS, cjIndex: 0,
    retentionLabels: RETENTION_LABELS, retentionIndex: RETENTIONS.indexOf(.9),
    turnipPrice: '0',
    hotSearch: '', hotResults: [], hotChips: []
  },

  onLoad() {
    const s = state.settings;
    hotDraft = [...s.hot];
    this.setData({
      channelIndex: s.channel === 'box' ? 1 : 0,
      hemisphereIndex: s.hemisphere === 'south' ? 1 : 0,
      nativeIndex: Math.max(0, NATIVE_VALUES.indexOf(s.native)),
      cjIndex: s.cj ? 1 : 0,
      retentionIndex: Math.max(0, RETENTIONS.indexOf(s.retention)),
      turnipPrice: String(s.turnipPrice || 0)
    });
    this.syncHot();
  },

  onChannelChange(e) { this.setData({ channelIndex: Number(e.detail.value) }); },
  onHemisphereChange(e) { this.setData({ hemisphereIndex: Number(e.detail.value) }); },
  onNativeChange(e) { this.setData({ nativeIndex: Number(e.detail.value) }); },
  onCjChange(e) { this.setData({ cjIndex: Number(e.detail.value) }); },
  onRetentionChange(e) { this.setData({ retentionIndex: Number(e.detail.value) }); },
  onTurnipInput(e) { this.setData({ turnipPrice: e.detail.value }); },

  syncHot() {
    this.setData({
      hotChips: hotDraft.map(n => ({ name: n, zh: zh(n) })),
      hotResults: hotResults(this.data.hotSearch)
    });
  },

  onHotSearchInput(e) { this.setData({ hotSearch: e.detail.value }); this.syncHot(); },

  // 键盘「搜索」确认：唯一候选时直接加入，对齐网页版的回车行为。
  onHotConfirm() {
    if (this.data.hotResults.length === 1) this.addHot(this.data.hotResults[0].name);
  },

  addHot(name) {
    hotDraft.push(name);
    this.setData({ hotSearch: '' });
    this.syncHot();
  },

  onHotAdd(e) { this.addHot(e.currentTarget.dataset.name); },
  onHotRemove(e) { hotDraft = hotDraft.filter(n => n !== e.currentTarget.dataset.name); this.syncHot(); },

  onSave() {
    const raw = this.data.turnipPrice, v = Number(raw);
    if (raw === '' || !Number.isSafeInteger(v) || v < 0 || v > 10000) {
      wx.showToast({ title: '大头菜报价请输入 0–10000 的整数', icon: 'none' });
      return;
    }
    state.settings = {
      channel: this.data.channelIndex === 1 ? 'box' : 'shop',
      native: NATIVE_VALUES[this.data.nativeIndex] || 'unknown',
      hemisphere: this.data.hemisphereIndex === 1 ? 'south' : 'north',
      cj: this.data.cjIndex === 1,
      turnipPrice: v || 0,
      hot: [...hotDraft],
      retention: RETENTIONS[this.data.retentionIndex] || .9
    };
    save();
    markSettingsDirty();
    wx.showToast({ title: '岛屿设置已保存', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 350);
  }
});
